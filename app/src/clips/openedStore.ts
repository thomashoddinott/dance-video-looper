import type { KeyValueStorage } from '../drive/tokenStore'

/* When each clip was last opened, as **this device** saw it (#16) — which is
   what the **Last opened** chip orders by.

   `localStorage`, and that is the whole design rather than a shortcut. Opening
   a clip is the commonest thing a practice session does; a Drive write per open
   would be four calls each time, aimed at the one file that holds the loops, and
   every one of them another chance at the `moved` / `unreadable` refusal — a
   refusal the dancer has to be told about. Paying that for an ordering would be
   the wrong way round, so the stamp lands here instantly and rides the next
   `loops.json` write to Drive (`withOpens`) rather than making one.

   The same seam `tokenStore` and `loopsCache` name, for the same reason: jsdom
   has no real `localStorage`. */
export const OPENED_KEY = 'looper.opened'

export type OpenedStore = {
  readonly read: () => Readonly<Record<string, string>>
  readonly stamp: (clipId: string, at: string) => void
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/* Both rules are `loopsFile`'s, deliberately identical: a string is not yet a
   time, and a time is not yet a *comparable* one. The two maps are compared
   against each other to answer "when was this last opened", and that comparison
   is a plain string order — chronological only in UTC. */
const isTime = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value))

const asUtc = (at: string) => new Date(at).toISOString()

/* Everything degrades to "nothing opened yet". Nothing here is the asset — the
   loops are — so there is no reading of this file worth failing over, and this
   runs on boot where a throw would be a white screen. */
const stampsFrom = (raw: string | null): Readonly<Record<string, string>> => {
  if (raw === null) return {}

  try {
    const held: unknown = JSON.parse(raw)

    if (!isRecord(held)) return {}

    return Object.fromEntries(
      Object.entries(held).flatMap<[string, string]>(([clipId, at]) =>
        isTime(at) ? [[clipId, asUtc(at)]] : [],
      ),
    )
  } catch {
    return {}
  }
}

export const localOpenedStore = (storage: KeyValueStorage): OpenedStore => {
  const read = () => {
    /* A private window and a locked-down storage both throw rather than
       answering, and this is on the boot path. */
    try {
      return stampsFrom(storage.getItem(OPENED_KEY))
    } catch {
      return {}
    }
  }

  return {
    read,

    stamp: (clipId, at) => {
      /* Swallowed, because the alternative is a clip that will not open. A
         quota already full costs the ordering, never a loop — nothing is stored
         only here that the dancer would miss. */
      try {
        storage.setItem(
          OPENED_KEY,
          JSON.stringify({ ...read(), [clipId]: asUtc(at) }),
        )
      } catch {
        /* the ordering forgets this one open */
      }
    },
  }
}

/* Injected from `App`, exactly as `browserLoopsCache` and `browserDriveApi`
   are, so importing this module never touches the global. */
export const browserOpenedStore = localOpenedStore({
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => {
    localStorage.setItem(key, value)
  },
  removeItem: (key) => {
    localStorage.removeItem(key)
  },
})
