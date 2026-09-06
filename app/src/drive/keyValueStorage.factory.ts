import type { KeyValueStorage } from './tokenStore'

/* The `localStorage` this app actually uses, in memory. jsdom hands the test
   environment an empty object under that name, which is why `KeyValueStorage`
   exists at all — so the fake for it belongs beside the type rather than
   hand-rolled once per test file. */
export const inMemoryStorage = (
  seed: Readonly<Record<string, string>> = {},
): KeyValueStorage => {
  const entries = new Map(Object.entries(seed))

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

/* A private window, or a quota already full. The browser throws from
   `localStorage` rather than answering, and the two callers here must survive
   it differently from each other — so the fake has to be able to do it. */
export const storageThatRefuses = (): KeyValueStorage => ({
  getItem: () => {
    throw new Error('storage is not available')
  },
  setItem: () => {
    throw new Error('storage is full')
  },
  removeItem: () => {
    throw new Error('storage is not available')
  },
})
