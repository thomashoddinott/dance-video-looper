import type { KeyValueStorage } from '../drive/tokenStore'

/* The demo runs the real code over the real `localStorage`, so it writes the
   very key names the dancer's own library caches under — `looper.loops`,
   `looper.opened`. Putting every one of them under a prefix is what keeps a
   visitor's loops out of the dancer's, without the demo needing a copy of the
   code that writes them. */
export const prefixedStorage = (
  storage: KeyValueStorage,
  prefix: string,
): KeyValueStorage => ({
  getItem: (key) => storage.getItem(`${prefix}${key}`),
  setItem: (key, value) => {
    storage.setItem(`${prefix}${key}`, value)
  },
  removeItem: (key) => {
    storage.removeItem(`${prefix}${key}`)
  },
})
