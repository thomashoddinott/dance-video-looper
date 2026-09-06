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

/* A clip with no loops is not in the file at all, which is the same rule
   `readLoopsFile` applies to a clip whose every entry was malformed. Keeping an
   empty list would give the two readings of "this clip has nothing" a way to
   disagree. */
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
