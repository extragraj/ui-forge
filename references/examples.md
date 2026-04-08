# Real-World Examples

This document provides complete walkthroughs of common UI Forge usage scenarios with actual inputs and outputs.

## Example 1: HTML → TSX Conversion

### Scenario

Convert a Bootstrap HTML hero section to a Next.js component using shadcn/ui.

### Input Files

**hero.html:**
```html
<div class="bg-primary text-white py-5">
  <div class="container">
    <div class="row align-items-center">
      <div class="col-lg-6">
        <h1 class="display-4 fw-bold mb-3">
          Build Your SaaS Faster
        </h1>
        <p class="lead mb-4">
          Ship production-ready features in days, not months.
          Focus on what makes your product unique.
        </p>
        <div class="d-flex gap-3">
          <button class="btn btn-light btn-lg">
            Get Started
          </button>
          <button class="btn btn-outline-light btn-lg">
            Learn More
          </button>
        </div>
      </div>
      <div class="col-lg-6">
        <img src="/hero-illustration.svg" alt="Hero" class="img-fluid" />
      </div>
    </div>
  </div>
</div>
```

**Project context (from design-arch.json):**
```json
{
  "componentLib": "shadcn/ui",
  "usedComponents": ["Button"],
  "tailwind": {
    "colors": {
      "primary": "#3b82f6"
    }
  }
}
```

### Command

```bash
node scripts/invoke.js \
  --task "Convert hero section to Next.js with shadcn/ui" \
  --refs ./hero.html \
  --output ./components/Hero.tsx
```

### Output

**components/Hero.tsx:**
```tsx
// FORGE NOTES
// Detected: Bootstrap HTML with utility classes
// Ref uses: Bootstrap grid, btn classes, container
// Project uses: shadcn/ui Button, Tailwind utilities
// Swaps: .btn → Button component, .container → max-w-7xl mx-auto
// Token mappings: bg-primary → bg-primary (Tailwind), py-5 → py-20
// Layout: Bootstrap grid → Tailwind grid system
// Image: <img> → Next.js Image component
// No conflicts detected

import Image from 'next/image'
import { Button } from '@/components/ui/button'

export default function Hero() {
  return (
    <section className="bg-primary text-white py-20">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-5xl font-bold mb-3">
              Build Your SaaS Faster
            </h1>
            <p className="text-xl mb-6 text-white/90">
              Ship production-ready features in days, not months.
              Focus on what makes your product unique.
            </p>
            <div className="flex gap-4">
              <Button size="lg" variant="secondary">
                Get Started
              </Button>
              <Button size="lg" variant="outline" className="text-white border-white hover:bg-white/10">
                Learn More
              </Button>
            </div>
          </div>
          <div>
            <Image
              src="/hero-illustration.svg"
              alt="Hero"
              width={600}
              height={400}
              className="w-full h-auto"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
```

### Key Transformations

1. **Grid system:** Bootstrap `.row`/`.col-lg-6` → Tailwind `grid lg:grid-cols-2`
2. **Button library:** Bootstrap `.btn` → shadcn `<Button>`
3. **Spacing:** Bootstrap `py-5` → Tailwind `py-20` (more generous, modern spacing)
4. **Image:** Standard `<img>` → Next.js `<Image>` with proper sizing
5. **Container:** Bootstrap `.container` → Tailwind `container mx-auto px-4 max-w-7xl`
6. **Text opacity:** Added `text-white/90` for paragraph (design improvement)

## Example 2: TSX Reference → Project Component (Library Swap)

### Scenario

Convert a Material UI Card component to shadcn/ui while preserving functionality.

### Input Files

