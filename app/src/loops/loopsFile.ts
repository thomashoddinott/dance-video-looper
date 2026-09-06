import type { SavedLoop } from './loop'

/* What `loops.json` holds, and the only shape this app writes.

   Keyed on the app's own `clip.id` rather than on Drive's file id. `clipIdFor`
   derives that from the file itself, so the same clip uploaded again keeps its
   key and finds its loops — which is what turns UC-01's orphan criterion into a
   decision not to prune rather than a leak. Keying on `driveId` would strand the
   loops of every clip that was ever re-uploaded.

   `schema` is one field of insurance. The loops are the asset, UC-01 Q-06 will
   export this exact shape, and a reader that meets a version it does not know
   should say so rather than mangle what it found. */
export const SCHEMA = 1

export type LoopsFile = {
  readonly schema: typeof SCHEMA
  readonly clips: Readonly<Record<string, readonly SavedLoop[]>>
}

export const NO_LOOPS: LoopsFile = { schema: SCHEMA, clips: {} }

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
    loops: { schema: SCHEMA, clips: clipsFrom(held.clips) },
  }
}

/* Indented, as the spike wrote it. It costs a few bytes on a file measured in
   kilobytes, and it means the one copy of the dancer's loops is legible if they
   ever open it in their own Drive. */
export const serialiseLoops = (loops: LoopsFile) =>
  JSON.stringify(loops, null, 2)
