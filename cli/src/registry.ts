/**
 * Resolves the skill source root (where the bundled assets live) and reads
 * skill.version. The installer ships inside the `ui-forge` npm package, so
 * the source root is two levels above this file: <pkg>/cli/dist/ → <pkg>/.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

let cachedRoot: string | null = null;

export function getSkillSourceRoot(): string {
  if (cachedRoot) return cachedRoot;
  const here = dirname(fileURLToPath(import.meta.url));
  // dist file lives at <pkg>/cli/dist/registry.js → walk up two dirs.
  const candidate = join(here, '..', '..');
  if (existsSync(join(candidate, 'skill.version'))) {
    cachedRoot = candidate;
    return candidate;
  }
  // Fallback: cwd (useful for in-repo development of the CLI).
  if (existsSync(join(process.cwd(), 'skill.version'))) {
    cachedRoot = process.cwd();
    return process.cwd();
  }
  throw new Error('Cannot locate skill source root (no skill.version found).');
}

export function getSkillVersion(): string {
  const file = join(getSkillSourceRoot(), 'skill.version');
  return readFileSync(file, 'utf8').trim();
}