**MaterialCard.tsx:**
```tsx
import { Card, CardContent, CardActions, Typography, Button } from '@mui/material'
import { Star } from '@mui/icons-material'

interface PricingCardProps {
  title: string
  price: number
  features: string[]
  popular?: boolean
}

export default function PricingCard({ title, price, features, popular }: PricingCardProps) {
  return (
    <Card variant={popular ? 'outlined' : 'elevation'} sx={{ position: 'relative' }}>
      {popular && (
        <Typography
          sx={{
            position: 'absolute',
            top: -12,
            right: 16,
            bgcolor: 'primary.main',
            color: 'white',
            px: 2,
            py: 0.5,
            borderRadius: 1
          }}
        >
          <Star sx={{ fontSize: 16, mr: 0.5 }} />
          Popular
        </Typography>
      )}
      <CardContent>
        <Typography variant="h5" component="h3" gutterBottom>
          {title}
        </Typography>
        <Typography variant="h3" component="div" sx={{ mb: 2 }}>
          ${price}
          <Typography component="span" variant="body2" color="text.secondary">
            /month
          </Typography>
        </Typography>
        {features.map((feature, index) => (
          <Typography key={index} variant="body2" sx={{ mb: 1 }}>
            • {feature}
          </Typography>
        ))}
      </CardContent>
      <CardActions>
        <Button variant={popular ? 'contained' : 'outlined'} fullWidth>
          Get Started
        </Button>
      </CardActions>
    </Card>
  )
}
```

**Project context:**
```json
{
  "componentLib": "shadcn/ui",
  "usedComponents": ["Button", "Card", "Badge"]
}
```

### Command

```bash
node scripts/invoke.js \
  --task "Convert Material UI pricing card to shadcn/ui" \
  --refs ./MaterialCard.tsx \
  --output ./components/PricingCard.tsx
```

### Output

**components/PricingCard.tsx:**
```tsx
// FORGE NOTES
// Detected: Material UI component with TypeScript
// Ref uses: MUI Card, CardContent, CardActions, Button, Typography
// Project uses: shadcn/ui Card, Button, Badge
// Swaps:
//   - Card/CardContent → Card/CardHeader/CardContent (shadcn pattern)
//   - Typography variants → Tailwind text utilities
//   - Button variant="contained" → Button variant="default"
//   - Button variant="outlined" → Button variant="outline"
//   - MUI Star icon → lucide-react Star
//   - MUI sx prop styles → Tailwind classes
// Props interface: preserved and improved (added cn utility)
// No conflicts detected

import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PricingCardProps {
  title: string
  price: number
  features: string[]
  popular?: boolean
}

export default function PricingCard({ title, price, features, popular }: PricingCardProps) {
  return (
    <Card className={cn("relative", popular && "border-primary")}>
      {popular && (
        <Badge className="absolute -top-3 right-4 bg-primary text-white">
          <Star className="h-4 w-4 mr-1" />
          Popular
        </Badge>
      )}
      <CardHeader>
        <h3 className="text-2xl font-semibold">{title}</h3>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <span className="text-4xl font-bold">${price}</span>
          <span className="text-muted-foreground text-sm">/month</span>
        </div>
        <ul className="space-y-2">
          {features.map((feature, index) => (
            <li key={index} className="text-sm">
              • {feature}
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button variant={popular ? "default" : "outline"} className="w-full">
          Get Started
        </Button>
      </CardFooter>
    </Card>
  )
}
```

### Key Transformations

1. **Card structure:** MUI `Card/CardContent/CardActions` → shadcn `Card/CardHeader/CardContent/CardFooter`
2. **Typography:** MUI `Typography` variants → Tailwind text utilities
3. **Buttons:** `variant="contained"` → `variant="default"`, `fullWidth` → `className="w-full"`
4. **Icons:** `@mui/icons-material` → `lucide-react`
5. **Styling:** MUI `sx` prop → Tailwind classes
6. **Popular badge:** MUI positioned Typography → shadcn Badge with absolute positioning
7. **List styling:** Added `space-y-2` for consistent feature spacing

## Example 3: Image Mockup → Component (Vision API)

### Scenario

Generate a feature card component from a design mockup image.

### Input Files

**feature-card-mockup.png:**
(Imagine a design showing a card with an icon, heading, description, and "Learn more" link in a light gradient background)

### Command

```bash
node scripts/invoke.js \
  --task "Create feature card component matching this design" \
  --refs ./feature-card-mockup.png \
  --output ./components/FeatureCard.tsx
```

### Output

