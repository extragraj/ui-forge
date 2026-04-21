// FORGE NOTES
// Ref: HTML (inline styles + <style> block)
// Signal: CONVERT_SECTION
//
// Token mappings:
//   #f8fafc  → bg-slate-50      |  #0f172a  → text-slate-900
//   #475569  → text-slate-500   |  #94a3b8  → text-slate-400
//   #2563eb  → bg-blue-600      |  #fff     → text-white
//   padding 80px 40px           → py-20 px-10
//   gap 2rem                    → gap-8
//   grid-template-columns 1fr 1fr → grid-cols-1 md:grid-cols-2
//   border-radius 12px          → rounded-xl
//   box-shadow 0 8px 32px       → shadow-xl
//   font-size 2.5rem            → text-4xl (closest scale)
//   font-size 1.125rem          → text-lg
//   font-size 0.875rem          → text-sm
//
// Import swaps:
//   <img>  → next/image (Image)
//
// Divergences:
//   max-width 1200px container: moved to parent layout responsibility (not on section)
//   hero-note color #94a3b8 → text-slate-400 (one step lighter than slate-500, acceptable match)
//
// Responsive: sm:hidden on media column matches original @media max-width:768px rule

import Image from 'next/image'

interface HeroSectionProps {
  title: string
  subtitle: string
  ctaLabel: string
  ctaHref: string
  note?: string
  imageSrc: string
  imageAlt?: string
}

export default function HeroSection({
  title,
  subtitle,
  ctaLabel,
  ctaHref,
  note,
  imageSrc,
  imageAlt = '',
}: HeroSectionProps) {
  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-8 py-20 px-10 bg-slate-50">
      <div className="flex flex-col justify-center">
        <h1 className="text-4xl font-bold text-slate-900 leading-tight">{title}</h1>
        <p className="mt-4 text-lg text-slate-500 max-w-[440px]">{subtitle}</p>
        <a
          href={ctaHref}
          className="mt-6 self-start inline-block px-6 py-3 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition-colors"
        >
          {ctaLabel}
        </a>
        {note && <p className="mt-3 text-sm text-slate-400">{note}</p>}
      </div>
      <div className="hidden md:flex items-center justify-end">
        <Image
          src={imageSrc}
          alt={imageAlt}
          width={520}
          height={400}
          className="w-full max-w-[520px] rounded-xl shadow-xl"
          priority
        />
      </div>
    </section>
  )
}
