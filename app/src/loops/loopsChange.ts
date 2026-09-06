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
   Both sides may be missing: a clip this device has never opened, in a file that
   has never heard of it either.

   `max` rather than an assignment wherever it is used, and that is the merge
   rule rather than caution. Two clocks that disagree cost minutes here, which is
   nothing against a chip measured in days. */
export const laterOf = (
  held: string | undefined,
  other: string | undefined,
): string | undefined => {
  if (held === undefined) return other
  if (other === undefined) return held

  return held > other ? held : other
}

/* A clip with no loops is not in the file at all, which is the same rule
   `readLoopsFile` applies to a clip whose every entry was malformed. Keeping an
   empty list would give the two readings of "this clip has nothing" a way to
   disagree.

   It leaves `touched` alone. Saving a loop is not what the fourth chip measures
   any more (#16) — opening the clip is, and that is recorded on the device long
   before this runs. A loop write carries those stamps (`withOpens`), but it does
   not make one of its own. */
const withClip = (
  loops: LoopsFile,
  clipId: string,
  saved: readonly SavedLoop[],
): LoopsFile => ({
  ...loops,
  clips: Object.fromEntries(
    Object.entries({ ...loops.clips, [clipId]: saved }).filter(
      ([, held]) => held.length > 0,
    ),
  ),
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

/* What Drive knows about when this clip was last opened (#16) — which may be
   another device's answer, and may be behind this one's. The grid takes the
   later of the two (`laterOf`).

   Undefined rather than a fallback date, because "never opened" is not "opened
   at the beginning of time": the chip sorts the never-opened below every clip
   that has been, and any real date would let one of them tie with a clip that
   genuinely was opened then. */
export const openedAt = (
  loops: LoopsFile,
  clipId: string,
): string | undefined => loops.touched[clipId]

/* The opens this device recorded, folded into the file on their way to Drive
   (#16). They ride the write a loop save or removal was already making — there
   is no write of their own, which is the whole reason opening a clip is free.

   Per clip the later stamp wins, so replaying a laptop's week-old opens onto
   what the phone has since written cannot drag anything backwards. */
export const withOpens = (
  loops: LoopsFile,
  opens: Readonly<Record<string, string>>,
): LoopsFile => ({
  ...loops,
  touched: Object.entries(opens).reduce<Record<string, string>>(
    (held, [clipId, at]) => ({
      ...held,
      [clipId]: laterOf(held[clipId], at) ?? at,
    }),
    { ...loops.touched },
  ),
})

/* At the end, because that is the order the panel lists them in and the order
   the dancer saved them in. */
export const withLoop = (
  loops: LoopsFile,
  clipId: string,
  loop: SavedLoop,
): LoopsFile => withClip(loops, clipId, [...loopsFor(loops, clipId), loop])

/* A no-op for an id that is not there, and that is a real case rather than
   defensiveness: the other device may have removed it first, and the merge
   replays this removal onto a file that has already lost it. */
export const withoutLoop = (
  loops: LoopsFile,
  clipId: string,
  id: string,
): LoopsFile =>
  withClip(
    loops,
    clipId,
    loopsFor(loops, clipId).filter((loop) => loop.id !== id),
  )