**components/FeatureCard.tsx:**
```tsx
// FORGE NOTES
// Detected: Image mockup with gradient background, icon, text hierarchy
// Visual analysis:
//   - Light gradient background (blue to purple)
//   - Large icon at top (appears to be a lightning bolt)
//   - Bold heading (~24px)
//   - Gray description text (~16px)
//   - Underlined link at bottom
//   - Rounded corners (~12px)
//   - Generous padding (~32px)
// Project uses: shadcn/ui components, lucide-react icons
// Token mappings: gradient → bg-gradient-to-br from-blue-50 to-purple-50
// Icon: matching lucide-react Zap icon
// Link: shadcn Link component pattern
// No conflicts detected

import { Zap } from 'lucide-react'
import Link from 'next/link'

interface FeatureCardProps {
  icon?: React.ElementType
  title: string
  description: string
  href?: string
  linkText?: string
}

export default function FeatureCard({
  icon: Icon = Zap,
  title,
  description,
  href = '#',
  linkText = 'Learn more'
}: FeatureCardProps) {
  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-8 hover:shadow-lg transition-shadow">
      <div className="bg-primary/10 rounded-lg p-3 w-fit mb-4">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <h3 className="text-2xl font-bold mb-3">{title}</h3>
      <p className="text-muted-foreground mb-4 leading-relaxed">
        {description}
      </p>
      <Link
        href={href}
        className="text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
      >
        {linkText}
      </Link>
    </div>
  )
}
```

### Key Decisions from Image Analysis

1. **Gradient:** Detected blue-to-purple gradient → `bg-gradient-to-br from-blue-50 to-purple-50`
2. **Icon container:** Noticed icon had background → Added `bg-primary/10 rounded-lg p-3`
3. **Spacing:** Generous padding observed → `p-8` on card
4. **Hover effect:** Added `hover:shadow-lg` (common pattern, improves UX)
5. **Props:** Made component flexible (configurable icon, title, description, link)
6. **Icon choice:** Matched visual → `lucide-react` Zap icon
7. **Typography:** Hierarchy from mockup → `text-2xl` heading, `text-muted-foreground` body

## Example 4: Page Decomposition (Two-Stage Pipeline)

### Scenario

Convert a full landing page into modular Next.js components.

### Input Files

**landing.html** (450 lines):
```html
<!DOCTYPE html>
<html>
<head>...</head>
<body>
  <!-- Hero Section (lines 12-68) -->
  <section class="hero">
    <h1>Welcome to SaaS Platform</h1>
    <p>Build faster, ship smarter</p>
    <button>Get Started</button>
  </section>

  <!-- Features Grid (lines 69-234) -->
  <section class="features">
    <div class="feature-card">...</div>
    <div class="feature-card">...</div>
    <div class="feature-card">...</div>
  </section>

  <!-- Pricing Table (lines 235-380) -->
  <section class="pricing">
    <div class="pricing-tier">...</div>
    <div class="pricing-tier">...</div>
  </section>

  <!-- CTA Section (lines 381-420) -->
  <section class="cta">
    <h2>Ready to get started?</h2>
    <button>Start Free Trial</button>
  </section>
</body>
</html>
```

### Stage 1: Planning

**Command:**
```bash
node scripts/invoke.js \
  --task "Convert landing page" \
  --refs ./landing.html
```

**Output:** `design/forge-page-plan.json`
```json
{
  "_ref": "./landing.html",
  "_created": "2026-04-08T14:22:30.000Z",
  "sections": [
    {
      "name": "hero",
      "type": "hero",
      "lines": [12, 68],
      "existingProjectSection": false
    },
    {
      "name": "features",
      "type": "features-grid",
      "lines": [69, 234],
      "existingProjectSection": false
    },
    {
      "name": "pricing",
      "type": "pricing-table",
      "lines": [235, 380],
      "existingProjectSection": false
    },
    {
      "name": "cta",
      "type": "cta-banner",
      "lines": [381, 420],
      "existingProjectSection": false
    }
  ]
}
```

**Review and edit plan:**

Let's say you already have a CTA component. Edit the plan:

```json
{
  "name": "cta",
  "type": "cta-banner",
  "lines": [381, 420],
  "existingProjectSection": true  // Changed to true - skip this
}
```

### Stage 2: Generation

**Command (same as Stage 1):**
```bash
node scripts/invoke.js \
  --task "Convert landing page" \
  --refs ./landing.html
```

