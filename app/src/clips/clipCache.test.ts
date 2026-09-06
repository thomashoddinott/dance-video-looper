import { describe, expect, it } from 'vitest'

import type { CacheStore, ClipEntry, ThumbnailStore } from './clipCache'
import { clipCacheOver, thumbnailCacheOver } from './clipCache'

const bytesOf = (size: number) => new Blob([new Uint8Array(size)])

/* Storage is stateful by definition, so the fake for it is too. The `Map` is the
   one piece of mutable state here and it stands in for the thing that is
   genuinely mutable — the same liberty `media.ts` takes for a video element. */
const aStore = () => {
  const kept = new Map<string, { entry: ClipEntry; bytes: Blob }>()

  const store: CacheStore = {
    entries: () => Promise.resolve([...kept.values()].map(({ entry }) => entry)),
    read: (clipId) => Promise.resolve(kept.get(clipId) ?? null),
    save: (entry, bytes) => {
      kept.set(entry.clipId, { entry, bytes })

      return Promise.resolve()
    },
    touch: (clipId, at) => {
      const held = kept.get(clipId)

      if (held) kept.set(clipId, { ...held, entry: { ...held.entry, lastOpenedAt: at } })

      return Promise.resolve()
    },
    remove: (clipId) => {
      kept.delete(clipId)

      return Promise.resolve()
    },
  }

  return { store, holds: () => [...kept.keys()] }
}

/* A clock that only moves when a test moves it, so "least recently opened" is
   something the test states rather than something it hopes the machine is fast
   enough to distinguish. */
const aClock = (readings: readonly number[]) => {
  const ticks = [...readings]

  return () => ticks.shift() ?? readings[readings.length - 1] ?? 0
}

describe('keeping a clip for next time', () => {
  it('hands back the bytes it was given', async () => {
    const { store } = aStore()
    const cache = clipCacheOver(store, { budgetInBytes: 100 })

    await cache.put('shuffle', bytesOf(9), 'md5-1')

    expect((await cache.get('shuffle'))?.bytes.size).toBe(9)
  })

  it('has nothing for a clip it was never given', async () => {
    const { store } = aStore()
    const cache = clipCacheOver(store, { budgetInBytes: 100 })

    expect(await cache.get('never-seen')).toBeNull()
  })

  /* Kept beside the bytes, because it is the only way to tell later whether
     what is stored is still what Drive holds — and asking Drive would defeat
     the point of having cached anything. */
  it('remembers the checksum the bytes were stored under', async () => {
    const { store } = aStore()
    const cache = clipCacheOver(store, { budgetInBytes: 100 })

    await cache.put('shuffle', bytesOf(9), 'md5-1')

    expect((await cache.get('shuffle'))?.checksum).toBe('md5-1')
  })
})

/* A clip the dancer deleted is not coming back, so the bytes it left behind are
   budget held against nothing — the least useful thing in the cache, and the
   only kind of entry eviction can never reach on its own merits (UC-01 Q-08). */
describe('forgetting a clip that has been deleted', () => {
  it('gives the bytes back to the budget', async () => {
    const { store, holds } = aStore()
    const cache = clipCacheOver(store, { budgetInBytes: 100 })

    await cache.put('shuffle', bytesOf(9), 'md5-1')
    await cache.forget('shuffle')

    expect(holds()).toEqual([])
  })

  it('leaves every other clip where it was', async () => {
    const { store, holds } = aStore()
    const cache = clipCacheOver(store, { budgetInBytes: 100 })

    await cache.put('shuffle', bytesOf(9), 'md5-1')
    await cache.put('slide', bytesOf(9), 'md5-2')
    await cache.forget('shuffle')

    expect(holds()).toEqual(['slide'])
  })

  /* The common case, not the edge one: a clip is only in the cache once it has
     been played, and plenty are deleted having never been opened. A throw here
     would fail a delete over bytes that were never there. */
  it('is quiet about a clip it never held', async () => {
    const { store } = aStore()
    const cache = clipCacheOver(store, { budgetInBytes: 100 })

    await expect(cache.forget('never-played')).resolves.toBeUndefined()
  })
})

