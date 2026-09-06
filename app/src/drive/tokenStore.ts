import type { AccessToken } from './session'

/* localStorage rather than sessionStorage, on purpose: the point of the story
   is that the dancer connects once, and a token that dies with the tab means
   connecting on every reload. The spike settled that the grant itself survives
   across sessions (FINDINGS.md Q1), so resuming is honest rather than a guess.

   The token is a one-hour Drive access token, not a refresh token — there is no
   refresh token to leak, because getting one needs a client secret and
   therefore a backend, which this architecture rules out. */
const KEY = 'looper.drive.token'

export type TokenStore = {
  readonly read: () => AccessToken | null
  readonly write: (token: AccessToken) => void
  readonly clear: () => void
}

/* The three methods of `localStorage` this uses, named rather than taking the
   DOM's `Storage`. jsdom hands the test environment an empty object under that
   name, so depending on the real type would mean the tests could not run at
   all — and it is a narrower contract to honour besides. */
export type KeyValueStorage = {
  readonly getItem: (key: string) => string | null
  readonly setItem: (key: string, value: string) => void
  readonly removeItem: (key: string) => void
}

const parse = (raw: string): AccessToken | null => {
  try {
    const stored: unknown = JSON.parse(raw)

    if (typeof stored !== 'object' || stored === null) return null
    if (!('value' in stored) || !('expiresAt' in stored)) return null

    const { value, expiresAt } = stored

    if (typeof value !== 'string' || typeof expiresAt !== 'number') return null

    return { value, expiresAt }
  } catch {
    /* Anything unreadable is treated as nothing. This runs on boot, so throwing
       here would be a white screen rather than a sign-in prompt. */
    return null
  }
}

export const localTokenStore = (storage: KeyValueStorage): TokenStore => ({
  read: () => {
    const raw = storage.getItem(KEY)

    return raw === null ? null : parse(raw)
  },
  write: (token) => {
    storage.setItem(KEY, JSON.stringify(token))
  },
  clear: () => {
    storage.removeItem(KEY)
  },
})