**Detects plan file, generates sections sequentially:**

**Output 1: components/Hero.tsx**
```tsx
// FORGE NOTES
// Section: hero (lines 12-68)
// Detected: HTML with basic structure
// ...

import { Button } from '@/components/ui/button'

export default function Hero() {
  return (
    <section className="py-20 px-4 text-center">
      <h1 className="text-5xl font-bold mb-4">
        Welcome to SaaS Platform
      </h1>
      <p className="text-xl text-muted-foreground mb-8">
        Build faster, ship smarter
      </p>
      <Button size="lg">Get Started</Button>
    </section>
  )
}
```

**Output 2: components/Features.tsx**
```tsx
// FORGE NOTES
// Section: features (lines 69-234)
// Detected: Features grid with repeated card pattern
// ...

import { Zap, Shield, Gauge } from 'lucide-react'

const features = [
  {
    icon: Zap,
    title: 'Fast Performance',
    description: '...'
  },
  {
    icon: Shield,
    title: 'Secure by Default',
    description: '...'
  },
  {
    icon: Gauge,
    title: 'Scalable Infrastructure',
    description: '...'
  }
]

export default function Features() {
  return (
    <section className="py-20 px-4">
      <div className="container mx-auto max-w-7xl">
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <div key={index} className="text-center">
                <Icon className="h-12 w-12 mx-auto mb-4 text-primary" />
                <h3 className="text-xl font-semibold mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
```

**Output 3: components/Pricing.tsx**
```tsx
// FORGE NOTES
// Section: pricing (lines 235-380)
// Detected: Pricing table with tier cards
// ...

import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const tiers = [
  {
    name: 'Starter',
    price: 9,
    features: ['10 projects', 'Basic support', '1GB storage']
  },
  {
    name: 'Pro',
    price: 29,
    features: ['Unlimited projects', 'Priority support', '10GB storage']
  }
]

export default function Pricing() {
  return (
    <section className="py-20 px-4 bg-muted/50">
      <div className="container mx-auto max-w-5xl">
        <h2 className="text-3xl font-bold text-center mb-12">
          Simple, Transparent Pricing
        </h2>
        <div className="grid md:grid-cols-2 gap-8">
          {tiers.map((tier, index) => (
            <Card key={index}>
              <CardHeader>
                <h3 className="text-2xl font-semibold">{tier.name}</h3>
              </CardHeader>
              <CardContent>
                <div className="mb-6">
                  <span className="text-4xl font-bold">${tier.price}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <ul className="space-y-2">
                  {tier.features.map((feature, i) => (
                    <li key={i}>• {feature}</li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button className="w-full">Get Started</Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
```

**Note:** CTA section was skipped (existingProjectSection: true in plan).

### Stage 2 Summary

1. Read plan file
2. Filter sections where `existingProjectSection: false`
3. For each section:
   - Extract HTML lines from reference
   - Generate component with `CONVERT_SECTION` rules
   - Output to separate file
4. Sequential processing (not parallel) to control token usage

## Example 5: Config-Driven Component (JSON Data Shape)

### Scenario

Build a testimonials section from a JSON data file.

### Input Files

**testimonials.json:**
```json
{
  "heading": "What Our Customers Say",
  "testimonials": [
    {
      "quote": "This product changed how we work. Highly recommended!",
      "author": "Sarah Johnson",
      "role": "CEO, TechCorp",
      "avatar": "/avatars/sarah.jpg",
      "rating": 5
    },
    {
      "quote": "Best investment we made this year. The ROI is incredible.",
      "author": "Michael Chen",
      "role": "CTO, StartupXYZ",
      "avatar": "/avatars/michael.jpg",
      "rating": 5
    },
    {
      "quote": "Support team is amazing. They helped us migrate in days.",
      "author": "Emily Rodriguez",
      "role": "Product Manager, BigCo",
      "avatar": "/avatars/emily.jpg",
      "rating": 5
    }
  ]
}
```

### Command

```bash
node scripts/invoke.js \
  --task "Build testimonials section from config" \
  --refs ./testimonials.json \
  --output ./components/Testimonials.tsx
```

### Output

