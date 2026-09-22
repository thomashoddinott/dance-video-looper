import type { SavedLoop } from '../loops/loop'
import type { Loop } from './playback'

/* #28. Learning a routine goes segment 1, segment 2, then 1+2 together, and the
   panel had no answer for the third of those: the only way to run two sections
   as one was to frame and keep a third loop that duplicated both — and then a
   fourth for 2+3, and a fifth for all of them.

   Ticking loops chains them instead. The run is one loop from the earliest start
   to the furthest end, and nothing is written to `loops.json` for it: a chain is
   a way to play the loops already saved, not another loop to save. */

/* The order the panel lists in, and the order the whole feature rests on. Loops
   arrive in the order they were saved (`withLoop` appends), which is not the
   order the clip runs in — frame the ending first and it sits above the opening
   forever. Ticked rows then light up with something unrelated between them, and
   a chain stops looking like the run it plays.

   Sorted rather than stored sorted, because the saved order is a fact about the
   file: `loops.json` is a merge of two devices' appends (`loopsChange`), and
   re-ordering it on the way through would make every write look like a change
   to every loop.

   A tie keeps the order the loops were saved in — `sort` is stable — which is
   the honest answer for the same section kept twice at two tempos: neither can
   come first on the clock, so the dancer's own order stands.

   Copied first, because `sort` orders in place and what it would be ordering is
   the list the Clips screen counts and Drive is handed. */
export const inStartOrder = (
  saved: readonly SavedLoop[],
): readonly SavedLoop[] => [...saved].sort((one, other) => one.a - other.a)

/* What the ticked loops play as, or null when none of them are there.

   Whether the sections actually meet is deliberately not a condition. A and B
   are dragged by hand and never land on the same frame twice, so a tolerance
   would be deciding whether the control worked at all on a difference of tenths
   the dancer cannot see — a rule you can feel but not see. Tick two loops with a
   gap between them and the span covers the gap.

   The end is the furthest end in the selection rather than the last row's, which
   is the same number for sections laid end to end and the only safe one when a
   loop sits inside another: a whole phrase and the hard bar within it are both
   worth keeping, and taking the last row's B there would hand back a loop whose
   end precedes its own start.

   One tempo, because a chain is one loop and BR-09 made the tempo part of what a
   loop is. It comes from where the run begins, so a chain starts the way the
   section it opens with was learned.

   An id with no loop behind it is dropped rather than refused: the other device
   may have removed the loop while this one had it ticked, and a stale tick must
   not take the rest of the run down with it. */
export const chainedSpan = ({
  saved,
  chain,
}: {
  readonly saved: readonly SavedLoop[]
  readonly chain: readonly string[]
}): { readonly loop: Loop; readonly speed: number } | null => {
  const [opens, ...rest] = inStartOrder(
    saved.filter((loop) => chain.includes(loop.id)),
  )

  if (!opens) return null

  return {
    loop: {
      a: opens.a,
      b: rest.reduce((end, loop) => Math.max(end, loop.b), opens.b),
    },
    speed: opens.speed,
  }
}