describe('keeping the cache under its budget', () => {
  /* Opening a clip is what makes it recently used, so reading has to write. A
     cache that only counted writes would evict the clip being practised with
     every day in favour of one added last week and never opened since. */
  it('counts opening a clip as using it', async () => {
    const { store } = aStore()
    const cache = clipCacheOver(store, {
      budgetInBytes: 10,
      now: aClock([1, 2, 3, 4, 5]),
    })

    await cache.put('first', bytesOf(4), undefined)
    await cache.put('second', bytesOf(4), undefined)
    await cache.get('first')
    await cache.put('third', bytesOf(4), undefined)

    expect((await store.entries()).map(({ clipId }) => clipId)).toEqual([
      'first',
      'third',
    ])
  })

  it('evicts the least recently opened until what is left fits', async () => {
    const { store, holds } = aStore()
    const cache = clipCacheOver(store, {
      budgetInBytes: 10,
      now: aClock([1, 2, 3]),
    })

    await cache.put('oldest', bytesOf(4), undefined)
    await cache.put('middle', bytesOf(4), undefined)
    await cache.put('newest', bytesOf(4), undefined)

    expect(holds()).toEqual(['middle', 'newest'])
  })

  it('keeps everything while there is room', async () => {
    const { store, holds } = aStore()
    const cache = clipCacheOver(store, {
      budgetInBytes: 100,
      now: aClock([1, 2]),
    })

    await cache.put('one', bytesOf(4), undefined)
    await cache.put('two', bytesOf(4), undefined)

    expect(holds()).toEqual(['one', 'two'])
  })

  /* Evicting the whole library to make room for something that still would not
     fit trades a set of instant clips for an empty cache and the same seven
     second wait. Better to leave it uncached and re-download that one. */
  it('does not cache a clip bigger than the whole budget, or evict for it', async () => {
    const { store, holds } = aStore()
    const cache = clipCacheOver(store, {
      budgetInBytes: 10,
      now: aClock([1, 2]),
    })

    await cache.put('small', bytesOf(4), undefined)
    await cache.put('enormous', bytesOf(20), undefined)

    expect(holds()).toEqual(['small'])
  })
})

/* #77's stills. A separate store in the same database rather than a second
   cache beside it: two modules opening one IndexedDB name at different
   versions is a race, so `clipCache` stays the only owner of `looper.clips`. */
const aThumbnailStore = ({ broken = false } = {}) => {
  const kept = new Map<string, Blob>()

  const refuse = () => Promise.reject(new Error('storage is locked'))

  const store: ThumbnailStore = broken
    ? { read: refuse, save: refuse, remove: refuse }
    : {
        read: (clipId) => Promise.resolve(kept.get(clipId) ?? null),
        save: (clipId, bytes) => {
          kept.set(clipId, bytes)

          return Promise.resolve()
        },
        remove: (clipId) => {
          kept.delete(clipId)

          return Promise.resolve()
        },
      }

  return { store, holds: () => [...kept.keys()] }
}

describe('keeping a clip’s still for next time', () => {
  it('hands back the still it was given', async () => {
    const { store } = aThumbnailStore()
    const cache = thumbnailCacheOver(store)

    await cache.put('shuffle', bytesOf(31_204))

    expect((await cache.get('shuffle'))?.size).toBe(31_204)
  })

  it('has nothing for a clip it was never given', async () => {
    const cache = thumbnailCacheOver(aThumbnailStore().store)

    await expect(cache.get('never-seen')).resolves.toBeNull()
  })

  /* A private window, or storage the browser has locked. The stills are the
     one thing in this app that can always be made again from bytes it can
     always fetch again, so a cache that will not answer costs a fetch and must
     never cost a render — which is why the failure is swallowed here rather
     than left for every caller to remember a catch for. */
  it('reads as empty when the store cannot be reached at all', async () => {
    const cache = thumbnailCacheOver(aThumbnailStore({ broken: true }).store)

    await expect(cache.get('shuffle')).resolves.toBeNull()
  })

  it('gives up quietly on a store that will not take the still', async () => {
    const cache = thumbnailCacheOver(aThumbnailStore({ broken: true }).store)

    await expect(cache.put('shuffle', bytesOf(31_204))).resolves.toBeUndefined()
  })

  /* #78 deletes clips now. A still whose clip is gone is bytes held against
     nothing, and — worse — would be handed to a tile if the same file were ever
     added again, showing a frame from the clip that was thrown away. */
  it('forgets a still whose clip has been deleted', async () => {
    const { store, holds } = aThumbnailStore()
    const cache = thumbnailCacheOver(store)

    await cache.put('shuffle', bytesOf(31_204))
    await cache.forget('shuffle')

    expect(holds()).toEqual([])
    await expect(cache.get('shuffle')).resolves.toBeNull()
  })

  it('gives up quietly when the store will not forget', async () => {
    const cache = thumbnailCacheOver(aThumbnailStore({ broken: true }).store)

    await expect(cache.forget('shuffle')).resolves.toBeUndefined()
  })

  /* Stills are tens of kilobytes against a clip's nine megabytes, so they are
     deliberately outside the clip budget and its LRU. Evicting a still to make
     room for video would undo the whole point of keeping one. */
  it('leaves the clip budget alone', async () => {
    const clips = aStore()
    const cache = thumbnailCacheOver(aThumbnailStore().store)

    await cache.put('shuffle', bytesOf(31_204))

    expect(clips.holds()).toEqual([])
  })
})
