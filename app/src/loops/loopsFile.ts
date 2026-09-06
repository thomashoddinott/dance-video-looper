import type { SavedLoop } from './loop'

/* What `loops.json` holds, and the only shape this app writes.

   Keyed on the app's own `clip.id` rather than on Drive's file id. `clipIdFor`
   derives that from the file itself, so the same clip uploaded again keeps its
   key and finds its loops — which is what turns UC-01's orphan criterion into a
   decision not to prune rather than a leak. Keying on `driveId` would strand the
   loops of every clip that was ever re-uploaded.

   `schema` is one field of insurance. The loops are the asset, UC-01 Q-06 will
   export this exact shape, and a reader that meets a version it does not know
   should say so rather than mangle what it found.

   **It stays at 1 as the shape grows, and `touched` (#12) is the precedent.**
   The version is not a changelog — it is the switch that makes a reader refuse
   the file, and refusing is only ever right when the loops themselves are at
   stake. Bumping it for an added field would tell every device still on an
   older deployed build that the file is unreadable, and that device would then
   stop saving. Left at 1, the same device ignores the key it does not know and
   drops it on its next write: recency lost, never a loop. Bump it only for a
   change that would make an old reader mangle the loops. */
export const SCHEMA = 1

export type LoopsFile = {
  readonly schema: typeof SCHEMA
  readonly clips: Readonly<Record<string, readonly SavedLoop[]>>
  /* When each clip was last worked on — the last time a loop was saved on it or
     removed from it (#12), which is what the **Last practised** chip orders by.
     ISO-8601, always UTC, because that is the one format whose string order is
     its time order and the merge below compares them as strings.

     A sibling of `clips` rather than a field on each loop: it is a fact about
     the clip, and the clip it belongs to may have no loops left. Keyed the same
     way, so both maps survive a re-upload for the same reason.

     Always present, empty when nothing has been practised, exactly as `clips`
     is — the "not carried around forever" rule (`withClip`) is about entries,
     not about the map. That keeps `LoopsFile` a total shape and spares every
     reader a `?? {}`. */
  readonly touched: Readonly<Record<string, string>>
}

export const NO_LOOPS: LoopsFile = { schema: SCHEMA, clips: {}, touched: {} }

/* Three answers, not two, and the third is the one that matters: a file this
   app cannot understand is refused rather than read as empty, because reading
   it as empty is what would let the next save write over it. Nothing else in
   this story can destroy the asset — a failed write merely fails to add.

   A union rather than a throw, following `playback.ts`: the caller has to say
   something different to the dancer for each, so the distinction belongs in the
   type rather than in a catch. */
export type LoopsRead =
  | { readonly readable: true; readonly loops: LoopsFile }
  | { readonly readable: false }

const UNREADABLE: LoopsRead = { readable: false }

/* Arrays are objects too, and `clips: []` is not a file this app wrote. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/* Finite, not merely a number. `NaN` passes `typeof` and would reach the video
   element as a seek to nowhere — a loop that is silently there and silently
   does not play, which is worse than one that was dropped and can be re-framed. */
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

/* Nothing sentinel except an empty list, so a malformed entry falls out of the
   `flatMap` below without a null to test for afterwards. Same shape
   `nextLoopName` already uses to skip the names that are not numbered. */
const loopFrom = (value: unknown): readonly SavedLoop[] => {
  if (!isRecord(value)) return []

  const { id, name, a, b, speed } = value

  if (typeof id !== 'string' || typeof name !== 'string') return []
  if (!isNumber(a) || !isNumber(b) || !isNumber(speed)) return []

  return [{ id, name, a, b, speed }]
}

/* One bad entry is a different question from one bad file. The rest of the file
   is still the dancer's work, and throwing all of it away to punish a single
   malformed loop would be the app losing loops on their behalf — so entries are
   dropped individually and a clip left with none drops out entirely rather than
   carrying an empty list around forever. */
const clipsFrom = (
  held: Record<string, unknown>,
): Readonly<Record<string, readonly SavedLoop[]>> =>
  Object.fromEntries(
    Object.entries(held).flatMap<[string, readonly SavedLoop[]]>(
      ([clipId, saved]) => {
        if (!Array.isArray(saved)) return []

        const loops = (saved as readonly unknown[]).flatMap(loopFrom)

        return loops.length === 0 ? [] : [[clipId, loops]]
      },
    ),
  )

/* A string is not yet a time. An unparseable one would sort somewhere arbitrary
   rather than fail, so it is refused at the door — the same argument `isNumber`
   above makes about `NaN` reaching a seek. */
const isTime = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value))

/* The asymmetry that decides this whole module: `clips` being the wrong shape
   refuses the file, because loops are unaccounted for. `touched` being the wrong
   shape must not, because refusing would throw away readable loops to punish a
   broken ordering — and an ordering costs nothing to rebuild, since the next
   save stamps the clip again.

   So everything here degrades: a map that is not a map reads as no stamps, and
   a stamp that is not a time is dropped on its own, leaving its siblings. */
const touchedFrom = (held: unknown): Readonly<Record<string, string>> => {
  if (!isRecord(held)) return {}

  return Object.fromEntries(
    Object.entries(held).flatMap<[string, string]>(([clipId, at]) =>
      isTime(at) ? [[clipId, at]] : [],
    ),
  )
}

const parsed = (body: string): unknown => {
  try {
    return JSON.parse(body) as unknown
  } catch {
    /* Not JSON at all. `JSON.parse` never returns undefined, so it is a
       sentinel nothing valid can collide with. */
    return undefined
  }
}

export const readLoopsFile = (body: string): LoopsRead => {
  /* A body of nothing is a file that exists and holds no loops, which is
     exactly what the first save leaves behind if it creates the file and then
     fails to write its content. Refusing it would brick saving on the one
     device that hit that, so it reads as "nothing saved yet" instead. */
  if (body.trim() === '') return { readable: true, loops: NO_LOOPS }

  const held = parsed(body)

  if (!isRecord(held)) return UNREADABLE
  if (held.schema !== SCHEMA) return UNREADABLE
  if (!isRecord(held.clips)) return UNREADABLE

  return {
    readable: true,
    loops: {
      schema: SCHEMA,
      clips: clipsFrom(held.clips),
      /* Absent on every file written before #12, which `touchedFrom` reads as
         no stamps rather than as a reason to refuse. That is what lets this
         land without a schema bump — see the note on `SCHEMA`. */
      touched: touchedFrom(held.touched),
    },
  }
}

/* Indented, as the spike wrote it. It costs a few bytes on a file measured in
   kilobytes, and it means the one copy of the dancer's loops is legible if they
   ever open it in their own Drive. */
export const serialiseLoops = (loops: LoopsFile) =>
  JSON.stringify(loops, null, 2)
