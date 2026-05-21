/**
 * Copy the appropriate .forgeignore template to the project root.
 * Default template for most themes; stackshift template only when paired.
 */
import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ensureDir, fromPosix } from '../fs-utils.js';

export interface ForgeignoreArgs {
  cwd: string;
  sourceRoot: string;
  sourceRel: string;
  dryRun: boolean;
}

export function writeForgeignore(args: ForgeignoreArgs): string | null {
  const src = join(args.sourceRoot, fromPosix(args.sourceRel));
  const dest = join(args.cwd, '.forgeignore');
  if (!existsSync(src)) return null;
  if (existsSync(dest)) return null; // never overwrite user-customized
  if (args.dryRun) return dest;
  ensureDir(args.cwd);
  copyFileSync(src, dest);
  return dest;
}
