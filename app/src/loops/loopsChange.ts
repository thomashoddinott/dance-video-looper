import type { SavedLoop } from './loop'
import type { LoopsFile } from './loopsFile'

/* The only two things a device ever does to `loops.json`, and the reason UC-01
   Q-05 settled on a merge rather than on last-write-wins with a warning.

   Because a change is only ever "append this loop" or "drop this id", replaying
   one onto whatever Drive currently holds *is* the merge. There are no
   tombstones to keep, and a loop the other device removed does not come back to
   life the way a union of two lists would resurrect it. The merge falls out of
   how small the operations are rather than having to be designed.

   Everything here is a plain function of a `LoopsFile`, so the same code path
   serves the optimistic local answer and the write that goes to Drive. */

/* The later of the two, and a plain string comparison because the stamps are
   ISO-8601 UTC — the one format whose lexical order is its chronological order.

   `max` rather than an assignment, and that is the merge rule rather than
   caution. `applyToLoops` replays this change onto whatever Drive holds *now*,
   so a stamp captured before that round trip can land on top of a newer one the
   phone already wrote. Assigning would let a laptop that has been offline drag
   a clip's recency backwards. Two clocks that disagree cost minutes here, which
   is nothing against a chip measured in days. */
const laterOf = (held: string | undefined, at: string) =>
  held !== undefined && held > at ? held : at

/* A clip with no loops is not in the file at all, which is the same rule
   `readLoopsFile` applies to a clip whose every entry was malformed. Keeping an
   empty list would give the two readings of "this clip has nothing" a way to
   disagree.

   The stamp is not filtered the same way, on purpose: a clip whose last loop
   has just been removed is a clip that was just practised, so its `touched`
   entry outlives the loops that earned it (#12).

   Every change through here stamps, with no exception for one that removes
   nothing. A removal replayed onto a file the other device already removed from
   changes no loops, but the dancer still pressed the button — the emptiness is
   the merge's doing, not theirs. */
const withClip = (
  loops: LoopsFile,
  clipId: string,
  saved: readonly SavedLoop[],
  at: string,
): LoopsFile => ({
  ...loops,
  clips: Object.fromEntries(
    Object.entries({ ...loops.clips, [clipId]: saved }).filter(
      ([, held]) => held.length > 0,
    ),
  ),
  touched: { ...loops.touched, [clipId]: laterOf(loops.touched[clipId], at) },
})

export const loopsFor = (
  loops: LoopsFile,
  clipId: string,
): readonly SavedLoop[] => loops.clips[clipId] ?? []

/* What the Clips screen puts in parentheses, and what **Most looped** orders
   by. An orphan — a clip deleted from Drive by other means — is a key nothing
   asks about, and a clip the file has never heard of answers none rather than
   throwing (UC-01's orphan criterion). */
export const countOf = (loops: LoopsFile, clipId: string) =>
  loopsFor(loops, clipId).length

/* What the **Last practised** chip orders by (#12). Undefined rather than a
   fallback date, because "never practised" is not "practised at the beginning
   of time": the chip sorts the never-practised below every clip that has been,
   and any real date would let one of them tie with a clip that has. */
export const practisedAt = (
  loops: LoopsFile,
  clipId: string,
): string | undefined => loops.touched[clipId]

/* At the end, because that is the order the panel lists them in and the order
   the dancer saved them in.

   `at` is passed in rather than read from a clock here, which keeps this module
   pure and — more usefully — makes the merge above something a test can state
   as arithmetic rather than schedule. */
export const withLoop = (
  loops: LoopsFile,
  clipId: string,
  loop: SavedLoop,
  at: string,
): LoopsFile => withClip(loops, clipId, [...loopsFor(loops, clipId), loop], at)

/* A no-op for an id that is not there, and that is a real case rather than
   defensiveness: the other device may have removed it first, and the merge
   replays this removal onto a file that has already lost it. A no-op for the
   loops — it still stamps, for the reason `withClip` gives. */
export const withoutLoop = (
  loops: LoopsFile,
  clipId: string,
  id: string,
  at: string,
): LoopsFile =>
  withClip(
    loops,
    clipId,
    loopsFor(loops, clipId).filter((loop) => loop.id !== id),
    at,
  )
