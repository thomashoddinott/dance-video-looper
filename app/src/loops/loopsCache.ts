import type { KeyValueStorage } from '../drive/tokenStore'
import type { LoopsFile } from './loopsFile'
import { readLoopsFile, serialiseLoops } from './loopsFile'

/* The loops this device has already been told about, kept so that a studio
   with no signal still shows them.

   UC-01 exception *c makes bad signal the expected case rather than the edge,
   and BR-13 already caches the clip's own bytes for it — so without this the
   clip would play from cache and the loops beside it would be empty, which is
   the asset missing at exactly the moment it is wanted.

   **A cache, and never a store of record.** Drive holds the loops; this is
   refreshed from every successful read and every successful write, and losing
   it costs one online load. Nothing may ever be saved only here — a write that
   cannot reach Drive fails loudly instead (US-01-15's failure criterion), and
   the read side falling back is what makes that acceptable rather than harsh. */
export const LOOPS_KEY = 'looper.loops'

/* `localStorage` rather than a second IndexedDB store. `loops.json` is
   kilobytes; the clip cache needs IndexedDB because it holds blobs and has to
   total up sizes without reading them, and neither is true here. This is the
   same seam `tokenStore` names for the same reason — jsdom has no real
   `localStorage`. */
export type LoopsCache = {
  readonly read: () => LoopsFile | null
  readonly write: (loops: LoopsFile) => void
}

export const localLoopsCache = (storage: KeyValueStorage): LoopsCache => ({
  read: () => {
    /* Runs on boot, so anything that throws here is a white screen rather
       than a slow load. A private window and a locked-down storage both do. */
    try {
      const raw = storage.getItem(LOOPS_KEY)

      if (raw === null) return null

      /* Through the same reader `loops.json` goes through, so a local copy
         cannot smuggle in a shape the Drive path would have refused — and a
         copy that will not parse is simply no copy. There is nothing to
         preserve here the way there is in Drive: this one is disposable. */
      const held = readLoopsFile(raw)

      return held.readable ? held.loops : null
    } catch {
      return null
    }
  },

  write: (loops) => {
    /* Swallowed on purpose, and only safe because of the order it runs in:
       this is called *after* Drive has taken the change. A quota that is
       already full costs the next offline open, never a loop. */
    try {
      storage.setItem(LOOPS_KEY, serialiseLoops(loops))
    } catch {
      /* the next online load pays for it */
    }
  },
})

/* Injected from `App`, exactly as `browserClipCache` and `browserDriveApi` are.
   The three methods are wrapped rather than `localStorage` being handed over
   whole, so importing this module never touches the global — the same care
   `browserClipCache` takes with `indexedDB`, and for the same reason: every
   test file that reaches either screen imports its way here. */
export const browserLoopsCache = localLoopsCache({
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => {
    localStorage.setItem(key, value)
  },
  removeItem: (key) => {
    localStorage.removeItem(key)
  },
})
