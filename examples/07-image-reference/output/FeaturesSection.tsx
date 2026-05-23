// FORGE NOTES
// Ref: PNG screenshot — features-section.png (vision-only)
// Signals: CONVERT_SECTION +IMAGE
//
// Visual decisions derived from image (recorded for review):
//   Layout       2-col on lg: 2x2 features grid (left), single card (right)
//                Stacks on mobile (single column)
//   Icons        Small violet tile per feature — bg-violet-100, p-2, rounded-md
//                Glyph color text-violet-500 (rocket, briefcase, bars, alarm)
//   Headings     text-base / text-lg bold slate-900
//   Body copy    text-sm slate-500 leading-relaxed (~3 lines per block)
//   Right card   Rounded photograph (rounded-2xl), then heading + body, then link
//   Link         pink-500 with → arrow; underline-on-hover
//   Container    max-w-6xl mx-auto, py-20 px-8
//
// Token mappings (approximate from screenshot):
//   violet glyph fill   → text-violet-500
//   tile background     → bg-violet-100
//   heading color       → text-slate-900
//   body color          → text-slate-500
//   link color          → text-pink-500
//
// Iconography: original screenshot used custom violet icons. Used lucide-react
// stand-ins to keep the example library-light; swap to your icon library if
// different (e.g., heroicons, custom svgs).

import Image from 'next/image'
import { Rocket, Briefcase, BarChart3, AlarmClock } from 'lucide-react'

interface Feature {
  icon: React.ComponentType<{ className?: string }>
  title: string
  body: string
}

interface FeaturesSectionProps {
  features?: Feature[]
  cardImageSrc: string
  cardImageAlt: string
  cardTitle: string
  cardBody: string
  cardLinkLabel: string
  cardLinkHref: string
}

const DEFAULT_FEATURES: Feature[] = [
  { icon: Rocket,      title: 'Fully integrated',      body: 'We get insulted by others, lose trust for those We get back freezes' },
  { icon: Briefcase,   title: 'Payments functionality', body: 'We get insulted by others, lose trust for those We get back freezes' },
  { icon: BarChart3,   title: 'Prebuilt components',   body: 'We get insulted by others, lose trust for those We get back freezes' },
  { icon: AlarmClock,  title: 'Improved platform',     body: 'We get insulted by others, lose trust for those We get back freezes' },
]

export default function FeaturesSection({
  features = DEFAULT_FEATURES,
  cardImageSrc,
  cardImageAlt,
  cardTitle,
  cardBody,
  cardLinkLabel,
  cardLinkHref,
}: FeaturesSectionProps) {
  return (
    <section className="py-20 px-8 bg-white">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-10">
          {features.map((feature) => (
            <div key={feature.title}>
              <div className="inline-flex p-2 rounded-md bg-violet-100">
                <feature.icon className="w-5 h-5 text-violet-500" aria-hidden="true" />
              </div>
              <h3 className="mt-6 text-lg font-bold text-slate-900">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed max-w-xs">
                {feature.body}
              </p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <Image
            src={cardImageSrc}
            alt={cardImageAlt}
            width={640}
            height={400}
            className="w-full h-auto rounded-t-2xl"
          />
          <div className="p-8">
            <h3 className="text-2xl font-bold text-slate-900">{cardTitle}</h3>
            <p className="mt-4 text-base text-slate-500 leading-relaxed">
              {cardBody}
            </p>
            <a
              href={cardLinkHref}
              className="mt-6 inline-flex items-center gap-1 text-pink-500 font-medium hover:underline"
            >
              {cardLinkLabel} <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
