/**
 * The `init` command — full install orchestration.
 */
import { homedir } from 'node:os';
import { join, relative } from 'node:path';
import { resolveAssets, type FeatureId, type ThemeId } from './assets.js';
import type { ParsedFlags } from './flags.js';
import { copyAsset, ensureDir, toPosix } from './fs-utils.js';
import { sweep } from './legacy-sweep.js';
import { loadLockfile, saveLockfile, lockfileExists, type Lockfile } from './lockfile.js';
import { detectPlatforms, platformById, platformPaths } from './platforms.js';
import { collectSelections } from './prompts.js';
import { getSkillSourceRoot, getSkillVersion } from './registry.js';
import { maybeTransformAsset, themeLimited } from './theme.js';
import { expandScope, writeCommands } from './wiring/commands.js';
import { writeForgeignore } from './wiring/forgeignore.js';
import { writeHooks } from './wiring/hooks.js';
import { writeMcp } from './wiring/mcp.js';
import { writePermissions } from './wiring/permissions.js';
import { writeProjectCli, projectCliPath } from './wiring/project-cli.js';

export interface InstallResult {
  lock: Lockfile;
  dryRun: boolean;
}

export async function runInit(cwd: string, flags: ParsedFlags): Promise<InstallResult> {
  const prior = loadLockfile(cwd);
  const selections = await collectSelections(cwd, flags, prior);
  const sourceRoot = getSkillSourceRoot();
  const version = getSkillVersion();

  const { files: assetFiles, forgeignoreSource } = resolveAssets(
    selections.features,
    selections.theme,
    selections.paired
  );

  const home = homedir();

  const written: string[] = [];
  const patched: { path: string; keys: string[] }[] = [];

  if (flags.dryRun) {
    console.log('\n--- DRY RUN: planned actions ---');
  }

  // 1. Copy assets to each platform's skill dir.
  for (const platformId of selections.platforms) {
    const platform = platformById(platformId);
    if (!platform) continue;
    for (const scopeChoice of expandScope(selections.scope)) {
      const paths = platformPaths(cwd, platform, scopeChoice, home);
      const skillDir = paths.skillDir;
      ensureDir(skillDir);

      // Legacy sweep before copying — only meaningful if the skill dir already had files.
      const sweepReport = sweep({
        skillDir,
        features: selections.features,
        theme: selections.theme,
        paired: selections.paired,
        mode: flags.dryRun ? 'report' : flags.pruneUnknown || flags.yes ? 'delete' : 'prompt-unknown',
        promptUnknown: () => false, // For non-interactive flow; interactive prompt deferred.
      });
      if (sweepReport.deleted.length > 0) {
        console.log(`Legacy sweep on ${toPosix(skillDir)}: removed ${sweepReport.deleted.length} file(s)`);
      }

      // Copy assets.
      for (const rel of assetFiles) {
        if (flags.dryRun) {
          console.log(`  copy: ${rel} → ${toPosix(skillDir)}/${rel}`);
          continue;
        }
        const dests = copyAsset(sourceRoot, skillDir, rel, {
          transform: (assetRel, contents) => {
            const result = maybeTransformAsset(
              { theme: selections.theme, paired: selections.paired },
              assetRel,
              contents
            );
            return result === undefined ? contents : result;
          },
        });
        for (const d of dests) {
          written.push(toPosix(join(makeRelToLock(cwd, skillDir, scopeChoice), d)));
        }
      }
    }
  }

  // 2. Write per-platform slash command files.
  const cmds = writeCommands({
    cwd,
    homedir: home,
    scope: selections.scope,
    platformIds: selections.platforms,
    features: selections.features,
    sourceRoot,
    version,
    dryRun: flags.dryRun,
  });
  written.push(...cmds.written);
  if (flags.dryRun) cmds.planned.forEach((p) => console.log(`  write command: ${p}`));

  // 3. Patch permissions.
  const perms = writePermissions({
    cwd,
    homedir: home,
    scope: selections.scope,
    platformIds: selections.platforms,
    features: selections.features,
    dryRun: flags.dryRun,
  });
  patched.push(...perms.patched);
  if (flags.dryRun) perms.planned.forEach((p) => console.log(`  patch permissions: ${p.path} (+${p.entries.length})`));

  // 4. MCP wiring (only if selected).
  if (selections.mcpEnabled && selections.features.includes('mcp-server') && selections.mcpClients.length > 0) {
    // Use the first platform's skill dir as the MCP server path target.
    const first = platformById(selections.platforms[0]!);
    if (first) {
      const firstScope = expandScope(selections.scope)[0]!;
      const paths = platformPaths(cwd, first, firstScope, home);
      const mcpResult = writeMcp({
        homedir: home,
        appdata: process.env.APPDATA,
        platform: process.platform,
        skillDir: paths.skillDir,
        clientIds: selections.mcpClients,
        dryRun: flags.dryRun,
      });
      patched.push(...mcpResult.patched);
      if (flags.dryRun) mcpResult.planned.forEach((p) => console.log(`  patch mcp: ${p.path} (${p.client})`));
    }
  }

  // 5. Hooks.
  if (selections.hooksEnabled || selections.paired) {
    const hooksResult = writeHooks({
      cwd,
      homedir: home,
      scope: selections.scope,
      platformIds: selections.platforms,
      paired: selections.paired,
      enabled: selections.hooksEnabled,
      dryRun: flags.dryRun,
    });
    patched.push(...hooksResult.patched);
  }

  // 6. Project-root CLI shim.
  if (selections.projectCli) {
    const path = writeProjectCli({ cwd, version, dryRun: flags.dryRun });
    if (flags.dryRun) {
      console.log(`  write project shim: ${toPosix(path)}`);
    } else {
      written.push(toPosix(makeLockRel(cwd, path)));
    }
  }

  // 7. .forgeignore template.
  const fi = writeForgeignore({
    cwd,
    sourceRoot,
    sourceRel: forgeignoreSource,
    dryRun: flags.dryRun,
  });
  if (fi && !flags.dryRun) written.push(toPosix(makeLockRel(cwd, fi)));

  // 8. Build the lockfile.
  const lock: Lockfile = {
    skillVersion: version,
    installedAt: new Date().toISOString(),
    scope: selections.scope,
    platforms: selections.platforms,
    paired: selections.paired,
    theme: selections.theme,
    themeLimited: themeLimited({ theme: selections.theme, paired: selections.paired }),
    features: selections.features,
    mcpClients: selections.mcpEnabled ? selections.mcpClients : [],
    hooks: {
      postToolUseVerify: selections.hooksEnabled,
      stackshiftValidate: selections.paired,
    },
    projectCli: selections.projectCli,
    forgeignoreSource,
    written: Array.from(new Set(written)).sort(),
    patched,
    pruned: prior?.pruned ?? [],
  };

  if (!flags.dryRun) {
    saveLockfile(cwd, lock);
    console.log('\nUI Forge installed successfully.');
    console.log(`  Version:  ${version}`);
    console.log(`  Features: ${selections.features.join(', ')}`);
    console.log(`  Theme:    ${selections.theme}${lock.themeLimited ? ' (limited)' : ''}`);
    console.log(`  Platforms: ${selections.platforms.join(', ')}`);
    console.log(`  Paired:   ${selections.paired}`);
    if (selections.projectCli) {
      console.log(`\nRun \`node ui-forge.mjs scan\` to scan the project.`);
    }
  } else {
    console.log('\n--- END DRY RUN (no changes written) ---');
  }

  return { lock, dryRun: flags.dryRun };
}

function makeLockRel(cwd: string, abs: string): string {
  const rel = relative(cwd, abs);
  return rel || abs;
}

function makeRelToLock(cwd: string, abs: string, scope: 'project' | 'global'): string {
  if (scope === 'global') return abs;
  return relative(cwd, abs);
}
