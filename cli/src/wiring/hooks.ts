/**
 * Optional PostToolUse hook for auto-running verify after edits.
 * Patches each platform's settings.json hooks array.
 *
 * Schema note (1.6.1): Claude Code's PostToolUse format is:
 *   { matcher: "Edit|Write", hooks: [{ type: "command", command: "..." }] }
 * NOT the older { id, matcher: { tool, pathGlob }, command } shape that
 * 1.6.0 wrote. We carry our marker on a sibling `_uiForgeId` key so the
 * lookup-by-marker cleanup logic keeps working; Claude Code ignores
 * unknown keys.
 */
import { existsSync, readFileSync } from 'node:fs';
import { posix } from 'node:path';
import { backupOnce, readJson, toPosix, writeJson } from '../fs-utils.js';
import { expandScope, makeRel } from './commands.js';
import { platformById, platformPaths } from '../platforms.js';

export interface HooksArgs {
  cwd: string;
  homedir: string;
  scope: 'project' | 'global';
  platformIds: string[];
  paired: boolean;
  enabled: boolean;
  dryRun: boolean;
}

export interface HooksResult {
  patched: { path: string; keys: string[] }[];
}

const HOOK_MARKER = 'ui-forge:verify-after-edit';
const PAIRED_MARKER = 'ui-forge:stackshift-validate';

type HookEntry = Record<string, unknown>;

function isUiForgeEntry(h: HookEntry): boolean {
  // Match both the 1.6.0 legacy shape (id on the entry) and the 1.6.1 shape
  // (_uiForgeId sibling key) so re-installs upgrade cleanly.
  if (h._uiForgeId === HOOK_MARKER || h._uiForgeId === PAIRED_MARKER) return true;
  if (h.id === HOOK_MARKER || h.id === PAIRED_MARKER) return true;
  // Last-resort: identify by command substring pointing at our scripts.
  const cmd = typeof h.command === 'string' ? h.command : '';
  if (cmd.includes('ui-forge') && cmd.includes('scripts/verify.js')) return true;
  if (cmd.includes('.stackshift/scripts/validate.js')) return true;
  // Or the nested 1.6.1 shape: hooks[].command.
  if (Array.isArray(h.hooks)) {
    return (h.hooks as HookEntry[]).some((sub) => {
      const c = typeof sub?.command === 'string' ? (sub.command as string) : '';
      return (
        (c.includes('ui-forge') && c.includes('scripts/verify.js')) ||
        c.includes('.stackshift/scripts/validate.js')
      );
    });
  }
  return false;
}

export function writeHooks(args: HooksArgs): HooksResult {
  const { cwd, homedir, scope, platformIds, paired, enabled, dryRun } = args;
  const patched: { path: string; keys: string[] }[] = [];

  for (const id of platformIds) {
    const platform = platformById(id);
    if (!platform) continue;
    for (const scopeChoice of expandScope(scope)) {
      const paths = platformPaths(cwd, platform, scopeChoice, homedir);
      if (dryRun) {
        patched.push({
          path: toPosix(makeRel(cwd, paths.settingsFile, scopeChoice)),
          keys: ['hooks.PostToolUse'],
        });
        continue;
      }

      const existing = existsSync(paths.settingsFile) ? safeReadJson(paths.settingsFile) : {};
      const settings = (existing as Record<string, unknown>) ?? {};
      const hooks = ((settings.hooks as Record<string, unknown>) ?? {}) as Record<string, unknown>;
      let post = Array.isArray(hooks.PostToolUse) ? (hooks.PostToolUse as HookEntry[]) : [];

      // Strip any prior ui-forge hooks (legacy 1.6.0 shape OR current shape).
      post = post.filter((h) => !isUiForgeEntry(h));

      // Claude Code exposes the edited file path as $CLAUDE_TOOL_INPUT_file_path
      // (not $CLAUDE_FILE_PATH, which 1.6.0 incorrectly used — the variable
      // never substitutes, so verify.js receives the literal string and falls
      // back to its two-arg usage error). verify.js short-circuits on non-TSX
      // files and on TSX files that lack the `// FORGE NOTES` header, so a
      // bare `Edit|Write` matcher is safe — no pathGlob needed.
      if (enabled) {
        const verifyScript = posix.join(toPosix(paths.skillDir), 'scripts/verify.js');
        post.push({
          matcher: 'Edit|Write',
          hooks: [
            {
              type: 'command',
              command: `node "${verifyScript}" "$CLAUDE_TOOL_INPUT_file_path"`,
            },
          ],
          _uiForgeId: HOOK_MARKER,
        });
      }
      if (paired) {
        post.push({
          matcher: 'Edit|Write',
          hooks: [
            {
              type: 'command',
              command: 'node .stackshift/scripts/validate.js "$CLAUDE_TOOL_INPUT_file_path"',
            },
          ],
          _uiForgeId: PAIRED_MARKER,
        });
      }

      // Drop an empty PostToolUse array entirely so settings stays minimal.
      if (post.length === 0) {
        delete hooks.PostToolUse;
      } else {
        hooks.PostToolUse = post;
      }
      if (Object.keys(hooks).length === 0) {
        delete settings.hooks;
      } else {
        settings.hooks = hooks;
      }

      // Idempotency: skip the write entirely when nothing changed. Prevents
      // the second `init` run from rewriting a byte-identical settings.json
      // (which would still bump mtime and dirty the working tree).
      const nextBody = JSON.stringify(settings, null, 2) + '\n';
      const currentBody = existsSync(paths.settingsFile)
        ? readFileSync(paths.settingsFile, 'utf8')
        : '';
      if (currentBody === nextBody) {
        continue;
      }

      if (existsSync(paths.settingsFile)) backupOnce(paths.settingsFile);
      writeJson(paths.settingsFile, settings);
      patched.push({
        path: toPosix(makeRel(cwd, paths.settingsFile, scopeChoice)),
        keys: ['hooks.PostToolUse'],
      });
    }
  }
  return { patched };
}

function safeReadJson(path: string): unknown {
  try {
    return readJson(path);
  } catch {
    return {};
  }
}

/**
 * Remove ui-forge hooks from a settings file. Used by uninstall.
 * Handles both the 1.6.0 legacy shape and the 1.6.1 shape.
 */
export function removeHooks(settingsPath: string, dryRun: boolean): boolean {
  if (!existsSync(settingsPath)) return false;
  if (dryRun) return true;
  const settings = (safeReadJson(settingsPath) as Record<string, unknown>) ?? {};
  const hooks = (settings.hooks as Record<string, unknown>) ?? {};
  const post = Array.isArray(hooks.PostToolUse) ? (hooks.PostToolUse as HookEntry[]) : [];
  const filtered = post.filter((h) => !isUiForgeEntry(h));
  if (filtered.length === post.length) return false;
  hooks.PostToolUse = filtered;
  settings.hooks = hooks;
  writeJson(settingsPath, settings);
  return true;
}
