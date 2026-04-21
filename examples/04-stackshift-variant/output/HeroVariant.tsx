// FORGE NOTES
// Signal: CONVERT_VARIANT
// Anti-slop: verified (no generic gradients, no filler CTAs, density matches contract)
//
// CONTRACT
//   file: ./examples/04-stackshift-variant/input/HeroProps.ts
//   interface: HeroVariantProps
//   version: 1.0.0
//   props consumed:
//     - headline: destructured → rendered as <h1>
//     - subheadline: optional → destructured with ?? undefined → rendered conditionally
//     - ctaLabel: destructured → rendered as <a> text
//     - ctaHref: destructured → rendered as <a href>
//     - backgroundImage: optional → destructured with ?? undefined → conditionally renders Image
//     - theme: optional → destructured with ?? undefined → drives dark/light class variant
//   fallback rule verified: `if (!headline || !ctaLabel || !ctaHref) return null`
//   exports: default only (contract invariant satisfied)
//
// Token mappings (design-arch dependent — adjust to your project's tokens):
//   light theme bg: bg-slate-50  |  dark theme bg: bg-slate-900
//   light headline: text-slate-900  |  dark headline: text-white
//   light subtitle: text-slate-500  |  dark subtitle: text-slate-300
//   CTA: bg-blue-600 text-white → hover:bg-blue-700
//
// Divergences:
//   No image ref provided — layout keeps image block minimal and optional.
//   theme defaults to 'light' (via ?? undefined; not a fallback object).

import Image from 'next/image'
import type { HeroVariantProps } from './HeroProps'

export default function HeroVariant({
  headline,
  subheadline,
  ctaLabel,
  ctaHref,
  backgroundImage,
  theme,
}: HeroVariantProps) {
  if (!headline || !ctaLabel || !ctaHref) return null

  const resolvedTheme = theme ?? undefined
  const isDark = resolvedTheme === 'dark'

  return (
    <section
      className={[
        'grid grid-cols-1 md:grid-cols-2 gap-10 py-20 px-10',
        isDark ? 'bg-slate-900' : 'bg-slate-50',
      ].join(' ')}
    >
      <div className="flex flex-col justify-center">
        <h1 className={['text-4xl font-bold leading-tight', isDark ? 'text-white' : 'text-slate-900'].join(' ')}>
          {headline}
        </h1>
        {subheadline && (
          <p className={['mt-4 text-lg', isDark ? 'text-slate-300' : 'text-slate-500'].join(' ')}>
            {subheadline}
          </p>
        )}
        <a
          href={ctaHref}
          className="mt-8 self-start inline-block px-6 py-3 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 transition-colors"
        >
          {ctaLabel}
        </a>
      </div>

      {backgroundImage && (
        <div className="hidden md:flex items-center justify-end">
          <Image
            src={backgroundImage.url}
            alt={backgroundImage.alt}
            width={backgroundImage.width}
            height={backgroundImage.height}
            className="rounded-xl shadow-lg w-full max-w-[520px]"
            priority
          />
        </div>
      )}
    </section>
  )
}
