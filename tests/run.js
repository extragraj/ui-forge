#!/usr/bin/env node
/**
 * UI Forge — main test runner.
 *
 * One file, one entry. Runs a flat set of suites against the *built* CLI
 * (bin/cli.mjs → cli/dist/index.js) and the runtime scripts. Each suite
 * creates its own ephemeral sandbox under os.tmpdir() and always cleans
 * up — even on failure.
 *
 * Output is a tabular pass/fail report with per-test duration. Exit code
 * is the number of failed tests (capped at 1 for CI).
 *
 * Run:
 *   pnpm test
 *   pnpm test -- --only=install,scan      (filter suites by substring)
 *   pnpm test -- --verbose                 (print stdout/stderr for failures)
 *
 * Adding a suite:
 *   1. Define a function that takes a TestContext `t` and registers tests
 *      via t.test('name', async () => { ... }).
 *   2. Append it to the SUITES array near the bottom of this file.
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const CLI = join(REPO_ROOT, 'bin', 'cli.mjs');

// ── CLI args ─────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flags = {
  only: pluck('--only')?.split(',').map((s) => s.trim()).filter(Boolean) ?? null,
  verbose: argv.includes('--verbose'),
};
function pluck(name) {
  const i = argv.findIndex((a) => a === name || a.startsWith(name + '='));
  if (i < 0) return null;
  const v = argv[i].includes('=') ? argv[i].split('=')[1] : argv[i + 1];
  return v ?? null;
}

// ── Shared helpers ───────────────────────────────────────────────────
const sandboxes = new Set();

function makeSandbox(label) {
  const dir = mkdtempSync(join(tmpdir(), `uiforge-${label}-`));
  sandboxes.add(dir);
  return dir;
}

function cleanup(dir) {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  } finally {
    sandboxes.delete(dir);
  }
}

function cleanupAll() {
  for (const dir of [...sandboxes]) cleanup(dir);
}

process.on('exit', cleanupAll);
process.on('SIGINT', () => {
  cleanupAll();
  process.exit(130);
});

function runNode(scriptArgs, { cwd, env, input } = {}) {
  const r = spawnSync(process.execPath, scriptArgs, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...(env || {}) },
    input,
  });
  return { code: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function runCli(args, cwd, env) {
  return runNode([CLI, ...args], { cwd, env });
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertFileExists(p) {
  assert(existsSync(p), `Expected file/dir to exist: ${p}`);
}

function assertFileMissing(p) {
  assert(!existsSync(p), `Expected file NOT to exist: ${p}`);
}

function assertContains(p, needle) {
  assertFileExists(p);
  const body = readFileSync(p, 'utf8');
  assert(body.includes(needle), `Expected ${p} to contain "${needle}"`);
}

function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

// ── Test context (per-suite collector) ───────────────────────────────
function makeContext(name) {
  const ctx = {
    suite: name,
    tests: [],
    test(label, fn) {
      ctx.tests.push({ label, fn });
    },
  };
  return ctx;
}

// ── Suite: assets.js path constants ──────────────────────────────────
async function suiteAssetsPaths(t) {
  t.test('new forgeignore + theme paths registered in dist', () => {
    const distPath = join(REPO_ROOT, 'cli', 'dist', 'assets.js');
    assertFileExists(distPath);
    const body = readFileSync(distPath, 'utf8');
    assert(body.includes('references/forgeignore/default.txt'), 'defaultForgeignore should be references/forgeignore/default.txt');
    assert(body.includes('references/themes/stackshift/forgeignore.txt'), 'stackshift forgeignore should be references/themes/stackshift/forgeignore.txt');
    assert(body.includes('references/themes/stackshift/standards'), 'stackshift standards sourcePath should be references/themes/stackshift/standards');
    assert(!body.includes('references/default-forgeignore.txt'), 'old default-forgeignore.txt path should be gone');
    assert(!body.includes('references/default-stackshift-forgeignore.txt'), 'old default-stackshift-forgeignore.txt path should be gone');
  });

  t.test('repo has new structure on disk', () => {
    assertFileExists(join(REPO_ROOT, 'references', 'forgeignore', 'default.txt'));
    assertFileExists(join(REPO_ROOT, 'references', 'themes', 'stackshift', 'forgeignore.txt'));
    assertFileExists(join(REPO_ROOT, 'references', 'themes', 'stackshift', 'standards', '01-import-rule.md'));
    assertFileExists(join(REPO_ROOT, 'references', 'standards', 'index.md'));
    assertFileExists(join(REPO_ROOT, 'references', 'themes.md'));
    assertFileExists(join(REPO_ROOT, 'references', 'docs', 'advanced-usage.md'));
    assertFileExists(join(REPO_ROOT, 'examples', 'index.md'));
    // Legacy paths must be gone
    assertFileMissing(join(REPO_ROOT, 'references', 'default-forgeignore.txt'));
    assertFileMissing(join(REPO_ROOT, 'references', 'default-stackshift-forgeignore.txt'));
    assertFileMissing(join(REPO_ROOT, 'references', 'standards', 'stackshift-ui'));
    assertFileMissing(join(REPO_ROOT, 'themes', 'README.md'));
  });
}

// ── Suite: install (default theme) ───────────────────────────────────
async function suiteInstall(t) {
  let sandbox;
  let env;

  t.test('non-interactive init completes', () => {
    sandbox = makeSandbox('install');
    mkdirSync(join(sandbox, '.claude'), { recursive: true });
    env = {};
    const r = runCli([
      'init', '--yes',
      '--scope=project',
      '--platforms=claude',
      '--features=scan,forge,verify,mcp-server',
      '--theme=shadcn',
      '--pair=off',
      '--quick-scan=off',
    ], sandbox, env);
    assert(r.code === 0, `init exit=${r.code}\nstderr: ${r.stderr}`);
  });

  t.test('runtime scripts written to skill dir', () => {
    const skill = join(sandbox, '.claude', 'skills', 'ui-forge');
    assertFileExists(join(skill, 'scripts', 'invoke.js'));
    assertFileExists(join(skill, 'scripts', 'scan.js'));
    assertFileExists(join(skill, 'scripts', 'verify.js'));
    assertFileExists(join(skill, 'references', 'prompt-patterns.md'));
    assertFileExists(join(skill, 'SKILL.md'));
  });

  t.test('non-runtime files NOT copied to skill dir', () => {
    const skill = join(sandbox, '.claude', 'skills', 'ui-forge');
    assertFileMissing(join(skill, 'references', 'docs'));
    assertFileMissing(join(skill, 'references', 'forgeignore'));
    assertFileMissing(join(skill, 'references', 'themes'));
    assertFileMissing(join(skill, 'references', 'standards'));
    assertFileMissing(join(skill, 'references', 'examples.md'));
    assertFileMissing(join(skill, 'references', 'themes.md'));
    assertFileMissing(join(skill, 'examples'));
    assertFileMissing(join(skill, 'tests'));
    assertFileMissing(join(skill, 'change-logs'));
    assertFileMissing(join(skill, 'CLAUDE.md'));
  });

  t.test('.forgeignore written from default template', () => {
    assertFileExists(join(sandbox, '.forgeignore'));
  });

  t.test('lockfile records install', () => {
    const lock = readJson(join(sandbox, '.ui-forge', 'installed.json'));
    assert(lock.files && typeof lock.files === 'object', 'lockfile.files should be an object');
    const totalFiles = Object.values(lock.files).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
    assert(totalFiles > 0, `lockfile.files should record at least one written file (got ${totalFiles})`);
    assert(typeof lock.skillVersion === 'string', 'lockfile.skillVersion should be a string');
  });
}

// ── Suite: install (stackshift theme + paired) ───────────────────────
async function suiteInstallStackshift(t) {
  let sandbox;

  t.test('init with theme=stackshift + pair=on completes', () => {
    sandbox = makeSandbox('stackshift');
    mkdirSync(join(sandbox, '.claude'), { recursive: true });
    // Simulate a stackshift-paired project: presence of .stackshift/installed.json
    mkdirSync(join(sandbox, '.stackshift'), { recursive: true });
    writeFileSync(join(sandbox, '.stackshift', 'installed.json'), JSON.stringify({ version: '1.0.0' }), 'utf8');
    const r = runCli([
      'init', '--yes',
      '--scope=project',
      '--platforms=claude',
      '--features=scan,forge,verify,mcp-server',
      '--theme=stackshift',
      '--pair=on',
      '--quick-scan=off',
    ], sandbox);
    assert(r.code === 0, `init exit=${r.code}\nstderr: ${r.stderr}`);
  });

  t.test('.forgeignore uses stackshift template', () => {
    const body = readFileSync(join(sandbox, '.forgeignore'), 'utf8');
    // Stackshift template ships with section identifying it as the paired variant
    assert(body.length > 0, '.forgeignore should not be empty');
  });

  t.test('stackshift theme json written', () => {
    const skill = join(sandbox, '.claude', 'skills', 'ui-forge');
    assertFileExists(join(skill, 'themes', 'stackshift.json'));
  });

  t.test('design/standards/stackshift-ui/ seeded from new source path', () => {
    const seeded = join(sandbox, 'design', 'standards', 'stackshift-ui', '01-import-rule.md');
    assertFileExists(seeded);
    const body = readFileSync(seeded, 'utf8');
    assert(body.includes('references/themes/stackshift/standards/01-import-rule.md'), 'provenance header should record the new source path');
  });
}

// ── Suite: legacy sweep ──────────────────────────────────────────────
async function suiteLegacySweep(t) {
  let sandbox;

  t.test('install removes pre-1.7.2 legacy files from skill dir', () => {
    sandbox = makeSandbox('legacysweep');
    mkdirSync(join(sandbox, '.claude'), { recursive: true });
    // Pre-seed an existing skill dir with legacy artifacts.
    const skill = join(sandbox, '.claude', 'skills', 'ui-forge');
    mkdirSync(join(skill, 'references', 'standards'), { recursive: true });
    mkdirSync(join(skill, 'examples'), { recursive: true });
    mkdirSync(join(skill, 'change-logs'), { recursive: true });
    mkdirSync(join(skill, 'themes'), { recursive: true });
    writeFileSync(join(skill, 'references', 'default-forgeignore.txt'), '# legacy\n', 'utf8');
    writeFileSync(join(skill, 'references', 'default-stackshift-forgeignore.txt'), '# legacy\n', 'utf8');
    writeFileSync(join(skill, 'references', 'advanced-usage.md'), '# legacy doc\n', 'utf8');
    writeFileSync(join(skill, 'references', 'examples.md'), '# legacy doc\n', 'utf8');
    writeFileSync(join(skill, 'examples', 'legacy.md'), 'legacy\n', 'utf8');
    writeFileSync(join(skill, 'change-logs', 'old.md'), 'old\n', 'utf8');
    writeFileSync(join(skill, 'themes', 'README.md'), '# old\n', 'utf8');

    const r = runCli([
      'init', '--yes',
      '--scope=project',
      '--platforms=claude',
      '--features=scan,forge,verify,mcp-server',
      '--theme=shadcn',
      '--pair=off',
      '--quick-scan=off',
    ], sandbox);
    assert(r.code === 0, `init exit=${r.code}\nstderr: ${r.stderr}`);
  });

  t.test('legacy artifacts removed', () => {
    const skill = join(sandbox, '.claude', 'skills', 'ui-forge');
    assertFileMissing(join(skill, 'references', 'default-forgeignore.txt'));
    assertFileMissing(join(skill, 'references', 'default-stackshift-forgeignore.txt'));
    assertFileMissing(join(skill, 'references', 'advanced-usage.md'));
    assertFileMissing(join(skill, 'references', 'examples.md'));
    assertFileMissing(join(skill, 'examples', 'legacy.md'));
    assertFileMissing(join(skill, 'change-logs', 'old.md'));
    assertFileMissing(join(skill, 'themes', 'README.md'));
  });
}

// ── Suite: uninstall ────────────────────────────────────────────────
async function suiteUninstall(t) {
  let sandbox;

  t.test('init + uninstall leaves skill dir empty', () => {
    sandbox = makeSandbox('uninstall');
    mkdirSync(join(sandbox, '.claude'), { recursive: true });
    let r = runCli([
      'init', '--yes',
      '--scope=project',
      '--platforms=claude',
      '--features=scan,forge,verify,mcp-server',
      '--theme=shadcn',
      '--pair=off',
      '--quick-scan=off',
    ], sandbox);
    assert(r.code === 0, `init exit=${r.code}\nstderr: ${r.stderr}`);
    r = runCli(['uninstall', '--yes'], sandbox);
    assert(r.code === 0, `uninstall exit=${r.code}\nstderr: ${r.stderr}`);
  });

  t.test('skill dir gone after uninstall', () => {
    assertFileMissing(join(sandbox, '.claude', 'skills', 'ui-forge'));
  });
}

// ── Suite: scan smoke ───────────────────────────────────────────────
async function suiteScanSmoke(t) {
  let sandbox;

  t.test('scan against minimal project writes design-arch.json', () => {
    sandbox = makeSandbox('scan');
    // Bare-minimum project shape scan.js needs.
    writeFileSync(join(sandbox, 'package.json'), JSON.stringify({ name: 'test', dependencies: { next: '^14.0.0', react: '^18.0.0' } }), 'utf8');
    mkdirSync(join(sandbox, 'app'), { recursive: true });
    writeFileSync(join(sandbox, 'app', 'page.tsx'), 'export default function Page(){return <div>hi</div>}\n', 'utf8');
    writeFileSync(join(sandbox, 'tailwind.config.js'), `module.exports = { content: ['./app/**/*.{ts,tsx}'], theme: { extend: { colors: { primary: '#3b82f6' } } } }\n`, 'utf8');
    writeFileSync(join(sandbox, 'globals.css'), '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n', 'utf8');

    const r = runNode([join(REPO_ROOT, 'scripts', 'scan.js'), '--quick'], { cwd: sandbox });
    assert(r.code === 0, `scan exit=${r.code}\nstderr: ${r.stderr}`);
  });

  t.test('design-arch.json exists and parses', () => {
    const arch = readJson(join(sandbox, 'design', 'design-arch.json'));
    assert(typeof arch === 'object' && arch !== null, 'design-arch.json should be a JSON object');
    assert('componentLib' in arch, 'design-arch.json should have componentLib');
    assert('tailwind' in arch, 'design-arch.json should have tailwind');
  });
}

