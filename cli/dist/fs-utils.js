/**
 * Filesystem helpers — atomic writes, recursive copy with manifest tracking,
 * JSON deep-merge, .bak backups. Stdlib only.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync, } from 'node:fs';
import { dirname, join, posix, relative, sep } from 'node:path';
export function ensureDir(path) {
    if (!existsSync(path))
        mkdirSync(path, { recursive: true });
}
export function toPosix(p) {
    return p.split(sep).join('/');
}
export function fromPosix(p) {
    return p.split('/').join(sep);
}
/**
 * Atomic write: write to *.tmp then rename. Prevents half-written files on crash.
 */
export function atomicWrite(path, content) {
    ensureDir(dirname(path));
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, content);
    renameSync(tmp, path);
}
/**
 * Create a .bak sibling if it doesn't already exist. Idempotent.
 */
export function backupOnce(path) {
    if (!existsSync(path))
        return;
    const bak = `${path}.bak`;
    if (existsSync(bak))
        return;
    copyFileSync(path, bak);
}
/**
 * Recursively walk a directory and return relative posix paths of every file.
 */
export function walk(root, rel = '') {
    const abs = rel ? join(root, fromPosix(rel)) : root;
    if (!existsSync(abs))
        return [];
    const out = [];
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
        const childRel = rel ? `${rel}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
            out.push(...walk(root, childRel));
        }
        else if (entry.isFile()) {
            out.push(childRel);
        }
    }
    return out;
}
/**
 * Copy a single file from source to dest, creating parent dirs.
 */
export function copyFile(src, dest) {
    ensureDir(dirname(dest));
    copyFileSync(src, dest);
}
/**
 * Copy an asset spec (a file or directory ending with /) from sourceRoot
 * into destRoot, preserving relative paths. Returns the list of dest paths
 * actually written.
 */
export function copyAsset(sourceRoot, destRoot, relPath, options = {}) {
    const srcAbs = join(sourceRoot, fromPosix(relPath));
    if (!existsSync(srcAbs)) {
        throw new Error(`Asset not found at source: ${relPath}`);
    }
    const written = [];
    const stat = statSync(srcAbs);
    if (stat.isDirectory()) {
        const dirRel = relPath.endsWith('/') ? relPath.slice(0, -1) : relPath;
        for (const file of walk(srcAbs)) {
            const subRel = `${dirRel}/${file}`;
            const dest = join(destRoot, fromPosix(subRel));
            writeWithTransform(join(srcAbs, fromPosix(file)), dest, subRel, options.transform);
            written.push(toPosix(relative(destRoot, dest)));
        }
    }
    else {
        const dest = join(destRoot, fromPosix(relPath));
        writeWithTransform(srcAbs, dest, relPath, options.transform);
        written.push(toPosix(relative(destRoot, dest)));
    }
    return written;
}
function writeWithTransform(src, dest, rel, transform) {
    ensureDir(dirname(dest));
    if (transform) {
        const result = transform(rel, readFileSync(src));
        if (result === null)
            return;
        atomicWrite(dest, result);
    }
    else {
        copyFile(src, dest);
    }
}
/**
 * Read JSON file or return undefined if missing.
 */
export function readJsonSafe(path) {
    if (!existsSync(path))
        return undefined;
    try {
        return JSON.parse(readFileSync(path, 'utf8'));
    }
    catch {
        return undefined;
    }
}
export function readJson(path) {
    return JSON.parse(readFileSync(path, 'utf8'));
}
export function writeJson(path, value) {
    atomicWrite(path, JSON.stringify(value, null, 2) + '\n');
}
/**
 * Deep-merge two plain objects. Arrays are concatenated and deduped (string-equality).
 * Used for settings.json / mcp config patches.
 */
export function deepMerge(target, source) {
    const out = { ...target };
    for (const [key, value] of Object.entries(source)) {
        if (value === undefined)
            continue;
        const existing = out[key];
        if (Array.isArray(value)) {
            const base = Array.isArray(existing) ? existing : [];
            const merged = [...base];
            for (const item of value) {
                if (!merged.some((m) => JSON.stringify(m) === JSON.stringify(item))) {
                    merged.push(item);
                }
            }
            out[key] = merged;
        }
        else if (value !== null && typeof value === 'object' && !Array.isArray(existing)) {
            out[key] = deepMerge(existing ?? {}, value);
        }
        else {
            out[key] = value;
        }
    }
    return out;
}
export function removeFile(path) {
    if (existsSync(path))
        rmSync(path, { force: true });
}
export function removeDir(path) {
    if (existsSync(path))
        rmSync(path, { recursive: true, force: true });
}
export function isDirEmpty(path) {
    if (!existsSync(path))
        return true;
    return readdirSync(path).length === 0;
}
export function pruneEmptyDirs(root) {
    if (!existsSync(root))
        return;
    for (const entry of readdirSync(root, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            const child = join(root, entry.name);
            pruneEmptyDirs(child);
            if (isDirEmpty(child))
                rmSync(child, { recursive: true, force: true });
        }
    }
}
/**
 * Resolve POSIX-style permission match strings: skill base + script path joined with /.
 * Always uses posix separators so Claude Code's matcher works on Windows.
 */
export function permissionPath(skillBase, scriptRel) {
    return `Bash(node ${posix.join(toPosix(skillBase), scriptRel)}:*)`;
}
