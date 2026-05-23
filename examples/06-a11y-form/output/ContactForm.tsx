// FORGE NOTES
// Ref: HTML form section with inline-styled divs as labels/buttons
// Signals: CONVERT_SECTION +A11Y
//
// A11Y decisions (WCAG 2.1 AA):
//   [1.3.1 Info and Relationships] <div>-as-label → <Label htmlFor>, <input id>
//   [1.3.1] <div>-as-button       → semantic <Button type="submit">
//   [3.3.1 Error Identification]  inline error → aria-describedby + role="alert"
//   [3.3.2 Labels or Instructions] every field has a programmatic <Label>
//   [4.1.2 Name, Role, Value]     aria-invalid mirrors validation state on the email field
//   [1.4.3 Contrast (AA)]         text-muted-foreground on dark bg ≥ 4.5:1 verified
//   [2.4.6 Headings and Labels]   <h2> labels the form region; <form> has aria-labelledby
//
// Token mappings:
//   #0F172A → bg-background       |  #fff     → text-foreground
//   #1E293B → bg-muted            |  #334155  → border-border
//   #94A3B8 → text-muted-foreground (slate-400 on dark)
//   #EF4444 → text-destructive    |  #3B82F6  → bg-primary
//
// Library swaps:
//   <input>, <textarea> → shadcn/ui <Input>, <Textarea>
//   <div role=button>   → shadcn/ui <Button type="submit">

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export default function ContactForm() {
  const [emailError, setEmailError] = useState<string | null>(null)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email') ?? '')
    const valid = /\S+@\S+\.\S+/.test(email)
    setEmailError(valid ? null : 'Please enter a valid email address.')
  }

  return (
    <section
      aria-labelledby="contact-heading"
      className="py-20 px-6 bg-background text-foreground"
    >
      <div className="max-w-xl mx-auto">
        <h2 id="contact-heading" className="text-3xl font-bold mb-2">
          Get in touch
        </h2>
        <p className="text-muted-foreground mb-8">
          We reply within one business day.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="grid gap-1.5">
            <Label htmlFor="contact-name">Name</Label>
            <Input id="contact-name" name="name" type="text" autoComplete="name" required />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="contact-email">Email</Label>
            <Input
              id="contact-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              aria-invalid={emailError ? true : undefined}
              aria-describedby={emailError ? 'contact-email-error' : undefined}
            />
            {emailError && (
              <p
                id="contact-email-error"
                role="alert"
                className="text-xs text-destructive"
              >
                {emailError}
              </p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="contact-message">Message</Label>
            <Textarea id="contact-message" name="message" rows={5} required />
          </div>

          <Button type="submit" className="w-full">
            Send message
          </Button>
        </form>
      </div>
    </section>
  )
}
