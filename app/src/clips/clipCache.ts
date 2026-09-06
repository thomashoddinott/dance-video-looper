/* What a clip costs to fetch is measured, not guessed: the spike downloaded
   9.33 MB in 7.08 s, nearly all of it transfer. Practice is repetitive — the
   same clip plays dozens of times in a session — so keeping the bytes turns a
   per-play cost into a once-per-clip one, and buys working offline and a token
   nobody has to renew mid-move along with it (UC-01 BR-13).

   This is a **cache and never a store of record.** WebKit clears
   script-writable storage after about a week away, so everything here can
   vanish between sessions; Drive holds the clips, and a purge costs a
   re-download and nothing else. Nothing may become cache-only later. */

export type CachedClip = {
  readonly bytes: Blob
  readonly checksum: string | undefined
}

/* Everything about a cached clip except the bytes, which is what makes the
   budget affordable to enforce: totting up sizes reads only these, never the
   nine megabytes each one is describing. */
export type ClipEntry = {
  readonly clipId: string
  readonly checksum: string | undefined
  readonly sizeInBytes: number
  readonly lastOpenedAt: number
}

/* The narrow slice of a store this needs, named rather than taking IndexedDB's
   own types — the same discipline `tokenStore` applies to `localStorage` and
   `driveApi` to `fetch`. jsdom has no IndexedDB at all, so depending on it
   directly would mean a cache nothing could test; and the contract is small
   enough that swapping what is underneath costs nothing. */
export type CacheStore = {
  readonly entries: () => Promise<readonly ClipEntry[]>
  readonly read: (
    clipId: string,
  ) => Promise<{ readonly entry: ClipEntry; readonly bytes: Blob } | null>
  readonly save: (entry: ClipEntry, bytes: Blob) => Promise<void>
  readonly touch: (clipId: string, at: number) => Promise<void>
  readonly remove: (clipId: string) => Promise<void>
}

export type ClipCache = {
  readonly get: (clipId: string) => Promise<CachedClip | null>
  readonly put: (
    clipId: string,
    bytes: Blob,
    checksum: string | undefined,
  ) => Promise<void>
  /* Eviction the cache could never arrive at by itself. Everything else in here
     leaves because something newer needed the room, which is a judgement about
     how recently a clip was opened; a deleted clip is not coming back at all,
     so its bytes are budget held against nothing (UC-01 Q-08). */
  readonly forget: (clipId: string) => Promise<void>
}

/* Bytes rather than a count of clips, because clip sizes vary by more than an
   order of magnitude — the spike measured 574 KB and 9.33 MB in one session —
   so a count would bound the wrong quantity. Settled at US-01-16's approval
   gate; one constant, meant to move once there is real usage behind it. */
export const BUDGET_IN_BYTES = 500 * 1024 * 1024

/* Least-recently-opened first, until what is left fits. Recursive rather than a
   loop with a running total, so nothing here mutates — and the depth is bounded
   by how many clips are being dropped, which is one or two. */
const shrunk = async (
  store: CacheStore,
  budgetInBytes: number,
  oldestFirst: readonly ClipEntry[],
  held: number,
): Promise<void> => {
  const [oldest, ...rest] = oldestFirst

  if (held <= budgetInBytes || oldest === undefined) return

  await store.remove(oldest.clipId)

  return shrunk(store, budgetInBytes, rest, held - oldest.sizeInBytes)
}

const totalOf = (entries: readonly ClipEntry[]) =>
  entries.reduce((bytes, entry) => bytes + entry.sizeInBytes, 0)

export const clipCacheOver = (
  store: CacheStore,
  {
    budgetInBytes = BUDGET_IN_BYTES,
    now = () => Date.now(),
  }: {
    readonly budgetInBytes?: number
    readonly now?: () => number
  } = {},
): ClipCache => ({
  /* Reading writes, which looks odd until you ask what "least recently used"
     could otherwise mean. Opening a clip is the whole of using one, so a cache
     that only counted writes would evict the clip being practised with daily in
     favour of one added last week and never opened since. */
  get: async (clipId) => {
    const held = await store.read(clipId)

    if (held === null) return null

    await store.touch(clipId, now())

    return { bytes: held.bytes, checksum: held.entry.checksum }
  },

  put: async (clipId, bytes, checksum) => {
    /* Evicting the whole library to make room for something that still would
       not fit trades a set of instant clips for an empty cache and the same
       seven-second wait. Leave it uncached and re-download that one. */
    if (bytes.size > budgetInBytes) return

    await store.save(
      { clipId, checksum, sizeInBytes: bytes.size, lastOpenedAt: now() },
      bytes,
    )

    const entries = await store.entries()

    await shrunk(
      store,
      budgetInBytes,
      [...entries].sort((a, b) => a.lastOpenedAt - b.lastOpenedAt),
      totalOf(entries),
    )
  },

  /* Straight through to the store, which has been able to do this all along —
     it is how eviction works. What was missing was a way to ask for it by name
     rather than as a side effect of needing room. A clip that was never played
     was never cached, so being asked to forget one it never held is the common
     case and not an edge one. */
  forget: (clipId) => store.remove(clipId),
})

