import type { ReactNode } from 'react'

/* Inline SVG rather than glyph characters: ⏮ and ⏸ carry emoji presentation on
   macOS and iOS, so they render as colour emoji whatever the surrounding text
   does (mockup `Player.jsx:27-28`). */
function Glyph({
  outline = false,
  children,
}: {
  readonly outline?: boolean
  readonly children: ReactNode
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-7 w-7"
      fill={outline ? 'none' : 'currentColor'}
      stroke={outline ? 'currentColor' : 'none'}
      strokeWidth={outline ? 2 : undefined}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const StartGlyph = () => (
  <Glyph>
    <rect x="5" y="5" width="2.8" height="14" rx="1.2" />
    <path d="M20 5v14l-10-7z" />
  </Glyph>
)

export const LoopGlyph = () => (
  <Glyph outline>
    <path d="M17 2.5l3.5 3.5L17 9.5" />
    <path d="M3.5 11.5V10a4 4 0 0 1 4-4h13" />
    <path d="M7 21.5L3.5 18 7 14.5" />
    <path d="M20.5 12.5V14a4 4 0 0 1-4 4h-13" />
  </Glyph>
)

export const PlayGlyph = () => (
  <Glyph>
    <path d="M7.5 4.5l12 7.5-12 7.5z" />
  </Glyph>
)

export const PauseGlyph = () => (
  <Glyph>
    <rect x="7" y="5" width="3.6" height="14" rx="1.2" />
    <rect x="13.4" y="5" width="3.6" height="14" rx="1.2" />
  </Glyph>
)

/* The mockup keeps the label in a sibling of the button (`Player.jsx:265-284`);
   here it sits inside it. The rendered result is the same — a coloured box with
   its word underneath — but the whole thing becomes one control with a name, so
   the word is the button's accessible name rather than text floating beside an
   unnamed icon, and the label is part of the hit target rather than a dead strip
   under it.

   `pressed` is left off entirely for the two controls that are not toggles:
   START and PLAY/PAUSE do a thing, they are not states to be in. */
export function TransportButton({
  label,
  pressed,
  onClick,
  children,
}: {
  readonly label: string
  readonly pressed?: boolean
  readonly onClick?: () => void
  readonly children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className="flex flex-col items-center gap-1.5"
    >
      <span
        className={`flex h-16 w-24 items-center justify-center rounded-xl transition active:scale-95 ${
          pressed
            ? 'bg-gradient-to-br from-accent to-accent-2 text-on-accent shadow-lg'
            : 'bg-control text-ink/90 hover:bg-control-hi'
        }`}
      >
        {children}
      </span>
      <span className="text-xs font-semibold tracking-wide text-ink/60">
        {label}
      </span>
    </button>
  )
}
