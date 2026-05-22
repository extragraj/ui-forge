/**
 * Theme transformations. Implements the limited-mode rewrite for the
 * stackshift theme when the project is not paired.
 *
 * Also handles install-time version stamping (1.6.4): since `skill.version`
 * is no longer copied into the skill dir, `mcp-server.js` would fall back to
 * `'0.0.0'`. We rewrite the `getVersion()` body to return the install-time
 * version as a literal string.
 */
import type { ThemeId } from './assets.js';

export interface ThemeContext {
  theme: ThemeId;
  paired: boolean;
  /** Version stamped at install time. Replaces the runtime `skill.version` read. */
  version?: string;
}

/**
 * If the asset being copied is a stackshift theme JSON and the project is not
 * paired, transform it: drop themeOverride + paired signals, add _limited: true.
 * Returns null to skip copying, a string/Buffer to override contents, or
 * undefined to use default copy.
 */
export function maybeTransformAsset(
  ctx: ThemeContext,
  relPath: string,
  contents: Buffer
): Buffer | string | undefined {
  // Version-stamp scripts that previously read skill.version at runtime.
  if (ctx.version && relPath === 'scripts/mcp-server.js') {
    const body = contents.toString('utf8');
    // Match the full getVersion() block with brace counting. The source is:
    //   function getVersion() { try { ... } catch { ... } }
    // which has three nested closing braces, so a flat `[^}]*\}` would leave
    // orphan tokens behind.
    const start = body.indexOf('function getVersion()');
    if (start !== -1) {
      const openBrace = body.indexOf('{', start);
      if (openBrace !== -1) {
        let depth = 1;
        let i = openBrace + 1;
        while (i < body.length && depth > 0) {
          if (body[i] === '{') depth++;
          else if (body[i] === '}') depth--;
          i++;
        }
        if (depth === 0) {
          const before = body.slice(0, start);
          const after = body.slice(i);
          return before + `function getVersion() { return ${JSON.stringify(ctx.version)} }` + after;
        }
      }
    }
  }

  if (ctx.theme !== 'stackshift') return undefined;
  if (relPath !== 'themes/stackshift.json') return undefined;
  if (ctx.paired) return undefined;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(contents.toString('utf8')) as Record<string, unknown>;
  } catch {
    return undefined;
  }
  delete parsed.themeOverride;
  if (parsed.signals && typeof parsed.signals === 'object') {
    const signals = parsed.signals as Record<string, unknown>;
    delete signals.SIGNAL_VALIDATE_PAIRED;
    delete signals.PAIRED_A11Y;
  }
  parsed._limited = true;
  return JSON.stringify(parsed, null, 2) + '\n';
}

export function themeLimited(ctx: ThemeContext): boolean {
  return ctx.theme === 'stackshift' && !ctx.paired;
}
