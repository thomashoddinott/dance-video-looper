import type { KeyValueStorage } from '../drive/tokenStore'

/* #66. Where the demo keeps what a visitor does — loops, last-opened stamps —
   for as long as they stay in it, and no longer. The browser's own storage
   would outlive the visit, and the demo is not persistent: a visitor who comes
   back finds it as they first did. */
export const memoryStorage = (): KeyValueStorage => {
  const entries = new Map<string, string>()

  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value)
    },
    removeItem: (key) => {
      entries.delete(key)
    },
  }
}
