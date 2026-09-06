import type { ClipCache, ThumbnailCache } from './clipCache'

/* jsdom ships no IndexedDB, so `browserClipCache` cannot run in a test — any
   test that reaches a Drive-held clip has to say which cache it means. Saying
   "none" out loud is the point: a test that silently fell back to the real one
   would fail for a reason that has nothing to do with what it is asserting. */
export const holdsNothing: ClipCache = {
  get: () => Promise.resolve(null),
  put: () => Promise.resolve(),
  forget: () => Promise.resolve(),
}

export const holding = (bytes: Blob, checksum?: string): ClipCache => ({
  get: () => Promise.resolve({ bytes, checksum }),
  put: () => Promise.resolve(),
  forget: () => Promise.resolve(),
})

/* The same "say which cache you mean" discipline for #77's stills. */
export const noThumbnails: ThumbnailCache = {
  get: () => Promise.resolve(null),
  put: () => Promise.resolve(),
  forget: () => Promise.resolve(),
}

export const thumbnailsHolding = (bytes: Blob): ThumbnailCache => ({
  get: () => Promise.resolve(bytes),
  put: () => Promise.resolve(),
  forget: () => Promise.resolve(),
})

/* A cache that says what it was asked to forget. An observable fake rather than
   a spy: the question a delete has to answer is "are those bytes gone", and the
   honest way to ask it is to look at what the cache is holding. */
export const forgetting = () => {
  const forgotten: string[] = []

  return {
    cache: {
      ...holdsNothing,
      forget: (clipId: string) => {
        forgotten.push(clipId)

        return Promise.resolve()
      },
    } satisfies ClipCache,
    forgotten: (): readonly string[] => forgotten,
  }
}