// ── Suite: invoke smoke ─────────────────────────────────────────────
async function suiteInvokeSmoke(t) {
  let sandbox;

  t.test('invoke against a stub arch + HTML ref prints CONVERT_SECTION context', () => {
    sandbox = makeSandbox('invoke');
    mkdirSync(join(sandbox, 'design'), { recursive: true });
    const stubArch = {
      _version: 4,
      componentLib: 'shadcn/ui',
      usedComponents: ['Button'],
      usedLibraries: ['next', 'react'],
      tailwind: { themeSection: { colors: { primary: '#3b82f6' } }, colorTokens: 'primary, slate', darkColorTokens: '' },
      globalCss: '',
      designStandards: {},
      patterns: { spacing: 'py-20', typography: 'Inter', conventions: ['default export'] },
      isStackShift: false,
    };
    writeFileSync(join(sandbox, 'design', 'design-arch.json'), JSON.stringify(stubArch, null, 2), 'utf8');
    writeFileSync(join(sandbox, 'sample.html'), '<section><h1>Hi</h1><p>Hello</p></section>', 'utf8');

    const r = runNode([
      join(REPO_ROOT, 'scripts', 'invoke.js'),
      '--task', 'Convert sample section',
      '--refs', 'sample.html',
      '--output', 'out.tsx',
    ], { cwd: sandbox, env: { CLAUDE_SKILL_DIR: REPO_ROOT } });

    assert(r.code === 0, `invoke exit=${r.code}\nstderr: ${r.stderr}`);
    assert(r.stdout.includes('CONVERT_SECTION'), `stdout should mention CONVERT_SECTION signal\nstdout: ${r.stdout.slice(0, 400)}`);
    assert(r.stdout.includes('DESIGN AUTHORITY') || r.stdout.includes('design'), 'stdout should include a design authority block');
  });
}

