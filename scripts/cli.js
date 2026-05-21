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
  mcp:    join(__dirname, 'mcp-server.js'),
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
  const cwdNorm = cwd.replace(/\\/g, '/');
  // Local install: skill is inside the project directory
  const isLocal = skillNorm.startsWith(cwdNorm.endsWith('/') ? cwdNorm : cwdNorm + '/');
  for (const [relSkill, platformKey] of PLATFORM_MAP) {
    if (!skillNorm.includes('/' + relSkill)) continue;
    return {
      platformDir: join(cwd, ...platformKey.split('/')),
      // Global installs use the absolute skill path so commands resolve correctly
      relSkill: isLocal ? relSkill : SKILL_ROOT,
    };
  }
  // Fallback: global install or unknown layout — default to .claude in cwd
  return { platformDir: join(cwd, '.claude'), relSkill: isLocal ? '.claude/skills/ui-forge' : SKILL_ROOT };
}

// Resolve the skill path to reference inside a specific platform's command/permission files.
// Preference order, per platform target:
//   1. If the skill is installed at this platform's own location (e.g. `.claude/skills/ui-forge`
//      for the `.claude` platform), use that relative path — keeps each platform self-contained.
//   2. Otherwise fall back to the actual skill location: a relative path if the skill is inside
//      cwd, or the absolute SKILL_ROOT if it's installed globally.
function relSkillForPlatform(cwd, platformDir, fallbackRelSkill) {
  const platformDirNorm = platformDir.replace(/\\/g, '/');
  const cwdNorm = cwd.replace(/\\/g, '/');
  const platformKey = platformDirNorm.startsWith(cwdNorm)
    ? platformDirNorm.slice(cwdNorm.length).replace(/^\//, '')
    : null;
  if (platformKey) {
    for (const [relSkill, key] of PLATFORM_MAP) {
      if (key !== platformKey) continue;
      const candidateAbs = join(cwd, ...relSkill.split('/'));
      if (existsSync(candidateAbs)) return relSkill;
      break;
    }
  }
  return fallbackRelSkill;
}

function install() {
  const cwd = process.cwd();
  const { platformDir: primaryDir, relSkill: fallbackRelSkill } = resolvePlatform(cwd);

  // Collect ALL agentic platform dirs to install into.
  // Always include the primary (detected or default) platform; also add every
  // other platform dir that already exists in cwd so slash commands and
  // permissions are wired for every agent the project uses.
  const targetDirs = new Set([primaryDir]);
  for (const [, platformKey] of PLATFORM_MAP) {
    const dir = join(cwd, ...platformKey.split('/'));
    if (existsSync(dir)) targetDirs.add(dir);
  }

  const buildCommands = (relSkill) => {
    const run = (script) => '!`node ' + relSkill + '/scripts/' + script + ' $ARGUMENTS`';
    return [
      {
        file: 'forge-scan.md',
        description: 'Scan the project and create design/design-arch.json',
        hint: '[--theme shadcn|mantine|plain-tailwind|stackshift] [--theme-override] [--no-backup] [--schema-v4] [--quick]',
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
  };

  const results = [];
  for (const platDir of targetDirs) {
    const relSkill = relSkillForPlatform(cwd, platDir, fallbackRelSkill);
    const PERM = 'Bash(node ' + relSkill + '/scripts/*)';
    const commands = buildCommands(relSkill);

    const commandsDir = join(platDir, 'commands');
    const settingsPath = join(platDir, 'settings.json');
    mkdirSync(commandsDir, { recursive: true });

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
    results.push({ commandsDir, settingsPath, written, permAdded, relSkill, perm: PERM });
  }

  // Write .forgeignore from the general template if one doesn't already exist
  const forgeignorePath = join(cwd, '.forgeignore');
  if (!existsSync(forgeignorePath)) {
    const template = join(SKILL_ROOT, 'references', 'default-forgeignore.txt');
    if (existsSync(template)) {
      writeFileSync(forgeignorePath, readFileSync(template, 'utf8'), 'utf8');
      console.log('.forgeignore created from default template.\n');
    }
  }

  console.log('UI Forge install complete.\n');
  for (const { commandsDir, settingsPath, written, permAdded, relSkill, perm } of results) {
    console.log(`Commands written to ${commandsDir} (skill: ${relSkill}):`);
    for (const f of written) console.log(`  ${f}`);
    console.log(`\nSettings: ${settingsPath}`);
    console.log(`  Permission ${permAdded ? 'added' : 'already present'}: ${perm}`);
    console.log('');
  }
}

function mcpConfig() {
  const serverPath = SCRIPTS.mcp;
  const snippet = {
    mcpServers: {
      'ui-forge': {
        command: 'node',
        args: [serverPath],
      },
    },
  };
  console.log('UI Forge MCP server config\n');
  console.log('Add this to your MCP client settings (Cline, Cursor, Claude Code, Codex, etc.):\n');
  console.log(JSON.stringify(snippet, null, 2));
  console.log('\nClient-specific files:');
  console.log('  Cline (VS Code):     %APPDATA%\\Code\\User\\globalStorage\\saoudrizwan.claude-dev\\settings\\cline_mcp_settings.json');
  console.log('  Claude Code:         ~/.claude.json   (mcpServers key)');
  console.log('  Cursor:              ~/.cursor/mcp.json');
  console.log('  Codex:               ~/.codex/config.toml (use [mcp_servers.ui-forge] section)');
  console.log('\nServer path: ' + serverPath);
  console.log('Restart the client after editing the config.');
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
                     --theme <name>       Seed from shadcn|mantine|plain-tailwind|stackshift
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
  mcp              Run the MCP server (stdio). Use this in your MCP client config.
  mcp-config       Print the JSON snippet to register the MCP server with your CLI
  help             Show this help
`.trim());
}

switch (cmd) {
  case 'install':       install(); break;
  case 'scan':          proxy(SCRIPTS.scan); break;
  case 'forge':         proxy(SCRIPTS.forge); break;
  case 'verify':        proxy(SCRIPTS.verify); break;
  case 'export':        proxy(SCRIPTS.export); break;
  case 'mcp':           proxy(SCRIPTS.mcp); break;
  case 'mcp-config':    mcpConfig(); break;
  case 'help':
  case '--help':
  case '-h':
  case undefined:       help(); break;
  default:
    console.error(`Unknown command: ${cmd}`);
    console.error('Run "ui-forge help" for usage.');
    process.exit(1);
}
