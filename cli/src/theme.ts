/**
 * Theme transformations. Implements the limited-mode rewrite for the
 * stackshift theme when the project is not paired.
 */
import type { ThemeId } from './assets.js';

export interface ThemeContext {
  theme: ThemeId;
  paired: boolean;
}

/**
 * If the asset being copied is a stackshift theme JSON and the project is not
 * paired, transform it: drop themeOverride + paired signals, add _limited: true.
 * Returns null to skip copying, a string/Buffer to override contents, or
 * undefined to use default copy.
 */
export function maybeTransformAsset(
  ctx: ThemeContext,
  relPath: string,
  contents: Buffer
): Buffer | string | undefined {
  if (ctx.theme !== 'stackshift') return undefined;
  if (relPath !== 'themes/stackshift.json') return undefined;
  if (ctx.paired) return undefined;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(contents.toString('utf8')) as Record<string, unknown>;
  } catch {
    return undefined;
  }
  delete parsed.themeOverride;
  if (parsed.signals && typeof parsed.signals === 'object') {
    const signals = parsed.signals as Record<string, unknown>;
    delete signals.SIGNAL_VALIDATE_PAIRED;
    delete signals.PAIRED_A11Y;
  }
  parsed._limited = true;
  return JSON.stringify(parsed, null, 2) + '\n';
}

export function themeLimited(ctx: ThemeContext): boolean {
  return ctx.theme === 'stackshift' && !ctx.paired;
}