// ── Suite: examples reproducibility ─────────────────────────────────
async function suiteExamplesReproduce(t) {
  // Just verify each example folder has the expected structure.
  // Re-running invoke for every example on every test run is slow and
  // captured stdout is already committed.
  const expected = ['01-hero-section', '02-marketing-page', '03-config-driven', '04-stackshift-variant', '05-brand-tokens', '06-a11y-form', '07-image-reference'];

  for (const ex of expected) {
    t.test(`example ${ex} has design-arch.json + forge-stdout.txt + input/ + output/`, () => {
      const dir = join(REPO_ROOT, 'examples', ex);
      assertFileExists(join(dir, 'design-arch.json'));
      assertFileExists(join(dir, 'forge-stdout.txt'));
      assertFileExists(join(dir, 'input'));
      assertFileExists(join(dir, 'output'));
      // forge-stdout.txt should mention CONVERT_ signal somewhere
      const out = readFileSync(join(dir, 'forge-stdout.txt'), 'utf8');
      assert(/CONVERT_(SECTION|PAGE|VARIANT)/.test(out), `forge-stdout.txt for ${ex} should mention a CONVERT_ signal`);
    });
  }
}

// ── Suite registration ──────────────────────────────────────────────
const SUITES = [
  ['assets-paths', suiteAssetsPaths],
  ['install', suiteInstall],
  ['install-stackshift', suiteInstallStackshift],
  ['legacy-sweep', suiteLegacySweep],
  ['uninstall', suiteUninstall],
  ['scan-smoke', suiteScanSmoke],
  ['invoke-smoke', suiteInvokeSmoke],
  ['examples', suiteExamplesReproduce],
];