/* ------------------------------------------------------------------ stills

   #77's thumbnails, kept beside the clips they were taken from. Deliberately
   *outside* `BUDGET_IN_BYTES` and outside the LRU above: a still is tens of
   kilobytes against a clip's nine megabytes, and evicting one to make room for
   video would undo the whole reason for keeping it. There is nothing here to
   total up and nothing to shrink. */

export type ThumbnailStore = {
  readonly read: (clipId: string) => Promise<Blob | null>
  readonly save: (clipId: string, bytes: Blob) => Promise<void>
  readonly remove: (clipId: string) => Promise<void>
}

export type ThumbnailCache = {
  readonly get: (clipId: string) => Promise<Blob | null>
  readonly put: (clipId: string, bytes: Blob) => Promise<void>
  /* #78 deletes clips. A still whose clip is gone is bytes held against
     nothing — and worse, it would be handed straight to a tile if the same
     file were ever added again, showing a frame from the clip that was
     thrown away. */
  readonly forget: (clipId: string) => Promise<void>
}

/* Both failures are swallowed here rather than left to every caller, which the
   clip cache could not do: losing a clip's bytes means a seven-second
   re-download the player has to say something about, while a still that cannot
   be read is a tile that fetches thirty kilobytes again. It can always be
   remade from bytes that can always be fetched again, so a locked store — a
   private window, a browser that has evicted us — costs a fetch and must never
   cost a render. */
export const thumbnailCacheOver = (store: ThumbnailStore): ThumbnailCache => ({
  get: async (clipId) => {
    try {
      return await store.read(clipId)
    } catch {
      return null
    }
  },

  put: async (clipId, bytes) => {
    try {
      await store.save(clipId, bytes)
    } catch {
      /* the next open fetches it again */
    }
  },

  forget: async (clipId) => {
    try {
      await store.remove(clipId)
    } catch {
      /* thirty kilobytes held against a clip that is gone */
    }
  },
})

/* ------------------------------------------------------------- the browser's

   Everything below is composition-root code with no unit test, exactly like
   `putBytesOverXhr` and `browserTokenSource`: jsdom ships no IndexedDB, so
   there is nothing here a test in this project could drive. It is covered by
   the smoke test, and saying so is better than a green tick that means
   nothing. */

const DATABASE = 'looper.clips'
/* Bumped by #77, which added `THUMBNAILS`. `onupgradeneeded` creates only what
   is missing, so a device carrying version 1 gains the new store and keeps
   every clip it had cached. */
const VERSION = 2

/* Two object stores, not one. The budget has to total up sizes on every write,
   and reading whole records to do it would pull half a gigabyte of video
   through memory to add up a few numbers. `entries` is small enough to read
   whole; `bytes` is only ever touched by key. */
const ENTRIES = 'entries'
const BYTES = 'bytes'

/* A third, for #77's stills. In this database rather than one of its own
   because two modules opening one IndexedDB name at different versions is a
   race — so this module stays the only owner of `looper.clips`. It has no
   entries table beside it: nothing totals stills up, because nothing evicts
   them. */
const THUMBNAILS = 'thumbnails'

/* IndexedDB is event-based and everything above this line is promises. This is
   the whole of the translation. */
const promised = <T,>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result)
    }
    request.onerror = () => {
      reject(request.error ?? new Error('IndexedDB refused the request'))
    }
  })

const opened = (factory: IDBFactory) => {
  const request = factory.open(DATABASE, VERSION)

  request.onupgradeneeded = () => {
    const database = request.result

    if (!database.objectStoreNames.contains(ENTRIES)) {
      database.createObjectStore(ENTRIES, { keyPath: 'clipId' })
    }

    if (!database.objectStoreNames.contains(BYTES)) {
      database.createObjectStore(BYTES)
    }

    if (!database.objectStoreNames.contains(THUMBNAILS)) {
      database.createObjectStore(THUMBNAILS)
    }
  }

  return promised(request)
}

