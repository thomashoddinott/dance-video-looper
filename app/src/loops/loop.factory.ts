import type { SavedLoop } from './loop'

/* One loop every test can start from, overriding only what its own case is
   about. Complete by construction, exactly as `getClip` is — a factory that
   returns half an object makes every caller repair it. */
export const getLoop = (overrides: Partial<SavedLoop> = {}): SavedLoop => ({
  id: 'loop-1',
  name: 'Loop 1',
  a: 0,
  b: 12,
  speed: 1,
  ...overrides,
})
