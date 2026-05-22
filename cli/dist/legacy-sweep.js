/**
 * Legacy sweep — removes files left over from previous installs (pre-1.6.0
 * `scripts/cli.js install`, `npx skills add`, or older `ui-forge` versions).
 */
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { NEVER_COPY, RUNTIME_ASSETS } from './assets.js';
import { fromPosix, pruneEmptyDirs, removeFile, toPosix, walk } from './fs-utils.js';
const LEGACY_PATTERNS = [
    { rx: /^examples\//, reason: 'legacy-pattern: examples/' },
    { rx: /^tests\//, reason: 'legacy-pattern: tests/' },
    { rx: /^change-logs\//, reason: 'legacy-pattern: change-logs/' },
    { rx: /^tmp\//, reason: 'legacy-pattern: tmp/' },
    { rx: /^CLAUDE\.md$/, reason: 'legacy-pattern: CLAUDE.md (contributor doc)' },
    { rx: /^scripts\/sync-version\.mjs$/, reason: 'legacy-pattern: dev release script' },
    { rx: /^scripts\/test-mcp\.mjs$/, reason: 'legacy-pattern: manual test script' },
    { rx: /^scripts\/cli\.js$/, reason: 'legacy-pattern: pre-1.6.0 self-installer' },
    { rx: /^cli\/src\//, reason: 'legacy-pattern: TS source (never runtime)' },
    { rx: /^cli\/tsconfig/, reason: 'legacy-pattern: dev TS config' },
    { rx: /^references\/examples\//, reason: 'legacy-pattern: pre-1.6.0 examples' },
    { rx: /^references\/standards\//, reason: 'legacy-pattern: pre-1.6.2 standards (now in design/standards/)' },
    { rx: /^references\/(?!prompt-patterns\.md$).+/, reason: 'legacy-pattern: only references/prompt-patterns.md is runtime' },
    { rx: /^themes\/README\.md$/, reason: 'legacy-pattern: themes/README.md (source-bundle doc only)' },
    { rx: /^design\//, reason: 'legacy-pattern: design/ belongs at project root, never inside a skill dir' },
    { rx: /\.bak$/, reason: 'stale: .bak backup' },
    { rx: /\.tmp$/, reason: 'stale: .tmp aborted write' },
    { rx: /^\.DS_Store$|\/\.DS_Store$/, reason: 'os-noise: .DS_Store' },
    { rx: /^Thumbs\.db$|\/Thumbs\.db$/, reason: 'os-noise: Thumbs.db' },
];
function expectedFiles(features, theme) {
    const set = new Set();
    const add = (rel) => {
        if (rel.endsWith('/')) {
            // Directory entries are matched by prefix below; no direct expansion at this step.
            set.add(rel);
        }
        else {
            set.add(rel);
        }
    };
    for (const e of RUNTIME_ASSETS.always)
        add(e);
    for (const f of features) {
        for (const e of RUNTIME_ASSETS.byFeature[f] ?? [])
            add(e);
    }
    for (const e of (RUNTIME_ASSETS.byTheme[theme]?.files ?? []))
        add(e);
    return set;
}
function isExpected(relPath, expected) {
    if (expected.has(relPath))
        return true;
    // Directory prefix entries (end with /).
    for (const e of expected) {
        if (e.endsWith('/') && relPath.startsWith(e))
            return true;
    }
    return false;
}
export function sweep(args) {
    const report = { deleted: [], kept: [], warnings: [] };
    if (!existsSync(args.skillDir))
        return report;
    const expected = expectedFiles(args.features, args.theme);
    // First pass: catalogue everything in the target skill dir.
    const all = walk(args.skillDir);
    for (const rel of all) {
        if (isExpected(rel, expected))
            continue;
        // Theme files not matching the selection.
        if (rel.startsWith('themes/') && rel.endsWith('.json')) {
            const themeName = rel.slice('themes/'.length, -'.json'.length);
            if (themeName !== args.theme) {
                actDelete(args, rel, `deselected-theme: ${themeName}`, report);
                continue;
            }
        }
        // Known legacy patterns.
        const legacy = LEGACY_PATTERNS.find((p) => p.rx.test(rel));
        if (legacy) {
            actDelete(args, rel, legacy.reason, report);
            continue;
        }
        // Never-copy patterns (safety net).
        const banned = NEVER_COPY.find((rx) => rx.test(rel));
        if (banned) {
            actDelete(args, rel, `never-copy: ${banned.toString()}`, report);
            continue;
        }
        // Unknown file — prompt or report.
        if (args.mode === 'delete') {
            actDelete(args, rel, 'unknown-file (auto-prune)', report);
        }
        else if (args.mode === 'prompt-unknown') {
            const should = args.promptUnknown ? args.promptUnknown(rel) : false;
            if (should) {
                actDelete(args, rel, 'unknown-file (user-confirmed)', report);
            }
            else {
                report.kept.push({ path: rel, reason: 'unknown-file (kept)' });
            }
        }
        else {
            // 'report' mode (doctor) — list as kept.
            report.kept.push({ path: rel, reason: 'unknown-file' });
        }
    }
    // Prune empty directories after deletions (only in non-report modes).
    if (args.mode !== 'report') {
        pruneEmptyDirs(args.skillDir);
    }
    return report;
}
function actDelete(args, rel, reason, report) {
    if (args.mode === 'report') {
        report.kept.push({ path: rel, reason: `would-delete: ${reason}` });
        return;
    }
    const abs = join(args.skillDir, fromPosix(rel));
    try {
        removeFile(abs);
        report.deleted.push({ path: toPosix(rel), reason });
    }
    catch (err) {
        report.warnings.push(`Failed to remove ${rel}: ${err.message}`);
    }
}
/**
 * Check if a path is a directory (helper for sweep edge cases).
 */
export function isDir(abs) {
    try {
        return statSync(abs).isDirectory();
    }
    catch {
        return false;
    }
}