**components/Testimonials.tsx:**
```tsx
// FORGE NOTES
// Detected: JSON config file with data shape
// Config provides: heading, testimonials array with quote/author/role/avatar/rating
// Generated types from JSON structure
// Project uses: shadcn/ui Card, Next.js Image
// Added: Star rating visualization, responsive grid, avatar handling
// No conflicts detected

import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Star } from 'lucide-react'

interface Testimonial {
  quote: string
  author: string
  role: string
  avatar: string
  rating: number
}

interface TestimonialsProps {
  heading?: string
  testimonials: Testimonial[]
}

export default function Testimonials({
  heading = "What Our Customers Say",
  testimonials
}: TestimonialsProps) {
  return (
    <section className="py-20 px-4">
      <div className="container mx-auto max-w-7xl">
        <h2 className="text-3xl font-bold text-center mb-12">
          {heading}
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <Card key={index}>
              <CardContent className="pt-6">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <blockquote className="text-lg mb-6">
                  "{testimonial.quote}"
                </blockquote>
                <div className="flex items-center gap-3">
                  <Image
                    src={testimonial.avatar}
                    alt={testimonial.author}
                    width={48}
                    height={48}
                    className="rounded-full"
                  />
                  <div>
                    <div className="font-semibold">{testimonial.author}</div>
                    <div className="text-sm text-muted-foreground">
                      {testimonial.role}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
```

**Companion data file (optional):**

**data/testimonials.ts:**
```typescript
import { Testimonial } from '@/components/Testimonials'

export const testimonialsData = {
  heading: "What Our Customers Say",
  testimonials: [
    {
      quote: "This product changed how we work. Highly recommended!",
      author: "Sarah Johnson",
      role: "CEO, TechCorp",
      avatar: "/avatars/sarah.jpg",
      rating: 5
    },
    // ... rest of data
  ]
}
```

**Usage in page:**
```tsx
import Testimonials from '@/components/Testimonials'
import { testimonialsData } from '@/data/testimonials'

export default function HomePage() {
  return (
    <main>
      <Testimonials {...testimonialsData} />
    </main>
  )
}
```

### Key Decisions from JSON

1. **Type generation:** Inferred `Testimonial` interface from JSON structure
2. **Props interface:** Created `TestimonialsProps` for component flexibility
3. **Defaults:** Made `heading` optional with default value
4. **Rating visualization:** Added Star icons based on `rating` field
5. **Avatar handling:** Used Next.js Image component with proper sizing
6. **Grid layout:** Responsive grid based on array length
7. **Card usage:** Wrapped each testimonial in shadcn Card

## Tips for Best Results

### 1. Clear Task Descriptions

**Good:**
```bash
--task "Convert hero section with CTA buttons and background image"
```

**Better:**
```bash
--task "Convert hero: left-aligned text, two CTA buttons (primary + outline), right-side illustration, gradient background"
```

### 2. Combine Reference Types

Mix HTML structure + JSON data + image design:

```bash
node scripts/invoke.js \
  --task "Build pricing section" \
  --refs ./pricing.html,./tiers.json,./pricing-mockup.png
```

Result: Structure from HTML, data shape from JSON, visual design from image.

### 3. Use Component Standards

Create a `docs/component-standards.md` in your project:

```markdown
# Component Standards

## Buttons
- Always use Button component from @/components/ui/button
- Variants: default (primary), outline, ghost, link
- Sizes: default, sm, lg

## Cards
- Always include CardHeader for titles
- Use CardFooter for actions
- Add hover:shadow-lg for interactive cards
```

UI Forge will find and follow this automatically.

### 4. Edit Page Plans

Always review and edit `design/forge-page-plan.json` before Stage 2:

- Rename sections for clarity
- Skip sections you already have
- Adjust line ranges if detection was off
- Change section types for better naming

### 5. Iterative Refinement

Generate, review, refine:

```bash
# First pass
node scripts/invoke.js --task "Convert hero" --refs ./hero.html

# Review output, then refine with more specific task
node scripts/invoke.js \
  --task "Convert hero with centered layout, larger text, and animated gradient background" \
  --refs ./hero.html
```

Each iteration improves based on your feedback in the task description.
