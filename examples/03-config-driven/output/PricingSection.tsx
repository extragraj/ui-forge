// FORGE NOTES
// Ref: HTML (inline styles) + JSON config shape
// Signal: CONVERT_SECTION +CONFIG
//
// Token mappings:
//   #f8fafc → bg-slate-50     |  #0f172a → text-slate-900
//   #64748b → text-slate-500  |  #475569 → text-slate-600
//   #94a3b8 → text-slate-400  |  #e2e8f0 → border-slate-200
//   #1e3a8a → bg-blue-900 (highlighted tier bg)
//   #3b82f6 → bg-blue-500 / text-blue-500
//   #dbeafe → text-blue-100   |  #93c5fd → text-blue-300
//   #cbd5e1 → border-slate-300
//   padding 2rem       → p-8
//   gap 1.5rem         → gap-6
//   border-radius 12px → rounded-xl
//   font-size .875rem  → text-sm
//   font-size 2.25rem  → text-4xl
//   font-size .9375rem → text-[15px]
//
// Config wins for data shape: tiers array typed from JSON keys
// Reference wins for layout: 3-column grid, highlighted tier treatment
//
// Divergences:
//   position:absolute badge on highlighted tier → relative wrapper + -mt-5 badge (no arbitrary position in Tailwind)
//   letter-spacing .05em → tracking-wider

interface PricingTier {
  name: string
  price: string
  period?: string | null
  highlighted?: boolean
  badge?: string | null
  features: string[]
  ctaLabel: string
  ctaHref: string
}

interface PricingSectionProps {
  sectionTitle: string
  sectionSubtitle?: string
  tiers: PricingTier[]
}

export default function PricingSection({ sectionTitle, sectionSubtitle, tiers }: PricingSectionProps) {
  return (
    <section className="py-20 px-10 bg-slate-50">
      <h2 className="text-center text-4xl font-bold text-slate-900">{sectionTitle}</h2>
      {sectionSubtitle && (
        <p className="text-center text-slate-500 mt-2">{sectionSubtitle}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 max-w-[1000px] mx-auto">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={[
              'relative flex flex-col rounded-xl p-8',
              tier.highlighted
                ? 'bg-blue-900'
                : 'bg-white border border-slate-200',
            ].join(' ')}
          >
            {tier.badge && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                {tier.badge}
              </span>
            )}

            <p className={['text-sm font-semibold uppercase tracking-wider', tier.highlighted ? 'text-blue-300' : 'text-slate-500'].join(' ')}>
              {tier.name}
            </p>

            <p className={['mt-2 text-4xl font-bold', tier.highlighted ? 'text-white' : 'text-slate-900'].join(' ')}>
              {tier.price}
              {tier.period && (
                <span className={['text-base font-normal', tier.highlighted ? 'text-blue-300' : 'text-slate-400'].join(' ')}>
                  {tier.period}
                </span>
              )}
            </p>

            <ul className="mt-6 flex flex-col gap-3 flex-1">
              {tier.features.map((feature) => (
                <li key={feature} className={['text-[15px]', tier.highlighted ? 'text-blue-100' : 'text-slate-600'].join(' ')}>
                  ✓ {feature}
                </li>
              ))}
            </ul>

            <a
              href={tier.ctaHref}
              className={[
                'mt-8 block text-center py-3 rounded-lg font-semibold transition-colors',
                tier.highlighted
                  ? 'bg-blue-500 text-white hover:bg-blue-400'
                  : 'border border-slate-300 text-slate-600 hover:bg-slate-50',
              ].join(' ')}
            >
              {tier.ctaLabel}
            </a>
          </div>
        ))}
      </div>
    </section>
  )
}
