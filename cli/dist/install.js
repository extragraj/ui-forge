/**
 * The `init` command — full install orchestration.
 */
import { homedir, tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveAssets, FEATURE_DISPLAY, STANDARDS_BY_THEME } from './assets.js';
import { copyAsset, ensureDir, readJsonSafe, toPosix, writeJson } from './fs-utils.js';
import { sweep } from './legacy-sweep.js';
import { loadLockfile, saveLockfile } from './lockfile.js';
import { platformById, platformPaths } from './platforms.js';
import { collectSelections } from './prompts.js';
import { getSkillSourceRoot, getSkillVersion } from './registry.js';
import { maybeTransformAsset, themeLimited } from './theme.js';
import { expandScope, writeCommands } from './wiring/commands.js';
import { writeForgeignore } from './wiring/forgeignore.js';
import { writeHooks } from './wiring/hooks.js';
import { writeMcp } from './wiring/mcp.js';
import { writePermissions } from './wiring/permissions.js';
import { writeProjectCli } from './wiring/project-cli.js';
import { bootstrapDesignStandards, pruneThemeStandards } from './wiring/design-bootstrap.js';
import { prunePriorFeatures, pruneProjectCli, pruneDeselectedCommands, pruneOrphanedCommands, prunePlatforms, pruneOrphanedSkillDirs, } from './feature-prune.js';
export async function runInit(cwd, flags) {
    const prior = loadLockfile(cwd);
    const selections = await collectSelections(cwd, flags, prior);
    const sourceRoot = getSkillSourceRoot();
    const version = getSkillVersion();
    const { files: assetFiles, forgeignoreSource } = resolveAssets(selections.features, selections.theme, selections.paired);
    const home = homedir();
    // Track written files per group for lockfile v2
    const files = {};
    const addToGroup = (group, rel) => {
        (files[group] ??= []).push(rel);
    };
    const patched = [];
    if (flags.dryRun) {
        console.log('\n--- DRY RUN: planned actions ---');
    }
    // 0. Feature prune (1.6.4 Issue 8). When a prior install had optional
    // features that are now deselected, remove their tracked files before the
    // new copy step. Required features are never pruned. Files shared across
    // retained groups are skipped.
    const pruneResult = prior
        ? prunePriorFeatures({
            cwd,
            priorFiles: prior.files,
            nextFeatures: selections.features,
            dryRun: flags.dryRun,
        })
        : { removed: [], skipped: [] };
    if (!flags.dryRun && pruneResult.removed.length > 0) {
        console.log(`Feature prune: removed ${pruneResult.removed.length} file(s) from deselected feature(s).`);
    }
    const shimRemoved = prior
        ? pruneProjectCli({
            cwd,
            prior: Boolean(prior.features.includes('project-cli') || prior.projectCli),
            next: selections.features.includes('project-cli'),
            dryRun: flags.dryRun,
        })
        : null;
    if (shimRemoved) {
        console.log(`Feature prune: removed ui-forge.mjs (project-cli deselected).`);
        pruneResult.removed.push(shimRemoved);
    }
    // 0b. Prune commands for deselected features.
    const prunedCmds = prior
        ? pruneDeselectedCommands({
            cwd,
            homedir: home,
            scope: selections.scope,
            platformIds: selections.platforms,
            priorFeatures: prior.features,
            nextFeatures: selections.features,
            dryRun: flags.dryRun,
        })
        : [];
    pruneResult.removed.push(...prunedCmds);
    // 0c. Prune files/wiring for deselected platforms.
    const platformPruneResult = prior
        ? prunePlatforms({
            cwd,
            homedir: home,
            priorScope: prior.scope,
            priorPlatforms: prior.platforms,
            nextPlatforms: selections.platforms,
            priorFiles: prior.files,
            dryRun: flags.dryRun,
        })
        : { removed: [], skipped: [] };
    if (!flags.dryRun && platformPruneResult.removed.length > 0) {
        const deselectedIds = prior.platforms.filter((id) => !selections.platforms.includes(id));
        console.log(`Platform prune: removed ${platformPruneResult.removed.length} file(s) from deselected platform(s): ${deselectedIds.join(', ')}.`);
    }
    pruneResult.removed.push(...platformPruneResult.removed);
    // 0d. Prune orphaned skill dirs — platform dirs that exist on disk but are
    // not in the current selection. Catches stale installs from before lockfile
    // platform tracking was complete (lockfile already updated but dirs remain).
    const orphanResult = pruneOrphanedSkillDirs({
        cwd,
        homedir: home,
        scope: selections.scope,
        nextPlatforms: selections.platforms,
        dryRun: flags.dryRun,
    });
    if (!flags.dryRun && orphanResult.removed.length > 0) {
        console.log(`Orphan prune: removed ${orphanResult.removed.length} file(s)/dir(s) from unselected platform(s).`);
    }
    pruneResult.removed.push(...orphanResult.removed);
    // 0e. Orphan command scan — for each selected platform, remove any owned
    // `forge-*.md` whose feature is not in the current selection. Runs every
    // install regardless of lockfile diff, so stale commands from before 1.6.6
    // (where the diff window had already passed) still get cleaned up.
    const orphanCmds = pruneOrphanedCommands({
        cwd,
        homedir: home,
        scope: selections.scope,
        platformIds: selections.platforms,
        nextFeatures: selections.features,
        dryRun: flags.dryRun,
    });
    if (!flags.dryRun && orphanCmds.length > 0) {
        console.log(`Orphan command prune: removed ${orphanCmds.length} stale command file(s).`);
    }
    pruneResult.removed.push(...orphanCmds);
    // 1. Copy assets to each platform's skill dir.
    for (const platformId of selections.platforms) {
        const platform = platformById(platformId);
        if (!platform)
            continue;
        for (const scopeChoice of expandScope(selections.scope)) {
            const paths = platformPaths(cwd, platform, scopeChoice, home);
            const skillDir = paths.skillDir;
            ensureDir(skillDir);
            const sweepReport = sweep({
                skillDir,
                features: selections.features,
                theme: selections.theme,
                paired: selections.paired,
                mode: flags.dryRun ? 'report' : flags.pruneUnknown || flags.yes ? 'delete' : 'prompt-unknown',
                promptUnknown: () => false,
            });
            if (sweepReport.deleted.length > 0) {
                console.log(`Legacy sweep on ${toPosix(skillDir)}: removed ${sweepReport.deleted.length} file(s)`);
            }
            for (const rel of assetFiles) {
                if (flags.dryRun) {
                    console.log(`  copy: ${rel} → ${toPosix(skillDir)}/${rel}`);
                    continue;
                }
                const dests = copyAsset(sourceRoot, skillDir, rel, {
                    transform: (assetRel, contents) => {
                        const result = maybeTransformAsset({ theme: selections.theme, paired: selections.paired, version }, assetRel, contents);
                        return result === undefined ? contents : result;
                    },
                });
                const lockPrefix = makeRelToLock(cwd, skillDir, scopeChoice);
                for (const d of dests) {
                    const lockRel = toPosix(join(lockPrefix, d));
                    // Assign to the appropriate feature group
                    const group = groupForFile(rel, selections.features);
                    addToGroup(group, lockRel);
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
    for (const rel of cmds.written)
        addToGroup('commands', rel);
    if (flags.dryRun)
        cmds.planned.forEach((p) => console.log(`  write command: ${p}`));
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
    if (flags.dryRun)
        perms.planned.forEach((p) => console.log(`  patch permissions: ${p.path} (+${p.entries.length})`));
    // 4. MCP wiring (only if mcp-server feature selected).
    const mcpEnabled = selections.features.includes('mcp-server');
    if (mcpEnabled && selections.mcpClients.length > 0) {
        const first = platformById(selections.platforms[0]);
        if (first) {
            const firstScope = expandScope(selections.scope)[0];
            const paths = platformPaths(cwd, first, firstScope, home);
            // Guard: skip MCP wiring when the skill dir resolves inside a temp
            // directory — writing a temp path to global MCP configs produces a
            // broken entry once the temp dir is cleaned up.
            const resolvedSkillDir = resolve(paths.skillDir);
            const resolvedTmp = resolve(tmpdir());
            if (resolvedSkillDir.startsWith(resolvedTmp + '/') || resolvedSkillDir.startsWith(resolvedTmp + '\\')) {
                console.warn(`Warning: skill dir is inside temp directory — skipping MCP wiring to avoid stale config.\n  skillDir: ${resolvedSkillDir}`);
            }
            else {
                const mcpResult = writeMcp({
                    homedir: home,
                    appdata: process.env.APPDATA,
                    platform: process.platform,
                    skillDir: paths.skillDir,
                    clientIds: selections.mcpClients,
                    dryRun: flags.dryRun,
                });
                patched.push(...mcpResult.patched);
                if (flags.dryRun)
                    mcpResult.planned.forEach((p) => console.log(`  patch mcp: ${p.path} (${p.client})`));
            }
        }
    }
    // 5. Hooks (driven by feature selection).
    // Always run when a prior install existed so stale ui-forge hooks (e.g. the
    // PAIRED_MARKER from a previous paired install) are stripped on un-pair.
    const hooksEnabled = selections.features.includes('post-tool-verify-hook');
    if (hooksEnabled || selections.paired || prior) {
        const hooksResult = writeHooks({
            cwd,
            homedir: home,
            scope: selections.scope,
            platformIds: selections.platforms,
            paired: selections.paired,
            enabled: hooksEnabled,
            dryRun: flags.dryRun,
        });
        patched.push(...hooksResult.patched);
    }
    // 6. Project-root CLI shim (driven by feature selection).
    const projectCli = selections.features.includes('project-cli');
    if (projectCli) {
        const path = writeProjectCli({ cwd, version, dryRun: flags.dryRun });
        if (flags.dryRun) {
            console.log(`  write project shim: ${toPosix(path)}`);
        }
        else {
            addToGroup('project-cli', toPosix(makeLockRel(cwd, path)));
        }
    }
    // 7. .forgeignore template. The StackShift template is opinionated content,
    // not a generic placeholder — write it without a provenance header so it's
    // immediately user-owned and untouched by future re-installs (unless
    // --force-forgeignore is passed or the theme/paired mode changed).
    const isStackshiftTemplate = selections.theme === 'stackshift' && selections.paired;
    const themeChanged = Boolean(prior) && (prior.theme !== selections.theme || prior.paired !== selections.paired);
    const fi = writeForgeignore({
        cwd,
        sourceRoot,
        sourceRel: forgeignoreSource,
        version,
        force: flags.forceForgeignore || themeChanged,
        skipProvenance: isStackshiftTemplate,
        dryRun: flags.dryRun,
    });
    if (flags.dryRun) {
        console.log(`  write .forgeignore: ${toPosix(fi.destPath)} (template=${forgeignoreSource})`);
    }
    else if (fi.reason === 'preserved-user-owned') {
        console.log(`  .forgeignore: preserved user-owned file (pass --force-forgeignore to overwrite)`);
        addToGroup('forgeignore', toPosix(makeLockRel(cwd, fi.destPath)));
    }
    else if (fi.reason === 'no-provenance' && fi.written) {
        console.log(`  Wrote .forgeignore (StackShift template — delete to revert to default behavior on next install).`);
        addToGroup('forgeignore', toPosix(makeLockRel(cwd, fi.destPath)));
    }
    else if (fi.reason !== 'no-source') {
        addToGroup('forgeignore', toPosix(makeLockRel(cwd, fi.destPath)));
    }
    // 7.4. Prune theme-specific design standards that don't match the current
    // selection. Runs every install (not gated on prior.theme diff) so stale
    // subdirs left over from pre-1.6.6 theme switches still get cleaned up.
    // Pruned paths are recorded in lockfile.pruned[] (via pruneResult.removed
    // below) — NOT in files.design-standards, since those files no longer
    // exist on disk and would otherwise be a phantom entry in the lockfile.
    {
        const prunedNow = new Date().toISOString();
        const pruned = pruneThemeStandards({
            cwd,
            nextTheme: selections.theme,
            dryRun: flags.dryRun,
        });
        for (const rel of pruned) {
            pruneResult.removed.push({ at: prunedNow, path: rel, reason: 'theme-standards-stale' });
        }
    }
    // 7.5. Bootstrap design/standards/ from theme source files (Issue 9).
    const bootstrap = bootstrapDesignStandards({
        cwd,
        sourceRoot,
        theme: selections.theme,
        version,
        dryRun: flags.dryRun,
    });
    for (const rel of bootstrap.copied)
        addToGroup('design-standards', rel);
    if (flags.dryRun && bootstrap.copied.length > 0) {
        bootstrap.copied.forEach((p) => console.log(`  seed design/standards: ${p}`));
    }
    // 8. Build the lockfile.
    // Deduplicate within each group
    for (const k of Object.keys(files)) {
        files[k] = Array.from(new Set(files[k])).sort();
    }
    const allWritten = Object.values(files).flat();
    const lock = {
        lockfileVersion: 2,
        skillVersion: version,
        installedAt: new Date().toISOString(),
        scope: selections.scope,
        platforms: selections.platforms,
        paired: selections.paired,
        theme: selections.theme,
        features: selections.features,
        mcpClients: mcpEnabled ? selections.mcpClients : [],
        files,
        written: Array.from(new Set(allWritten)).sort(),
        patched,
        pruned: [...(prior?.pruned ?? []), ...pruneResult.removed],
        // Back-compat fields (used by repair/ls but not saved to JSON)
        hooks: { postToolUseVerify: hooksEnabled, stackshiftValidate: selections.paired },
        projectCli,
        themeLimited: themeLimited({ theme: selections.theme, paired: selections.paired }),
        forgeignoreSource,
    };
    if (!flags.dryRun) {
        saveLockfile(cwd, lock);
        // 8b. Reset design-arch.json theme-derived fields when they disagree
        // with the current selection. Runs every install — not gated on
        // prior.theme diff — so stale markers from a prior theme (where the
        // diff window had already passed) still get cleaned up.
        //
        // Cleans:
        //   - `_theme` → set to current selection
        //   - `isStackShift` → set to false when theme !== stackshift
        //   - `tailwind.darkColorTokens` → dropped for non-stackshift themes
        //   - `designStandards.<key>` → removed when the entry corresponds to a
        //     theme subdir (per STANDARDS_BY_THEME) that isn't the current theme.
        //     Non-theme entries (e.g. nextjs-image) are preserved.
        //   - `patterns` (spacing/typography/conventions) → dropped when any
        //     other theme-derived field was stale. The values are tied to the
        //     prior theme (e.g. stackshift patterns reference @stackshift-ui
        //     primitives) and would be misleading or actively wrong under the
        //     new theme. The next `/forge-scan` will repopulate them with
        //     fallbacks (or AI synthesis) appropriate to the current theme.
        {
            const archPath = join(cwd, 'design', 'design-arch.json');
            const arch = readJsonSafe(archPath);
            if (arch) {
                const expectedTheme = selections.theme === 'none' ? undefined : selections.theme;
                const tailwind = arch.tailwind && typeof arch.tailwind === 'object'
                    ? arch.tailwind
                    : null;
                const designStandards = arch.designStandards && typeof arch.designStandards === 'object'
                    ? arch.designStandards
                    : null;
                const keepStandardKey = STANDARDS_BY_THEME[selections.theme]?.destSubdir;
                const themeStandardKeys = new Set(Object.values(STANDARDS_BY_THEME)
                    .filter((v) => !!v)
                    .map((v) => v.destSubdir));
                const staleStandardKeys = designStandards
                    ? Object.keys(designStandards).filter((k) => themeStandardKeys.has(k) && k !== keepStandardKey)
                    : [];
                const hasStaleTheme = arch._theme !== expectedTheme;
                const hasStaleStackshiftFlag = selections.theme !== 'stackshift' && arch.isStackShift === true;
                const hasStaleDarkTokens = selections.theme !== 'stackshift' && tailwind && 'darkColorTokens' in tailwind;
                const hasStaleStandards = staleStandardKeys.length > 0;
                const themeChanged = hasStaleTheme || hasStaleStackshiftFlag || hasStaleDarkTokens || hasStaleStandards;
                if (themeChanged) {
                    try {
                        arch._theme = expectedTheme;
                        if (hasStaleStackshiftFlag)
                            arch.isStackShift = false;
                        if (hasStaleDarkTokens && tailwind)
                            delete tailwind.darkColorTokens;
                        if (designStandards) {
                            for (const k of staleStandardKeys)
                                delete designStandards[k];
                        }
                        // Drop scan-synthesized patterns — they reference the prior
                        // theme's primitives. Next /forge-scan repopulates for the
                        // current theme.
                        if ('patterns' in arch)
                            delete arch.patterns;
                        writeJson(archPath, arch);
                    }
                    catch { /* non-fatal — scan will fix it */ }
                }
            }
        }
        // Quick scan (Issue 11)
        if (selections.wantsScan) {
            const firstPlatform = platformById(selections.platforms[0] ?? 'claude');
            const firstPaths = firstPlatform
                ? platformPaths(cwd, firstPlatform, selections.scope, home)
                : null;
            const scanScript = firstPaths ? join(firstPaths.skillDir, 'scripts', 'scan.js') : null;
            if (scanScript) {
                const scanArgs = ['--quick'];
                // Pass --theme so applyTheme + findDesignStandards run for the
                // selected theme (1.6.4 Issues 1 & 7).
                if (selections.theme && selections.theme !== 'none') {
                    scanArgs.push('--theme', selections.theme);
                }
                // Destructive opt-in (1.6.4 Issue 6) — only valid for stackshift.
                if (selections.wantsThemeOverride && selections.theme === 'stackshift') {
                    scanArgs.push('--theme-override');
                    if (selections.wantsNoBackup)
                        scanArgs.push('--no-backup');
                }
                console.log('\nRunning quick scan…');
                const r = spawnSync(process.execPath, [scanScript, ...scanArgs], { stdio: 'inherit', cwd });
                if (r.status !== 0) {
                    console.log('  Scan completed with warnings (non-fatal).');
                }
            }
        }
        console.log('\nUI Forge installed successfully.');
        console.log(`  Version:   ${version}`);
        console.log(`  Features:  ${selections.features.map((f) => FEATURE_DISPLAY[f] ?? f).join(', ')}`);
        console.log(`  Theme:     ${selections.theme}${lock.themeLimited ? ' (limited)' : ''}`);
        console.log(`  Platforms: ${selections.platforms.join(', ')}`);
        console.log(`  Paired:    ${selections.paired}`);
        if (projectCli) {
            console.log(`\nRun \`node ui-forge.mjs --help\` to see available commands.`);
        }
    }
    else {
        console.log('\n--- END DRY RUN (no changes written) ---');
    }
    return { lock, dryRun: flags.dryRun };
}
/**
 * Determine which lockfile group a given asset file belongs to.
 */
function groupForFile(rel, features) {
    if (rel.startsWith('themes/'))
        return 'theme';
    if (rel.startsWith('scripts/scan'))
        return 'scan';
    if (rel.startsWith('scripts/invoke') || rel.startsWith('scripts/apply-synthesis'))
        return 'forge';
    if (rel.startsWith('scripts/verify') || rel.startsWith('scripts/validate-contract') || rel.startsWith('packages/variant-contract'))
        return 'verify';
    if (rel.startsWith('scripts/export-design'))
        return 'export-design';
    if (rel.startsWith('scripts/fetch-handoff'))
        return 'fetch-handoff';
    if (rel.startsWith('scripts/mcp-server'))
        return 'mcp-server';
    return 'always';
}
function makeLockRel(cwd, abs) {
    const rel = relative(cwd, abs);
    return rel || abs;
}
function makeRelToLock(cwd, abs, scope) {
    if (scope === 'global')
        return abs;
    return relative(cwd, abs);
}
