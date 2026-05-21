/**
 * If the asset being copied is a stackshift theme JSON and the project is not
 * paired, transform it: drop themeOverride + paired signals, add _limited: true.
 * Returns null to skip copying, a string/Buffer to override contents, or
 * undefined to use default copy.
 */
export function maybeTransformAsset(ctx, relPath, contents) {
    if (ctx.theme !== 'stackshift')
        return undefined;
    if (relPath !== 'themes/stackshift.json')
        return undefined;
    if (ctx.paired)
        return undefined;
    let parsed;
    try {
        parsed = JSON.parse(contents.toString('utf8'));
    }
    catch {
        return undefined;
    }
    delete parsed.themeOverride;
    if (parsed.signals && typeof parsed.signals === 'object') {
        const signals = parsed.signals;
        delete signals.SIGNAL_VALIDATE_PAIRED;
        delete signals.PAIRED_A11Y;
    }
    parsed._limited = true;
    return JSON.stringify(parsed, null, 2) + '\n';
}
export function themeLimited(ctx) {
    return ctx.theme === 'stackshift' && !ctx.paired;
}
