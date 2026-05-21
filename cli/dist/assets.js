/**
 * Runtime asset manifest — defines exactly what files each selected feature
 * needs in the target skill dir. Driven by §3.2 of the install plan.
 */
export const REQUIRED_FEATURES = ['scan', 'forge'];
export const RUNTIME_ASSETS = {
    always: [
        'scripts/detect.js',
        'scripts/detect.sh',
        'scripts/apply-synthesis.js',
        'references/prompt-patterns.md',
        'references/standards/',
        'skill.version',
        'SKILL.md',
    ],
    byFeature: {
        scan: ['scripts/scan.js'],
        forge: ['scripts/invoke.js'],
        verify: [
            'scripts/verify.js',
            'scripts/verify-standards.js',
            'scripts/validate-contract.js',
            'packages/variant-contract/',
        ],
        'export-design': ['scripts/export-design.js'],
        'fetch-handoff': ['scripts/fetch-handoff.js'],
        'mcp-server': ['scripts/mcp-server.js'],
    },
    byTheme: {
        shadcn: { files: ['themes/shadcn.json'] },
        mantine: { files: ['themes/mantine.json'] },
        'plain-tailwind': { files: ['themes/plain-tailwind.json'] },
        stackshift: {
            files: ['themes/stackshift.json'],
            forgeignore: 'references/default-stackshift-forgeignore.txt',
        },
    },
    defaultForgeignore: 'references/default-forgeignore.txt',
};
/**
 * Patterns that must never be copied into a target skill dir, even if
 * accidentally included in the tarball.
 */
export const NEVER_COPY = [
    /^tests\//,
    /^examples\//,
    /^tmp\//,
    /^change-logs\//,
    /^CLAUDE\.md$/,
    /^\.git/,
    /^\.github\//,
    /^\.vscode\//,
    /^node_modules\//,
    /\.bak$/,
    /\.tmp$/,
    /^cli\/src\//,
    /^cli\/tsconfig/,
    /scripts\/sync-version\.mjs$/,
    /scripts\/test-mcp\.mjs$/,
    /scripts\/cli\.js$/,
];
/**
 * Slash command files written per feature.
 */
export const FEATURE_COMMANDS = {
    scan: 'forge-scan.md',
    forge: 'forge.md',
    verify: 'forge-verify.md',
    'export-design': 'forge-export-design.md',
    'fetch-handoff': 'forge-handoff.md',
};
/**
 * Permission allow-list entries written per feature.
 * Each entry is the script path relative to the skill root.
 */
export const FEATURE_PERMISSIONS = {
    scan: ['scripts/scan.js'],
    forge: ['scripts/invoke.js', 'scripts/apply-synthesis.js'],
    verify: ['scripts/verify.js', 'scripts/verify-standards.js', 'scripts/validate-contract.js'],
    'export-design': ['scripts/export-design.js'],
    'fetch-handoff': ['scripts/fetch-handoff.js'],
    'mcp-server': ['scripts/mcp-server.js'],
};
/**
 * Resolve the full set of assets to copy for a given selection.
 * Returns posix-style relative paths (directories end with /).
 */
export function resolveAssets(features, theme, paired) {
    const set = new Set(RUNTIME_ASSETS.always);
    for (const feature of features) {
        for (const entry of RUNTIME_ASSETS.byFeature[feature] ?? []) {
            set.add(entry);
        }
    }
    const themeAsset = RUNTIME_ASSETS.byTheme[theme];
    for (const file of themeAsset.files)
        set.add(file);
    // Stackshift forgeignore only applies when paired.
    const forgeignoreSource = theme === 'stackshift' && paired && themeAsset.forgeignore
        ? themeAsset.forgeignore
        : RUNTIME_ASSETS.defaultForgeignore;
    // Final safety net: drop anything matching NEVER_COPY.
    const files = Array.from(set).filter((p) => !NEVER_COPY.some((rx) => rx.test(p)));
    return { files, forgeignoreSource };
}
