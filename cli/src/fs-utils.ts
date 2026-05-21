/**
 * Filesystem helpers — atomic writes, recursive copy with manifest tracking,
 * JSON deep-merge, .bak backups. Stdlib only.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, posix, relative, sep } from 'node:path';

export function ensureDir(path: string): void {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

export function toPosix(p: string): string {
  return p.split(sep).join('/');
}

export function fromPosix(p: string): string {
  return p.split('/').join(sep);
}

/**
 * Atomic write: write to *.tmp then rename. Prevents half-written files on crash.
 */
export function atomicWrite(path: string, content: string | Buffer): void {
  ensureDir(dirname(path));
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, content);
  renameSync(tmp, path);
}

/**
 * Create a .bak sibling if it doesn't already exist. Idempotent.
 */
export function backupOnce(path: string): void {
  if (!existsSync(path)) return;
  const bak = `${path}.bak`;
  if (existsSync(bak)) return;
  copyFileSync(path, bak);
}

/**
 * Recursively walk a directory and return relative posix paths of every file.
 */
export function walk(root: string, rel = ''): string[] {
  const abs = rel ? join(root, fromPosix(rel)) : root;
  if (!existsSync(abs)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...walk(root, childRel));
    } else if (entry.isFile()) {
      out.push(childRel);
    }
  }
  return out;
}

/**
 * Copy a single file from source to dest, creating parent dirs.
 */
export function copyFile(src: string, dest: string): void {
  ensureDir(dirname(dest));
  copyFileSync(src, dest);
}

/**
 * Copy an asset spec (a file or directory ending with /) from sourceRoot
 * into destRoot, preserving relative paths. Returns the list of dest paths
 * actually written.
 */
export function copyAsset(
  sourceRoot: string,
  destRoot: string,
  relPath: string,
  options: { transform?: (rel: string, contents: Buffer) => Buffer | string | null } = {}
): string[] {
  const srcAbs = join(sourceRoot, fromPosix(relPath));
  if (!existsSync(srcAbs)) {
    throw new Error(`Asset not found at source: ${relPath}`);
  }
  const written: string[] = [];
  const stat = statSync(srcAbs);
  if (stat.isDirectory()) {
    const dirRel = relPath.endsWith('/') ? relPath.slice(0, -1) : relPath;
    for (const file of walk(srcAbs)) {
      const subRel = `${dirRel}/${file}`;
      const dest = join(destRoot, fromPosix(subRel));
      writeWithTransform(join(srcAbs, fromPosix(file)), dest, subRel, options.transform);
      written.push(toPosix(relative(destRoot, dest)));
    }
  } else {
    const dest = join(destRoot, fromPosix(relPath));
    writeWithTransform(srcAbs, dest, relPath, options.transform);
    written.push(toPosix(relative(destRoot, dest)));
  }
  return written;
}

function writeWithTransform(
  src: string,
  dest: string,
  rel: string,
  transform?: (rel: string, contents: Buffer) => Buffer | string | null
): void {
  ensureDir(dirname(dest));
  if (transform) {
    const result = transform(rel, readFileSync(src));
    if (result === null) return;
    atomicWrite(dest, result);
  } else {
    copyFile(src, dest);
  }
}

/**
 * Read JSON file or return undefined if missing.
 */
export function readJsonSafe<T = unknown>(path: string): T | undefined {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return undefined;
  }
}

export function readJson<T = unknown>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function writeJson(path: string, value: unknown): void {
  atomicWrite(path, JSON.stringify(value, null, 2) + '\n');
}

/**
 * Deep-merge two plain objects. Arrays are concatenated and deduped (string-equality).
 * Used for settings.json / mcp config patches.
 */
export function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const out: Record<string, unknown> = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue;
    const existing = out[key];
    if (Array.isArray(value)) {
      const base = Array.isArray(existing) ? existing : [];
      const merged: unknown[] = [...base];
      for (const item of value) {
        if (!merged.some((m) => JSON.stringify(m) === JSON.stringify(item))) {
          merged.push(item);
        }
      }
      out[key] = merged;
    } else if (value !== null && typeof value === 'object' && !Array.isArray(existing)) {
      out[key] = deepMerge(
        (existing as Record<string, unknown>) ?? {},
        value as Record<string, unknown>
      );
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

export function removeFile(path: string): void {
  if (existsSync(path)) rmSync(path, { force: true });
}

export function removeDir(path: string): void {
  if (existsSync(path)) rmSync(path, { recursive: true, force: true });
}

export function isDirEmpty(path: string): boolean {
  if (!existsSync(path)) return true;
  return readdirSync(path).length === 0;
}

export function pruneEmptyDirs(root: string): void {
  if (!existsSync(root)) return;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const child = join(root, entry.name);
      pruneEmptyDirs(child);
      if (isDirEmpty(child)) rmSync(child, { recursive: true, force: true });
    }
  }
}

/**
 * Resolve POSIX-style permission match strings: skill base + script path joined with /.
 * Always uses posix separators so Claude Code's matcher works on Windows.
 */
export function permissionPath(skillBase: string, scriptRel: string): string {
  return `Bash(node ${posix.join(toPosix(skillBase), scriptRel)}:*)`;
}
