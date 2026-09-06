import type { ReactNode } from 'react'

import type { Handle } from './loopRange'

/* `kbd` rather than a styled span, so a key on screen is a key to anything reading
   the page rather than a word that happens to sit in a box. `font-sans` because
   the element's default is monospace, and the hint reads as a sentence. */
function Key({ children }: { readonly children: ReactNode }) {
  return (
    <kbd className="rounded bg-control px-1.5 py-0.5 font-sans text-ink/70">
      {children}
    </kbd>
  )
}

/* None of the shortcuts is discoverable, and which point space will set next is
   not readable off the screen any other way — two presses in and a glance away,
   and which one is coming is a guess.

   Hidden below `sm`, which is the device the tool is chiefly for: there is no
   keyboard on a phone, so the line would be a paragraph of instructions for keys
   nobody can press. Every shortcut it names has a pointer equivalent that carries
   the job there instead (UC-01, *The keyboard, and what it means on a phone*).

   The paragraph is drawn whether or not there is anything to say, and `next` is
   null when there is not. It is one of the five regions the player reserves, and
   zen mode's rule is that those are hidden and given back rather than built and
   torn down (BR-08) — a region that came and went with the clip's decoding would
   be a sixth kind of thing. */
export function ShortcutHint({
  next,
  halfSet,
}: {
  readonly next: Handle | null
  readonly halfSet: boolean
}) {
  return (
    <p
      role="note"
      aria-label="Keyboard shortcuts"
      className="mb-4 hidden text-center text-xs text-ink/40 sm:block"
    >
      {next && (
        <>
          <Key>space</Key> sets{' '}
          <span className="font-semibold text-ink/70">{next.toUpperCase()}</span>
          <span className="px-2">&middot;</span>
          {/* US-01-11's segment. It says when the key will not work rather than
              going quiet, because a hint that keeps offering a dead key is worse
              than one that admits it — and dimmed as well as reworded, so the
              refusal reads at a glance without being parsed.

              Reading the same `halfSet` the button and the key do, so the line
              cannot advertise a save that BR-04 would refuse. */}
          <span className={halfSet ? 'opacity-40' : undefined}>
            <Key>s</Key> {halfSet ? 'saves once B is set' : 'saves the loop'}
          </span>
          <span className="px-2">&middot;</span>
          <Key>f</Key> toggles zen mode
        </>
      )}
    </p>
  )
}