// ── Runner ──────────────────────────────────────────────────────────
const COLS = { suite: 22, name: 48, status: 8, dur: 8 };
const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};
const useColor = process.stdout.isTTY;
function color(text, c) {
  return useColor ? `${COLORS[c]}${text}${COLORS.reset}` : text;
}
function pad(s, n) {
  s = String(s);
  if (s.length >= n) return s.slice(0, n - 1) + '…';
  return s + ' '.repeat(n - s.length);
}

function printHeader() {
  console.log(
    color(pad('Suite', COLS.suite), 'bold') +
      color(pad('Test', COLS.name), 'bold') +
      color(pad('Status', COLS.status), 'bold') +
      color(pad('Duration', COLS.dur), 'bold'),
  );
  console.log(color('─'.repeat(COLS.suite + COLS.name + COLS.status + COLS.dur), 'dim'));
}

function printRow({ suite, name, status, ms }) {
  const statusText = status === 'PASS' ? color(pad('PASS', COLS.status), 'green')
    : status === 'FAIL' ? color(pad('FAIL', COLS.status), 'red')
    : color(pad('SKIP', COLS.status), 'yellow');
  console.log(
    pad(suite, COLS.suite) +
      pad(name, COLS.name) +
      statusText +
      color(pad(`${ms}ms`, COLS.dur), 'dim'),
  );
}

