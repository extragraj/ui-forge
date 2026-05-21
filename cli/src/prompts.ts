/**
 * Interactive prompt flow using @clack/prompts. Falls back to non-interactive
 * mode when --yes or any selection flag is provided.
 */
import * as p from '@clack/prompts';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { FeatureId, ThemeId } from './assets.js';
import { REQUIRED_FEATURES } from './assets.js';
import type { ParsedFlags, OnOff, PairMode, Scope } from './flags.js';
import type { Lockfile } from './lockfile.js';
import { detectPairing, type PairingState } from './pairing.js';
import { detectPlatforms, PLATFORMS } from './platforms.js';

export interface InstallSelections {
  scope: 'project' | 'global' | 'both';
  platforms: string[];
  paired: boolean;
  pairingState: PairingState;
  features: FeatureId[];
  theme: ThemeId;
  mcpEnabled: boolean;
  mcpClients: string[];
  hooksEnabled: boolean;
  projectCli: boolean;
  forgeignoreSource: string;
}

const ALL_FEATURES: { value: FeatureId; label: string; hint?: string }[] = [
  { value: 'scan', label: 'scan — scaffold design/design-arch.json', hint: 'required' },
  { value: 'forge', label: 'forge — invoke component generation', hint: 'required' },
  { value: 'verify', label: 'verify — contract + standards validation' },
  { value: 'export-design', label: 'export-design — bundle for Claude Design' },
  { value: 'fetch-handoff', label: 'fetch-handoff — pull refs from a handoff URL' },
  { value: 'mcp-server', label: 'mcp-server — MCP tool exposure' },
];

const ALL_THEMES: { value: ThemeId; label: string }[] = [
  { value: 'shadcn', label: 'shadcn — Radix + Tailwind defaults' },
  { value: 'mantine', label: 'mantine — Mantine UI tokens' },
  { value: 'plain-tailwind', label: 'plain-tailwind — Tailwind, no component lib' },
  { value: 'stackshift', label: 'stackshift — StackShift design language' },
];

