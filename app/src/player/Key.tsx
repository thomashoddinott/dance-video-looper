import type { ReactNode } from 'react'

/* `kbd` rather than a styled span, so a key on screen is a key to anything reading
   the page rather than a word that happens to sit in a box. `font-sans` because
   the element's default is monospace, and the hint reads as a sentence. Shared
   by the hint line and the key map (#115), so a key looks the same in both. */
export function Key({ children }: { readonly children: ReactNode }) {
  return (
    <kbd className="rounded bg-control px-1.5 py-0.5 font-sans text-ink/70">
      {children}
    </kbd>
  )
}
