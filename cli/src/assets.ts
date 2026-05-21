/**
 * Runtime asset manifest — defines exactly what files each selected feature
 * needs in the target skill dir. Driven by §3.2 of the install plan.
 */

export type FeatureId =
  | 'scan'
  | 'forge'
  | 'verify'
  | 'export-design'
  | 'fetch-handoff'
  | 'mcp-server';

export type ThemeId = 'shadcn' | 'mantine' | 'plain-tailwind' | 'stackshift';

export interface ThemeAsset {
  files: string[];
  forgeignore?: string;
}

export const REQUIRED_FEATURES: FeatureId[] = ['scan', 'forge'];

export const RUNTIME_ASSETS = {
  always: [
    'scripts/detect.js',
    'scripts/detect.sh',
    'scripts/apply-synthesis.js',
    'references/prompt-patterns.md',
    'references/standards/',
    'skill.version',
    'SKILL.md',
  ] as string[],

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
  } as Record<FeatureId, string[]>,

  byTheme: {
    shadcn: { files: ['themes/shadcn.json'] },
    mantine: { files: ['themes/mantine.json'] },
    'plain-tailwind': { files: ['themes/plain-tailwind.json'] },
    stackshift: {
      files: ['themes/stackshift.json'],
      forgeignore: 'references/default-stackshift-forgeignore.txt',
    },
  } as Record<ThemeId, ThemeAsset>,

  defaultForgeignore: 'references/default-forgeignore.txt',
} as const;

/**
 * Patterns that must never be copied into a target skill dir, even if
 * accidentally included in the tarball.
 */
export const NEVER_COPY: RegExp[] = [
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
export const FEATURE_COMMANDS: Partial<Record<FeatureId, string>> = {
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
export const FEATURE_PERMISSIONS: Partial<Record<FeatureId, string[]>> = {
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
export function resolveAssets(
  features: FeatureId[],
  theme: ThemeId,
  paired: boolean
): { files: string[]; forgeignoreSource: string } {
  const set = new Set<string>(RUNTIME_ASSETS.always);

  for (const feature of features) {
    for (const entry of RUNTIME_ASSETS.byFeature[feature] ?? []) {
      set.add(entry);
    }
  }

  const themeAsset = RUNTIME_ASSETS.byTheme[theme];
  for (const file of themeAsset.files) set.add(file);

  // Stackshift forgeignore only applies when paired.
  const forgeignoreSource =
    theme === 'stackshift' && paired && themeAsset.forgeignore
      ? themeAsset.forgeignore
      : RUNTIME_ASSETS.defaultForgeignore;

  // Final safety net: drop anything matching NEVER_COPY.
  const files = Array.from(set).filter((p) => !NEVER_COPY.some((rx) => rx.test(p)));

  return { files, forgeignoreSource };
}