function detectedMcpClients(): string[] {
  const home = homedir();
  const candidates: { id: string; path: string }[] = [
    { id: 'claude-code', path: join(home, '.claude.json') },
    { id: 'cursor', path: join(home, '.cursor', 'mcp.json') },
    { id: 'codex', path: join(home, '.codex', 'config.toml') },
  ];
  // Cline locations differ per OS.
  const appdata = process.env.APPDATA;
  if (appdata) {
    candidates.push({
      id: 'cline',
      path: join(appdata, 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'),
    });
  } else if (process.platform === 'darwin') {
    candidates.push({
      id: 'cline',
      path: join(home, 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'),
    });
  } else {
    candidates.push({
      id: 'cline',
      path: join(home, '.config', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'),
    });
  }
  return candidates.filter((c) => existsSync(c.path)).map((c) => c.id);
}

function isCancel<T>(v: T | symbol): v is symbol {
  return p.isCancel(v);
}

function exit(): never {
  p.cancel('Install cancelled.');
  process.exit(1);
}

function resolveFromFlags(flags: ParsedFlags, prior?: Lockfile): Partial<InstallSelections> {
  const out: Partial<InstallSelections> = {};
  if (flags.scope) out.scope = flags.scope as 'project' | 'global' | 'both';
  if (flags.platforms) out.platforms = flags.platforms;
  if (flags.features) out.features = mergeRequired(flags.features);
  if (flags.theme) out.theme = flags.theme;
  if (flags.mcp) out.mcpEnabled = flags.mcp === 'on';
  if (flags.mcpClients) out.mcpClients = flags.mcpClients;
  if (flags.hooks) out.hooksEnabled = flags.hooks === 'on';
  if (flags.projectCli) out.projectCli = flags.projectCli === 'on';
  if (prior && flags.yes) {
    out.scope ??= prior.scope;
    out.platforms ??= prior.platforms;
    out.features ??= prior.features;
    out.theme ??= prior.theme;
    out.mcpEnabled ??= prior.mcpClients.length > 0;
    out.mcpClients ??= prior.mcpClients;
    out.hooksEnabled ??= prior.hooks.postToolUseVerify || prior.hooks.stackshiftValidate;
    out.projectCli ??= prior.projectCli;
  }
  return out;
}

function mergeRequired(features: FeatureId[]): FeatureId[] {
  const set = new Set(features);
  for (const r of REQUIRED_FEATURES) set.add(r);
  return Array.from(set);
}

/**
 * Run the full interactive (or flag-driven) install selection flow.
 */
export async function collectSelections(
  cwd: string,
  flags: ParsedFlags,
  prior?: Lockfile
): Promise<InstallSelections> {
  const overrides = resolveFromFlags(flags, prior);
  const pairing = (() => {
    if (flags.pair === 'on') return { ...detectPairing(cwd), paired: true };
    if (flags.pair === 'off') return { paired: false, a11yRequired: false, invalid: false };
    return detectPairing(cwd);
  })();

  // If --yes or all required selections came via flags, skip interactive prompts.
  const canSkipPrompts =
    flags.yes ||
    (overrides.scope && overrides.platforms && overrides.features && overrides.theme);

  if (canSkipPrompts) {
    return buildSelections(cwd, overrides, pairing, flags);
  }

  p.intro('UI Forge Installation');

  if (prior) {
    p.note(
      `Existing install found at .ui-forge/installed.json (v${prior.skillVersion}).\n` +
        `Re-running init will let you modify the selection.`,
      'Existing install'
    );
  }
  if (pairing.paired) {
    p.note('StackShift detected — paired mode enabled.', 'Pairing');
  } else if (pairing.invalid) {
    p.note('.stackshift/installed.json is invalid — treating as unpaired. Run `stackshift doctor`.', 'Pairing');
  }

  // Scope
  const scope =
    overrides.scope ??
    ((await p.select({
      message: 'Install scope',
      initialValue: prior?.scope ?? 'project',
      options: [
        { value: 'project', label: 'Project (.claude/skills/ui-forge in cwd)' },
        { value: 'global', label: 'Global (~/.claude/skills/ui-forge)' },
        { value: 'both', label: 'Both (project + global)' },
      ],
    })) as Scope);
  if (isCancel(scope)) exit();

  // Platforms
  const detected = detectPlatforms(cwd).map((pl) => pl.id);
  const platforms =
    overrides.platforms ??
    ((await p.multiselect({
      message: 'Target platforms',
      initialValues: prior?.platforms ?? (detected.length > 0 ? detected : ['claude']),
      options: PLATFORMS.map((pl) => ({
        value: pl.id,
        label: pl.label + (detected.includes(pl.id) ? ' (detected)' : ''),
      })),
      required: true,
    })) as string[]);
  if (isCancel(platforms)) exit();

  // Manual pairing prompt if not detected
  let pairedFinal = pairing.paired;
  if (!pairing.paired && !pairing.invalid && flags.pair !== 'on' && flags.pair !== 'off') {
    const manual = await p.confirm({
      message: 'Is this project paired with StackShift?',
      initialValue: false,
    });
    if (isCancel(manual)) exit();
    pairedFinal = manual;
  }
  if (flags.pair === 'on') pairedFinal = true;
  if (flags.pair === 'off') pairedFinal = false;

  // Features
  const features = overrides.features ?? ((await p.multiselect({
    message: 'Features to install',
    initialValues:
      prior?.features ??
      (['scan', 'forge', 'verify'] as FeatureId[]),
    options: ALL_FEATURES.map((f) => ({
      value: f.value,
      label: f.label,
      hint: REQUIRED_FEATURES.includes(f.value) ? 'required' : undefined,
    })),
    required: true,
  })) as FeatureId[]);
  if (isCancel(features)) exit();
  const finalFeatures = mergeRequired(features);

  // Theme
  const theme = overrides.theme ?? ((await p.select({
    message: 'Theme preset',
    initialValue: prior?.theme ?? (pairedFinal ? 'stackshift' : 'shadcn'),
    options: ALL_THEMES,
  })) as ThemeId);
  if (isCancel(theme)) exit();

  // MCP
  const availableMcp = detectedMcpClients();
  let mcpEnabled = overrides.mcpEnabled ?? false;
  let mcpClients = overrides.mcpClients ?? [];
  if (finalFeatures.includes('mcp-server') && availableMcp.length > 0) {
    const ask = await p.confirm({
      message: `Wire UI Forge MCP server into detected clients (${availableMcp.join(', ')})?`,
      initialValue: true,
    });
    if (isCancel(ask)) exit();
    mcpEnabled = ask;
    if (mcpEnabled && !overrides.mcpClients) {
      const sel = await p.multiselect({
        message: 'Which MCP clients?',
        initialValues: availableMcp,
        options: availableMcp.map((id) => ({ value: id, label: id })),
        required: true,
      });
      if (isCancel(sel)) exit();
      mcpClients = sel as string[];
    }
  }

  // Project CLI shim
  let projectCli = overrides.projectCli ?? true;
  if (overrides.projectCli === undefined) {
    const ans = await p.confirm({
      message: 'Create ./ui-forge.mjs at project root for easy local invocation?',
      initialValue: true,
    });
    if (isCancel(ans)) exit();
    projectCli = ans;
  }

  // Hooks
  let hooksEnabled = overrides.hooksEnabled ?? false;
  if (overrides.hooksEnabled === undefined && finalFeatures.includes('verify')) {
    const ans = await p.confirm({
      message: 'Install PostToolUse hook to auto-run verify.js after edits?',
      initialValue: false,
    });
    if (isCancel(ans)) exit();
    hooksEnabled = ans;
  }

  p.outro('Selections collected — applying…');

  return {
    scope: scope as 'project' | 'global' | 'both',
    platforms: platforms as string[],
    paired: pairedFinal,
    pairingState: pairing,
    features: finalFeatures,
    theme: theme as ThemeId,
    mcpEnabled,
    mcpClients,
    hooksEnabled,
    projectCli,
    forgeignoreSource: '', // filled in by install.ts via resolveAssets
  };
}

function buildSelections(
  _cwd: string,
  overrides: Partial<InstallSelections>,
  pairing: PairingState,
  flags: ParsedFlags
): InstallSelections {
  const features = mergeRequired(overrides.features ?? (['scan', 'forge', 'verify'] as FeatureId[]));
  const theme = overrides.theme ?? (pairing.paired ? ('stackshift' as ThemeId) : ('shadcn' as ThemeId));
  const detected = detectedMcpClients();
  const mcpEnabled =
    overrides.mcpEnabled ?? (features.includes('mcp-server') && detected.length > 0);
  const mcpClients = overrides.mcpClients ?? (mcpEnabled ? detected : []);
  return {
    scope: overrides.scope ?? 'project',
    platforms: overrides.platforms ?? ['claude'],
    paired: flags.pair === 'on' ? true : flags.pair === 'off' ? false : pairing.paired,
    pairingState: pairing,
    features,
    theme,
    mcpEnabled,
    mcpClients,
    hooksEnabled: overrides.hooksEnabled ?? false,
    projectCli: overrides.projectCli ?? true,
    forgeignoreSource: '',
  };
}
