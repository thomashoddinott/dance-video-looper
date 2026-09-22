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

/* UC-01 step 20 and BR-20: which of the loops on this clip the player is set to,
   and the entry a save therefore writes over.

   **By id, which reverses what US-01-11's approval gate settled** (#30). That gate
   chose value equality — A, B and the speed all matching — on the reasoning that
   it goes stale in the only honest direction: reframe the loop and the mark
   leaves, because the dancer is no longer on that loop.

   That reading was right about what the mark *said* and wrong about what it is
   for. The mark's job is to name the entry the next save lands on, and value
   equality lets go of that at the exact moment it matters: the dancer opens a
   loop that starts half a second late, drags A back, and the app has by then
   forgotten which loop they were correcting — so the save has nothing to write
   to and appends a near-duplicate instead. The list fills with the same section
   saved four times over, and there is no rename and no reorder to dig out of it.

   Held as an id rather than a whole loop, and looked up here, so the answer
   cannot outlive the entry. A loop removed — here, or on the other device before
   the next read — simply stops being the one a save writes to, and the panel
   falls back to adding.

   What is given up: the mark no longer promises the sliders match the entry. The
   entry says that for itself instead (`unwritten`), which is the more useful
   claim anyway — it is the difference between "you are here" and "this is what
   you would overwrite, and it has moved". */
export const beingEdited = (
  saved: readonly SavedLoop[],
  id: string | null,
): SavedLoop | null => saved.find((entry) => entry.id === id) ?? null

/* BR-10 across both kinds of write. An empty field has always meant "keep the
   name being offered"; there are now two things to offer, and which one depends
   on whether there is an entry to write over.

   Its own name, not the next free number, when there is. Clearing the field is
   not a request to rename `chasse` to `Loop 4` — and the field *is* cleared
   after every write, so an update made straight after a save would otherwise
   rename the loop it was correcting. */
export const nameToKeep = ({
  typed,
  editing,
  saved,
}: {
  readonly typed: string
  readonly editing: SavedLoop | null
  readonly saved: readonly SavedLoop[]
}) => typed.trim() || editing?.name || nextLoopName(saved)

/* Whether the open entry and the player have parted company — the loop on the
   sliders is no longer the loop in Drive.

   The whole of what the mark used to claim, said by the entry that is actually
   affected rather than by the absence of a highlight. The name is in the
   comparison because it is saved with the rest (BR-09 for the speed, BR-10 for
   the name): a rename with the boundaries untouched is still a write worth
   making, and an Update that looked idle would be indistinguishable from one
   that had already happened. */
export const unwritten = ({
  entry,
  loop,
  speed,
  name,
}: {
  readonly entry: SavedLoop
  readonly loop: Loop
  readonly speed: number
  readonly name: string
}) =>
  entry.a !== loop.a ||
  entry.b !== loop.b ||
  entry.speed !== speed ||
  entry.name !== name
