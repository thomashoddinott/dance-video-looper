import type { Clip } from './clip'

/* Three states, because an empty grid must not be allowed to mean three
   different things:

     loading  we have not looked yet
     ready    Drive answered — with clips, or honestly with none
     failed   we looked and could not find out

   Collapsing `failed` into `ready` would tell a dancer whose clips are merely
   unreachable that they have none, which is the app losing their work on their
   behalf. Collapsing `loading` into `ready` is criterion 8. */
export type LibraryState = 'loading' | 'ready' | 'failed'

export type Library = {
  readonly state: LibraryState
  readonly clips: readonly Clip[]
  /* How far along each in-flight upload is, 0 to 1, keyed by clip id. Kept
     beside the clips rather than on them: `Clip` is the shape the player and
     the tile both read, and a field that is only ever meaningful for the few
     seconds after an add would be undefined on every clip that ever came back
     from Drive. */
  readonly uploading: Readonly<Record<string, number>>
}

export const LOADING: Library = { state: 'loading', clips: [], uploading: {} }

export const uploadOf = (library: Library, id: string): number | undefined =>
  library.uploading[id]

const without = (
  uploading: Library['uploading'],
  id: string,
): Library['uploading'] =>
  Object.fromEntries(Object.entries(uploading).filter(([held]) => held !== id))

const holds = (library: Library, id: string) =>
  library.clips.some((clip) => clip.id === id)

export const loaded = (library: Library, clips: readonly Clip[]): Library => ({
  ...library,
  state: 'ready',
  clips,
})

/* The clips go with it. Holding the previous ones would leave the grid showing
   a library the app has just admitted it cannot read. */
export const failed = (library: Library): Library => ({
  ...library,
  state: 'failed',
  clips: [],
})

/* At the front, not merely sorted there — the rule US-01-04 established and #60
   merged. The upload runs behind this tile rather than in front of it, so
   nothing about storage may move it. */
export const adding = (library: Library, clip: Clip): Library => ({
  ...library,
  clips: [clip, ...library.clips],
  uploading: { ...library.uploading, [clip.id]: 0 },
})

/* Every transition below asks whether the clip is still held, because a failure
   and a progress report race: the bytes report one last time as the connection
   drops. Re-admitting a clip that has already been retracted would leave a tile
   in the grid for a clip Drive never stored — and `deleted` below cannot clear
   it, because a clip with no `driveId` has nothing to trash. */
export const progressed = (
  library: Library,
  id: string,
  loaded: number,
  total: number,
): Library =>
  holds(library, id)
    ? {
        ...library,
        uploading: { ...library.uploading, [id]: total === 0 ? 0 : loaded / total },
      }
    : library

export const stored = (
  library: Library,
  id: string,
  driveId: string,
): Library =>
  holds(library, id)
    ? {
        ...library,
        clips: library.clips.map((clip) =>
          clip.id === id ? { ...clip, driveId } : clip,
        ),
        uploading: without(library.uploading, id),
      }
    : library

/* The two ways a clip leaves share their mechanics and nothing else, so the
   mechanics live here once and each reason keeps its own name above it. */
const dropped = (library: Library, id: string): Library => ({
  ...library,
  clips: library.clips.filter((clip) => clip.id !== id),
  uploading: without(library.uploading, id),
})

/* The cost the approval gate took knowingly when it put the tile first: a
   failure retracts something the dancer can already see. The alternative was a
   fourteen-second add. */
export const abandoned = (library: Library, id: string): Library => dropped(library, id)

/* The other reason, and the only one the dancer asks for (UC-01 Q-08). It reads
   the same as `abandoned` and must not be collapsed into it: that one is the
   app taking back a tile it should not have shown, this one is the dancer
   getting rid of a clip on purpose — and it runs only after Drive has already
   agreed, where `abandoned` runs precisely because Drive would not. */
export const deleted = (library: Library, id: string): Library => dropped(library, id)

/* Where the two halves of a tile meet. `clipFromDriveFile` reads every clip
   with `loops: 0`, and honestly so — a Drive file knows nothing about loops,
   and before `loops.json` has arrived nobody knows the number. It comes from a
   different file, read at a different moment, so it is put on here rather than
   there (US-01-15).

   Takes a function rather than the loops themselves, so this module stays
   ignorant of what a loop is: all it needs is a number per clip. */
export const withLoopCounts = (
  library: Library,
  countFor: (clipId: string) => number,
): Library => ({
  ...library,
  clips: library.clips.map((clip) => ({ ...clip, loops: countFor(clip.id) })),
})

/* The same join, for the other thing `loops.json` knows that a Drive listing
   does not: when each clip was last worked on (#12).

   A sibling of `withLoopCounts` rather than a second argument to it. They read
   the same file and arrive by the same route, but they answer different
   questions, and a function named for counting should not quietly do both —
   composing the two at the one call site says what is happening more plainly
   than a `countFor`/`practisedFor` pair would.

   Undefined is a real answer here rather than a gap: most of a library has
   never been practised, and the chip has to draw those clips rather than leave
   them out. */
export const withPractised = (
  library: Library,
  practisedFor: (clipId: string) => string | undefined,
): Library => ({
  ...library,
  clips: library.clips.map((clip) => ({
    ...clip,
    practised: practisedFor(clip.id),
  })),
})
