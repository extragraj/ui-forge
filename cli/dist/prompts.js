/**
 * Interactive prompt flow using @clack/prompts. Falls back to non-interactive
 * mode when --yes or any selection flag is provided.
 *
 * Style rule: prompt `message` fields use Title Case. `hint` text uses sentence
 * case. Option labels use Title Case for the name, sentence case for description.
 *
 * Prompt order:
 *   1. Existing-install note
 *   2. Pairing detection note
 *   3. Required features note (Scan, Forge, Verify, MCP Server — always included)
 *   4. Optional features via groupMultiselect (Claude Exclusives / Automation)
 *   5. Theme Preset (incl. None)
 *   6. Quick Scan offer
 *   7. StackShift pairing question (if not auto-detected)
 *   8. Agentic Platforms
 *   9. Install Scope (Project | Global)
 */
import * as p from '@clack/prompts';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { REQUIRED_FEATURES } from './assets.js';
import { detectPairing } from './pairing.js';
import { detectPlatforms, PLATFORMS } from './platforms.js';
const OPTIONAL_FEATURE_IDS = [
    'export-design',
    'fetch-handoff',
    'post-tool-verify-hook',
    'project-cli',
];
const ALL_THEMES = [
    { value: 'shadcn', label: 'Shadcn', hint: 'Radix + Tailwind defaults' },
    { value: 'mantine', label: 'Mantine', hint: 'Mantine UI tokens' },
    { value: 'plain-tailwind', label: 'Plain Tailwind', hint: 'Tailwind, no component lib' },
    { value: 'stackshift', label: 'StackShift', hint: 'StackShift design language' },
    { value: 'none', label: 'None', hint: 'project supplies its own design tokens' },
];
function detectedMcpClients() {
    const home = homedir();
    const candidates = [
        { id: 'claude-code', path: join(home, '.claude.json') },
        { id: 'cursor', path: join(home, '.cursor', 'mcp.json') },
        { id: 'codex', path: join(home, '.codex', 'config.toml') },
    ];
    const appdata = process.env.APPDATA;
    if (appdata) {
        candidates.push({
            id: 'cline',
            path: join(appdata, 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'),
        });
    }
    else if (process.platform === 'darwin') {
        candidates.push({
            id: 'cline',
            path: join(home, 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'),
        });
    }
    else {
        candidates.push({
            id: 'cline',
            path: join(home, '.config', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'),
        });
    }
    return candidates.filter((c) => existsSync(c.path)).map((c) => c.id);
}
function isCancel(v) {
    return p.isCancel(v);
}
function exit() {
    p.cancel('Install cancelled.');
    process.exit(1);
}
function resolveFromFlags(flags, prior) {
    const out = {};
    if (flags.scope)
        out.scope = flags.scope;
    if (flags.platforms)
        out.platforms = flags.platforms;
    if (flags.theme)
        out.theme = flags.theme;
    let features = flags.features ? mergeRequired([...flags.features]) : undefined;
    // Back-compat: legacy --hooks=on / --project-cli=on / --mcp=on flags
    if (features) {
        if (flags.hooks === 'on' && !features.includes('post-tool-verify-hook'))
            features.push('post-tool-verify-hook');
        if (flags.projectCli === 'on' && !features.includes('project-cli'))
            features.push('project-cli');
        if (flags.mcp === 'on' && !features.includes('mcp-server'))
            features.push('mcp-server');
    }
    if (features)
        out.features = features;
    if (flags.mcpClients)
        out.mcpClients = flags.mcpClients;
    if (prior && flags.yes) {
        out.scope ??= prior.scope;
        out.platforms ??= prior.platforms;
        out.features ??= migrateFeatures(prior);
        out.theme ??= prior.theme;
        out.mcpClients ??= prior.mcpClients;
    }
    return out;
}
/** Migrate pre-1.6.2 lockfiles: pull projectCli + hook out of old boolean fields. */
function migrateFeatures(prior) {
    const base = [...prior.features];
    if (prior.projectCli && !base.includes('project-cli'))
        base.push('project-cli');
    if (prior.hooks?.postToolUseVerify && !base.includes('post-tool-verify-hook'))
        base.push('post-tool-verify-hook');
    return mergeRequired(base);
}
function mergeRequired(features) {
    const set = new Set(features);
    for (const r of REQUIRED_FEATURES)
        set.add(r);
    return Array.from(set);
}
function deriveFromFeatures(features, mcpClients) {
    const mcpEnabled = features.includes('mcp-server');
    return {
        mcpEnabled,
        mcpClients: mcpEnabled ? mcpClients : [],
        hooksEnabled: features.includes('post-tool-verify-hook'),
        projectCli: features.includes('project-cli'),
    };
}
/**
 * Run the full interactive (or flag-driven) install selection flow.
 */
export async function collectSelections(cwd, flags, prior) {
    const overrides = resolveFromFlags(flags, prior);
    const pairing = (() => {
        if (flags.pair === 'on')
            return { ...detectPairing(cwd), paired: true };
        if (flags.pair === 'off')
            return { paired: false, a11yRequired: false, invalid: false };
        return detectPairing(cwd);
    })();
    const canSkipPrompts = flags.yes ||
        (overrides.scope && overrides.platforms && overrides.features && overrides.theme);
    if (canSkipPrompts) {
        return buildSelections(cwd, overrides, pairing, flags);
    }
    p.intro('UI Forge Installation');
    if (prior) {
        p.note(`Existing install found (v${prior.skillVersion}).\nRe-running init lets you update the selection.`, 'Existing Install');
    }
    if (pairing.paired) {
        p.note('StackShift detected — paired mode enabled.', 'Pairing');
    }
    else if (pairing.invalid) {
        p.note('.stackshift/installed.json is invalid — treating as unpaired. Run `stackshift doctor`.', 'Pairing');
    }
    // 1. Required features note (always included, no prompt)
    if (!overrides.features) {
        p.note('  Scan         — project design scanner\n' +
            '  Forge        — component generator\n' +
            '  Verify       — contract + standards validation\n' +
            '  MCP Server   — MCP tool exposure for agents', 'Required (always included)');
    }
    // 2. Optional features via groupMultiselect
    let finalFeatures;
    if (overrides.features) {
        finalFeatures = overrides.features;
    }
    else {
        const defaultOptional = prior
            ? migrateFeatures(prior).filter((f) => OPTIONAL_FEATURE_IDS.includes(f))
            : ['project-cli'];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawOptional = await p.groupMultiselect({
            message: 'Optional Features',
            initialValues: defaultOptional,
            options: {
                'Automation': [
                    { value: 'post-tool-verify-hook', label: 'Verify After Edit (Hook)', hint: 'auto-run verify.js after edits' },
                    { value: 'project-cli', label: 'Project CLI Shim', hint: './ui-forge.mjs convenience wrapper' },
                ],
                'Claude Exclusives': [
                    { value: 'export-design', label: 'Export Design', hint: 'bundle for Claude Design' },
                    { value: 'fetch-handoff', label: 'Fetch Handoff', hint: 'pull refs from a handoff URL' },
                ],
            },
            required: false,
        });
        if (isCancel(rawOptional))
            exit();
        const optionalSelected = rawOptional.filter((v) => OPTIONAL_FEATURE_IDS.includes(v));
        finalFeatures = mergeRequired(optionalSelected);
    }
    // 3. Theme Preset (incl. None)
    const theme = overrides.theme ?? (await p.select({
        message: 'Theme Preset',
        initialValue: prior?.theme ?? (pairing.paired ? 'stackshift' : 'shadcn'),
        options: ALL_THEMES.map((t) => ({ value: t.value, label: t.label, hint: t.hint })),
    }));
    if (isCancel(theme))
        exit();
    // 4. Quick Scan decision
    // - Theme selected → scan automatically (theme was chosen for a reason)
    // - Theme = None → ask the user (they may not have a tailwind config yet)
    let wantsScan = false;
    if (flags.quickScan === 'on') {
        wantsScan = true;
    }
    else if (flags.quickScan === 'off') {
        wantsScan = false;
    }
    else if (theme !== 'none') {
        wantsScan = true; // auto-scan when a theme is chosen
        p.note('A quick scan will run after install to capture your design tokens.', 'Auto Scan');
    }
    else {
        // theme = 'none' — always ask; scan is still useful for globals.css / custom tokens.
        const ans = await p.confirm({
            message: 'Run a quick scan after install? (local-only, no AI synthesis)',
            initialValue: false,
        });
        if (isCancel(ans))
            exit();
        wantsScan = ans;
    }
    // 4.5. Theme override (StackShift only — destructive). Opt-in.
    let wantsThemeOverride = false;
    let wantsNoBackup = flags.noBackup;
    if (flags.themeOverride) {
        wantsThemeOverride = theme === 'stackshift';
    }
    else if (theme === 'stackshift') {
        const apply = await p.confirm({
            message: 'Apply StackShift Theme Override To globals.css And tailwind.config?',
            initialValue: false,
        });
        if (isCancel(apply))
            exit();
        wantsThemeOverride = apply;
        if (apply) {
            const skipBackup = await p.confirm({
                message: 'Skip .bak Backups Of Modified Files?',
                initialValue: false,
            });
            if (isCancel(skipBackup))
                exit();
            wantsNoBackup = skipBackup;
        }
    }
    // 5. StackShift pairing (if not auto-detected)
    let pairedFinal = pairing.paired;
    if (!pairing.paired && !pairing.invalid && flags.pair !== 'on' && flags.pair !== 'off') {
        const manual = await p.confirm({
            message: 'Is This Project Paired With StackShift?',
            initialValue: false,
        });
        if (isCancel(manual))
            exit();
        pairedFinal = manual;
    }
    if (flags.pair === 'on')
        pairedFinal = true;
    if (flags.pair === 'off')
        pairedFinal = false;
    // 6. Agentic Platforms
    const detected = detectPlatforms(cwd).map((pl) => pl.id);
    const platforms = overrides.platforms ??
        (await p.multiselect({
            message: 'Agentic Platforms',
            initialValues: prior?.platforms ?? (detected.length > 0 ? detected : ['claude']),
            options: PLATFORMS.map((pl) => ({
                value: pl.id,
                label: pl.label + (detected.includes(pl.id) ? ' (detected)' : ''),
            })),
            required: true,
        }));
    if (isCancel(platforms))
        exit();
    // 7. Install Scope (Project | Global)
    const scope = overrides.scope ??
        (await p.select({
            message: 'Install Scope',
            initialValue: prior?.scope ?? 'project',
            options: [
                { value: 'project', label: 'Project', hint: '.claude/skills/ui-forge in cwd' },
                { value: 'global', label: 'Global', hint: '~/.claude/skills/ui-forge' },
            ],
        }));
    if (isCancel(scope))
        exit();
    // Auto-wire all detected MCP clients (Issue 5)
    const availableMcp = detectedMcpClients();
    const mcpClients = overrides.mcpClients ??
        (finalFeatures.includes('mcp-server') && availableMcp.length > 0 ? availableMcp : []);
    if (finalFeatures.includes('mcp-server') && availableMcp.length > 0) {
        p.note(`MCP Server will be wired to: ${availableMcp.join(', ')}`, 'MCP Clients');
    }
    p.outro('Selections complete — applying…');
    const derived = deriveFromFeatures(finalFeatures, mcpClients);
    return {
        scope: scope,
        platforms: platforms,
        paired: pairedFinal,
        pairingState: pairing,
        features: finalFeatures,
        theme: theme,
        ...derived,
        forgeignoreSource: '',
        wantsScan,
        wantsThemeOverride,
        wantsNoBackup,
    };
}
function buildSelections(_cwd, overrides, pairing, flags) {
    const features = mergeRequired(overrides.features ?? ['project-cli']);
    const theme = overrides.theme ?? (pairing.paired ? 'stackshift' : 'shadcn');
    const detected = detectedMcpClients();
    const mcpClients = overrides.mcpClients ?? (features.includes('mcp-server') && detected.length > 0 ? detected : []);
    const derived = deriveFromFeatures(features, mcpClients);
    return {
        scope: overrides.scope ?? 'project',
        platforms: overrides.platforms ?? ['claude'],
        paired: flags.pair === 'on' ? true : flags.pair === 'off' ? false : pairing.paired,
        pairingState: pairing,
        features,
        theme,
        ...derived,
        forgeignoreSource: '',
        wantsScan: flags.quickScan === 'on',
        // Non-interactive guard: only honor --theme-override when the user
        // explicitly passed it AND the theme is stackshift. Never silently rewrite
        // globals.css / tailwind.config under --yes.
        wantsThemeOverride: flags.themeOverride && theme === 'stackshift',
        wantsNoBackup: flags.noBackup,
    };
}
