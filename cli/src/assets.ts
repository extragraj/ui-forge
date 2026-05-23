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
  | 'mcp-server'
  | 'post-tool-verify-hook'
  | 'project-cli';

export type ThemeId = 'shadcn' | 'mantine' | 'plain-tailwind' | 'stackshift' | 'none';

export interface ThemeAsset {
  files: string[];
  forgeignore?: string;
}

export const REQUIRED_FEATURES: FeatureId[] = ['scan', 'forge', 'verify', 'mcp-server'];

/** Human-readable display name for each feature (used in summaries). */
export const FEATURE_DISPLAY: Record<FeatureId, string> = {
  scan: 'Scan',
  forge: 'Forge',
  verify: 'Verify',
  'export-design': 'Export Design',
  'fetch-handoff': 'Fetch Handoff',
  'mcp-server': 'MCP Server',
  'post-tool-verify-hook': 'Verify After Edit (Hook)',
  'project-cli': 'Project CLI Shim',
};

/**
 * Standards source dirs to bridge into design/standards/ per theme.
 *
 * sourcePath: relative to skill root — folder of .md files to copy.
 * destSubdir: subdirectory created under <project>/design/standards/.
 *
 * destSubdir is intentionally stable across folder reorgs so already-seeded
 * project copies (e.g. design/standards/stackshift-ui/) keep working.
 */
export interface ThemeStandardsConfig {
  sourcePath: string;
  destSubdir: string;
}

export const STANDARDS_BY_THEME: Partial<Record<ThemeId, ThemeStandardsConfig>> = {
  stackshift: {
    sourcePath: 'references/themes/stackshift/standards',
    destSubdir: 'stackshift-ui',
  },
};

export const RUNTIME_ASSETS = {
  always: [
    'scripts/detect.js',
    'scripts/detect.sh',
    'scripts/apply-synthesis.js',
    'references/prompt-patterns.md',
    // NOTE: references/standards/ is NOT copied into the skill dir (Issue 10).
    // Standards live in design/standards/ (seeded by bootstrapDesignStandards at install time).
    // NOTE: skill.version is NOT copied (1.6.4) — it's source-bundle metadata,
    // not runtime data. The installed lockfile records the version under
    // `skillVersion` and the version is stamped into mcp-server.js + the
    // project-cli shim at install time via the asset transform.
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
    'post-tool-verify-hook': [], // wiring only; no script assets
    'project-cli': [],           // wiring only; no script assets
  } as Record<FeatureId, string[]>,

  byTheme: {
    shadcn: { files: ['themes/shadcn.json'] },
    mantine: { files: ['themes/mantine.json'] },
    'plain-tailwind': { files: ['themes/plain-tailwind.json'] },
    stackshift: {
      files: ['themes/stackshift.json'],
      forgeignore: 'references/themes/stackshift/forgeignore.txt',
    },
    none: { files: [] },
  } as Record<ThemeId, ThemeAsset>,

  defaultForgeignore: 'references/forgeignore/default.txt',
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
  /^commands\//,
  /^CLAUDE\.md$/,
  /^LICENSE$/,
  /^package\.json$/,
  /^package-lock\.json$/,
  /^pnpm-lock\.yaml$/,
  /^pnpm-workspace\.yaml$/,
  /^README\.md$/,
  /^skill\.version$/,
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
  /^references\/(?!prompt-patterns\.md$).+/,
  /^themes\/README\.md$/,
  /^design\//,
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
  'post-tool-verify-hook': ['scripts/verify.js'], // hook invokes verify.js
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