/* What comes back out of IndexedDB is whatever went in, and this module is the
   only thing that ever writes here — so the shape is asserted rather than
   parsed. A `tokenStore`-style validation would be defending against a
   corruption nothing in the app can cause, and the cost of being wrong is a
   re-download rather than a lost loop. */
const asEntry = (stored: unknown) => stored as ClipEntry | undefined

export const indexedDbCacheStore = (factory: () => IDBFactory): CacheStore => {
  /* Opened once, lazily. `let` because the memo is the point: touching
     `indexedDB` at module load would break every test file that imports the
     browser cache, and re-opening per call would be a handshake per read. */
  let database: Promise<IDBDatabase> | undefined

  const db = () => (database ??= opened(factory()))

  return {
    entries: async () =>
      (await promised(
        (await db())
          .transaction(ENTRIES, 'readonly')
          .objectStore(ENTRIES)
          .getAll(),
      )) as readonly ClipEntry[],

    read: async (clipId) => {
      const transaction = (await db()).transaction(
        [ENTRIES, BYTES],
        'readonly',
      )

      const [entry, bytes] = await Promise.all([
        promised(transaction.objectStore(ENTRIES).get(clipId)),
        promised(transaction.objectStore(BYTES).get(clipId)),
      ])

      const held = asEntry(entry)

      /* Both halves or neither. A record missing one of them is a write that
         was interrupted, and serving bytes with no checksum beside them would
         make a stale copy look fresh forever. */
      if (held === undefined || !(bytes instanceof Blob)) return null

      return { entry: held, bytes }
    },

    save: async (entry, bytes) => {
      const transaction = (await db()).transaction(
        [ENTRIES, BYTES],
        'readwrite',
      )

      await Promise.all([
        promised(transaction.objectStore(ENTRIES).put(entry)),
        promised(transaction.objectStore(BYTES).put(bytes, entry.clipId)),
      ])
    },

    /* Read and write in separate transactions, deliberately. Awaiting between
       two requests inside one IndexedDB transaction can let it commit early,
       and the cost of losing this particular race is an `lastOpenedAt` that is
       one open out of date — which changes nothing but eviction order. */
    touch: async (clipId, at) => {
      const held = asEntry(
        await promised(
          (await db())
            .transaction(ENTRIES, 'readonly')
            .objectStore(ENTRIES)
            .get(clipId),
        ),
      )

      if (held === undefined) return

      await promised(
        (await db())
          .transaction(ENTRIES, 'readwrite')
          .objectStore(ENTRIES)
          .put({ ...held, lastOpenedAt: at }),
      )
    },

    remove: async (clipId) => {
      const transaction = (await db()).transaction(
        [ENTRIES, BYTES],
        'readwrite',
      )

      await Promise.all([
        promised(transaction.objectStore(ENTRIES).delete(clipId)),
        promised(transaction.objectStore(BYTES).delete(clipId)),
      ])
    },
  }
}

/* Injected from `App`, exactly as `browserDriveApi` and `browserClipProbe` are.
   The factory is a function rather than the global itself so that importing
   this module never touches `indexedDB` — jsdom has none, and every test file
   that reaches the player imports its way here. */
export const browserClipCache = clipCacheOver(
  indexedDbCacheStore(() => indexedDB),
)

/* The stills, over the same database and the same lazily-opened handle. Keyed
   by clip id, with no entry record beside the bytes: there is no budget to
   enforce and no eviction order to keep, so there is nothing to record. */
export const indexedDbThumbnailStore = (
  factory: () => IDBFactory,
): ThumbnailStore => {
  let database: Promise<IDBDatabase> | undefined

  const db = () => (database ??= opened(factory()))

  return {
    read: async (clipId) => {
      const held = await promised(
        (await db())
          .transaction(THUMBNAILS, 'readonly')
          .objectStore(THUMBNAILS)
          .get(clipId),
      )

      return held instanceof Blob ? held : null
    },

    save: async (clipId, bytes) => {
      await promised(
        (await db())
          .transaction(THUMBNAILS, 'readwrite')
          .objectStore(THUMBNAILS)
          .put(bytes, clipId),
      )
    },

    remove: async (clipId) => {
      await promised(
        (await db())
          .transaction(THUMBNAILS, 'readwrite')
          .objectStore(THUMBNAILS)
          .delete(clipId),
      )
    },
  }
}

export const browserThumbnailCache = thumbnailCacheOver(
  indexedDbThumbnailStore(() => indexedDB),
)

