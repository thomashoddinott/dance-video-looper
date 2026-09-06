import { formatDuration } from '../clips/format'
import type { SavedLoop } from '../loops/loop'
import type { Loop } from './playback'

/* Written once, because the panel says it twice: beneath the field, as what a
   Save would keep, and again under each entry as what one already did. Two copies
   of the same sentence would be free to drift, and the whole point of the line
   above the list is that it is a preview of the line below it.

   `formatDuration` rather than a second formatter carried over from the mockup —
   it is already what the clip tiles print and what the loop slider announces
   through `aria-valuetext`, so the time read off this panel is written the same
   way as the time the handle the dancer just dragged reports.

   The rate goes in as it is: `speed.ts` rounds every rate it produces, at the one
   place a rate is produced, so there is nothing left to format here. */
export const summarise = ({
  a,
  b,
  speed,
}: {
  readonly a: number
  readonly b: number
  readonly speed: number
}) => `${formatDuration(a)} - ${formatDuration(b)} · ${speed}x`

const NUMBERED = /^Loop (\d+)$/

/* BR-10, as settled at US-01-11's approval gate. The mockup offers
   `Loop ${saved.length + 1}`, which collides the moment anything is removed:
   save three, delete two, and the next offer is a name still on the list. A
   monotonic counter avoids that and gaps instead — and resets on reload, so once
   US-01-15 restores loops from Drive it would start at 1 and collide anyway.

   Reading the lowest unused number off the names actually saved is the only one
   of the three that is right after a removal *and* after a reload, because it
   holds no state of its own to be wrong.

   Anchored on both ends, so `Loop 1 slow` is a name the dancer chose rather than
   a number in use. */
export const nextLoopName = (saved: readonly SavedLoop[]) => {
  const taken = new Set(
    saved.flatMap((loop) => {
      const numbered = NUMBERED.exec(loop.name)

      return numbered ? [Number(numbered[1])] : []
    }),
  )

  /* Sorted first, because the scan only moves past a number it has just landed
     on: reading 2 before 1 out of an unordered set would leave 1 looking free
     while it is on the list. */
  const free = [...taken]
    .sort((one, other) => one - other)
    .reduce((lowest, number) => (number === lowest ? lowest + 1 : lowest), 1)

  return `Loop ${free}`
}

/* UC-01 step 20: which of the loops on this clip the player is actually set to.

   Answered by value — A, B and the speed all matching — rather than by
   remembering which entry was last tapped. Settled at US-01-11's approval gate,
   and the reason is that value equality goes stale in the only honest direction:
   reframe the loop and the mark leaves, because the dancer is no longer on that
   loop. A remembered id would leave an entry still claiming to be where they are
   after they had dragged both handles somewhere else.

   The speed is part of the comparison for BR-09's reason: it was saved *with* the
   loop, so the same section at a different tempo is a different loop.

   The cost accepted at the gate: two loops saved with identical points and speed
   both mark. They are the same loop under two names, so neither answer is wrong. */
export const isCurrent = ({
  entry,
  loop,
  speed,
}: {
  readonly entry: SavedLoop
  readonly loop: Loop
  readonly speed: number
}) => entry.a === loop.a && entry.b === loop.b && entry.speed === speed
