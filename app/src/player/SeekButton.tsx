import type { ReactNode } from 'react'

/* Two triangles rather than ⏪ / ⏩, for the reason `TransportButton` gives: the
   glyph characters carry emoji presentation on macOS and iOS and render in
   colour whatever the surrounding text does. */
function Glyph({ children }: { readonly children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-5 w-5">
      {children}
    </svg>
  )
}

export const BackGlyph = () => (
  <Glyph>
    <path d="M11 6v12l-8-6z" />
    <path d="M21 6v12l-8-6z" />
  </Glyph>
)

export const ForwardGlyph = () => (
  <Glyph>
    <path d="M13 6v12l8-6z" />
    <path d="M3 6v12l8-6z" />
  </Glyph>
)

/* Named for a screen reader rather than labelled on screen: the two arrows say
   which way, and a word under each would crowd the row the speed stepper shares
   (mockup `Player.jsx:106-117`). */
export function SeekButton({
  label,
  onClick,
  children,
}: {
  readonly label: string
  readonly onClick: () => void
  readonly children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex items-center justify-center rounded-lg bg-control px-5 py-3 text-ink/90 transition hover:bg-control-hi active:scale-95"
    >
      {children}
    </button>
  )
}