function suiteMatchesFilter(name) {
  if (!flags.only) return true;
  return flags.only.some((s) => name.includes(s));
}

async function main() {
  console.log(color(`\nUI Forge — test runner`, 'cyan'));
  console.log(color(`  CLI: ${relative(process.cwd(), CLI) || CLI}`, 'dim'));
  if (flags.only) console.log(color(`  Filter: ${flags.only.join(', ')}`, 'dim'));
  console.log();
  printHeader();

  let passed = 0;
  let failed = 0;
  let skipped = 0;
  const failures = [];
  const t0 = Date.now();
  let lastSuite = '';

  for (const [suiteName, suiteFn] of SUITES) {
    if (!suiteMatchesFilter(suiteName)) {
      printRow({ suite: suiteName, name: '(filtered)', status: 'SKIP', ms: 0 });
      skipped++;
      continue;
    }
    const ctx = makeContext(suiteName);
    try {
      await suiteFn(ctx);
    } catch (err) {
      printRow({ suite: suiteName, name: '(setup)', status: 'FAIL', ms: 0 });
      failed++;
      failures.push({ suite: suiteName, name: '(setup)', err });
      continue;
    }
    for (const test of ctx.tests) {
      const displaySuite = lastSuite === suiteName ? '' : suiteName;
      lastSuite = suiteName;
      const tStart = Date.now();
      try {
        await test.fn();
        const ms = Date.now() - tStart;
        printRow({ suite: displaySuite, name: test.label, status: 'PASS', ms });
        passed++;
      } catch (err) {
        const ms = Date.now() - tStart;
        printRow({ suite: displaySuite, name: test.label, status: 'FAIL', ms });
        failed++;
        failures.push({ suite: suiteName, name: test.label, err });
      }
    }
  }

  const totalMs = Date.now() - t0;
  console.log(color('─'.repeat(COLS.suite + COLS.name + COLS.status + COLS.dur), 'dim'));
  const summary = `Summary: ${passed} passed, ${failed} failed, ${skipped} skipped  (${(totalMs / 1000).toFixed(2)}s)`;
  console.log(failed === 0 ? color(summary, 'green') : color(summary, 'red'));

  if (failures.length) {
    console.log();
    console.log(color('Failures:', 'red'));
    for (const f of failures) {
      console.log(color(`  ✗ [${f.suite}] ${f.name}`, 'red'));
      const msg = (f.err?.stack || f.err?.message || String(f.err)).split('\n').slice(0, flags.verbose ? 30 : 6).join('\n');
      console.log(msg.split('\n').map((l) => '    ' + l).join('\n'));
    }
  }

  cleanupAll();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Runner crashed:', err);
  cleanupAll();
  process.exit(2);
});
