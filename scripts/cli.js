#!/usr/bin/env node
import { spawnSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = dirname(__dirname);

const [, , cmd, ...rest] = process.argv;

const SCRIPTS = {
  scan:   join(__dirname, 'scan.js'),
  forge:  join(__dirname, 'invoke.js'),
  verify: join(__dirname, 'verify.js'),
  export: join(__dirname, 'export-design.js'),
};

function proxy(script) {
  const result = spawnSync(process.execPath, [script, ...rest], {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
  process.exit(result.status ?? 1);
}

// Known agentic platform path segments → [relative-skill-path, platform-dir-key]
const PLATFORM_MAP = [
  ['.claude/skills/ui-forge',                '.claude'],
  ['.agents/skills/ui-forge',                '.agents'],
  ['.github/skills/ui-forge',                '.github'],
  ['.cursor/skills/ui-forge',                '.cursor'],
  ['.codex/skills/ui-forge',                 '.codex'],
  ['.copilot/skills/ui-forge',               '.copilot'],
  ['.agentic/skills/ui-forge',               '.agentic'],
  ['.gemini/antigravity/skills/ui-forge',    '.gemini/antigravity'],
];

function resolvePlatform(cwd) {
  const skillNorm = SKILL_ROOT.replace(/\\/g, '/');
  for (const [relSkill, platformKey] of PLATFORM_MAP) {
    if (!skillNorm.includes('/' + relSkill)) continue;
    return {
      platformDir: join(cwd, ...platformKey.split('/')),
      relSkill,
    };
  }
  // Fallback: global install or unknown layout — default to .claude in cwd
  return { platformDir: join(cwd, '.claude'), relSkill: '.claude/skills/ui-forge' };
}

function install() {
  const cwd = process.cwd();
  const { platformDir, relSkill } = resolvePlatform(cwd);
  const commandsDir = join(platformDir, 'commands');
  const settingsPath = join(platformDir, 'settings.json');
  const PERM = 'Bash(node ' + relSkill + '/scripts/*)';
  const run = (script) => '!`node ' + relSkill + '/scripts/' + script + ' $ARGUMENTS`';

  mkdirSync(commandsDir, { recursive: true });

  const commands = [
    {
      file: 'forge-scan.md',
      description: 'Scan the project and create design/design-arch.json',
      hint: '[--theme shadcn|mantine|plain-tailwind] [--schema-v4] [--quick]',
      body: 'Run the UI Forge project scanner.\n\n' + run('scan.js'),
    },
    {
      file: 'forge.md',
      description: 'Generate a component using UI Forge',
      hint: '--task "<task>" --refs <path[,path]> --output <path>',
      body: 'Run UI Forge context preparation. Read the printed context block and generate the component(s).\n\n' + run('invoke.js'),
    },
    {
      file: 'forge-verify.md',
      description: 'Verify a UI Forge–generated component against its contract',
      hint: '<component.tsx> <contract.ts> [--playwright <url>]',
      body: run('verify.js'),
    },
    {
      file: 'forge-export-design.md',
      description: 'Export project design system as a Claude Design–ingestible bundle',
      hint: '[out-dir]',
      body: run('export-design.js'),
    },
  ];

  const written = [];
  for (const { file, description, hint, body } of commands) {
    const content = `---\ndescription: ${description}\nargument-hint: ${hint}\n---\n\n${body}\n`;
    writeFileSync(join(commandsDir, file), content, 'utf8');
    written.push(file);
  }

  let settings = { permissions: { allow: [] } };
  if (existsSync(settingsPath)) {
    try { settings = JSON.parse(readFileSync(settingsPath, 'utf8')); } catch {}
  }
  settings.permissions ??= {};
  settings.permissions.allow ??= [];

  let permAdded = false;
  if (!settings.permissions.allow.includes(PERM)) {
    settings.permissions.allow.push(PERM);
    permAdded = true;
  }
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');

  // Write .forgeignore for StackShift projects if one doesn't already exist
  const stackshiftMarker = join(cwd, '.stackshift', 'installed.json');
  const forgeignorePath = join(cwd, '.forgeignore');
  if (existsSync(stackshiftMarker) && !existsSync(forgeignorePath)) {
    const template = join(SKILL_ROOT, 'references', 'default-stackshift-forgeignore.txt');
    if (existsSync(template)) {
      writeFileSync(forgeignorePath, readFileSync(template, 'utf8'), 'utf8');
      console.log('.forgeignore created from StackShift template.\n');
    }
  }

  console.log('UI Forge install complete.\n');
  console.log(`Commands written to ${commandsDir}:`);
  for (const f of written) console.log(`  ${f}`);
  console.log(`\nSettings: ${settingsPath}`);
  console.log(`  Permission ${permAdded ? 'added' : 'already present'}: ${PERM}`);
}

function getVersion() {
  try { return readFileSync(join(SKILL_ROOT, 'skill.version'), 'utf8').trim(); } catch { return '?'; }
}

function help() {
  console.log(`
UI Forge CLI v${getVersion()}

Usage:
  ui-forge <command> [args...]
  node <skill-root>/scripts/cli.js <command> [args...]

Commands:
  install          Wire slash commands and Bash permissions into the detected platform dir
  scan   [args]    Scan project → design/design-arch.json
                     --quick              Skip AI synthesis (fast, static only)
                     --theme <name>       Seed from shadcn|mantine|plain-tailwind
                     --schema-v4          Extract dark: Tailwind tokens
  forge  [args]    Prepare generation context (read output, then generate)
                     --task "<task>"      What to build (required)
                     --refs <paths>       Comma-separated ref files
                     --output <path>      Target output file
                     --signal <SIGNAL>    Force: CONVERT_SECTION|CONVERT_PAGE|CONVERT_VARIANT
                     --a11y               WCAG 2.1 AA enforcement
                     --creative           Greenfield generation
                     --diff <path>        Iterative surgical edit (CONVERT_SECTION only)
                     --rescan             Re-run scan before generating
                     --replan             Force Stage 1 page plan regeneration
  verify [args]    Verify generated component against its contract
                     <component.tsx> <contract.ts>
                     --playwright <url>   Also take a visual screenshot
  export [args]    Export design-arch.json as a Claude Design bundle
                     [out-dir]            Custom output directory (default: design/claude-design-bundle)
  help             Show this help
`.trim());
}

switch (cmd) {
  case 'install':       install(); break;
  case 'scan':          proxy(SCRIPTS.scan); break;
  case 'forge':         proxy(SCRIPTS.forge); break;
  case 'verify':        proxy(SCRIPTS.verify); break;
  case 'export':        proxy(SCRIPTS.export); break;
  case 'help':
  case '--help':
  case '-h':
  case undefined:       help(); break;
  default:
    console.error(`Unknown command: ${cmd}`);
    console.error('Run "ui-forge help" for usage.');
    process.exit(1);
}
