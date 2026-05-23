// FORGE NOTES
// Ref: HTML inline-styled section + brand.tokens.json (+BRAND signal)
// Signals: CONVERT_SECTION +BRAND
//
// Brand authority decisions (brand.tokens.json wins over ad-hoc HTML hex):
//   #FAF5FF  → bg-violet-50    (matched: tint)
//   #7C3AED  → text-violet-600 (matched: primary)
//   #6D28D9  → text-violet-700 (matched: support-ink)
//   #4C1D95  → text-violet-900 (matched: muted-ink)
//   #1E1B4B  → text-indigo-950 (matched: ink)
//   #E9D5FF  → border-violet-200 (matched: hairline)
//
// Typography decisions:
//   h2 → font-display (Playfair Display) per brand typography.display
//   eyebrow / body / meta → font-sans (Inter, default) per typography.ui
//
// Brand voice: removed any imperative punctuation; tone stays declarative.
// No exclamation points used (brand.voice).
//
// Spacing: matched brand.spacing tokens exactly (py-24 px-8, gap-6, p-8 rounded-2xl)

interface Feature {
  title: string
  body: string
}

interface FeaturedSectionProps {
  eyebrow: string
  heading: string
  intro: string
  features: Feature[]
}

export default function FeaturedSection({
  eyebrow,
  heading,
  intro,
  features,
}: FeaturedSectionProps) {
  return (
    <section className="py-24 px-8 bg-violet-50">
      <div className="max-w-5xl mx-auto text-center">
        <p className="text-sm font-semibold text-violet-600 uppercase tracking-wider">
          {eyebrow}
        </p>
        <h2 className="font-display text-4xl font-bold text-indigo-950 mt-2">
          {heading}
        </h2>
        <p className="text-lg text-violet-900 mt-4 max-w-2xl mx-auto">
          {intro}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 text-left">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="p-8 bg-white border border-violet-200 rounded-2xl"
            >
              <h3 className="text-lg font-semibold text-indigo-950">
                {feature.title}
              </h3>
              <p className="text-sm text-violet-700 mt-2">{feature.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
