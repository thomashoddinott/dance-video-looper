import type { Clip } from './clip'

/* One clip every test can start from, overriding only what its own case is
   about. Complete by construction — a factory that returns half an object makes
   every caller repair it. */
export const getClip = (overrides: Partial<Clip> = {}): Clip => ({
  id: 'shuffle-drill',
  name: 'Shuffle drill',
  added: '2026-08-12',
  seconds: 26,
  loops: 0,
  ...overrides,
})
