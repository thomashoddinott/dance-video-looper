import { describe, expect, it } from 'vitest'

import {
  inMemoryStorage,
  storageThatRefuses,
} from '../drive/keyValueStorage.factory'
import { getLoop } from './loop.factory'
import { localLoopsCache, LOOPS_KEY } from './loopsCache'
import { NO_LOOPS } from './loopsFile'

const A_CLIP = 'shuffle-drill'

const someLoops = () => ({ ...NO_LOOPS, clips: { [A_CLIP]: [getLoop()] } })

/* UC-01 exception *c makes a hall with bad signal the expected case rather
   than the edge, and BR-13 already caches the clip's own bytes for it. Without
   this the clip would play from cache in a studio with no signal and the loops
   would not be there — the asset missing at the one moment it is wanted. */
describe('the loops this device has already seen', () => {
  it('gives back what it was given', () => {
    const cache = localLoopsCache(inMemoryStorage())

    cache.write(someLoops())

    expect(cache.read()).toEqual(someLoops())
  })

  it('has nothing to give back before Drive has ever answered', () => {
    expect(localLoopsCache(inMemoryStorage()).read()).toBeNull()
  })

  /* Validated by the same reader `loops.json` goes through, so a local copy
     cannot smuggle in a shape the Drive path would have refused. */
  it('answers nothing for a copy it cannot make sense of', () => {
    const cache = localLoopsCache(
      inMemoryStorage({ [LOOPS_KEY]: 'not the file we wrote' }),
    )

    expect(cache.read()).toBeNull()
  })

  it('drops a malformed loop out of the copy and keeps the rest', () => {
    const kept = getLoop({ id: 'kept' })
    const cache = localLoopsCache(
      inMemoryStorage({
        [LOOPS_KEY]: JSON.stringify({
          schema: 1,
          clips: { [A_CLIP]: [kept, { id: 'no-points' }] },
        }),
      }),
    )

    expect(cache.read()).toEqual({ ...NO_LOOPS, clips: { [A_CLIP]: [kept] } })
  })
})

/* A private window, or a quota already full. Neither is a reason to lose a
   loop: the read runs on boot, and the write runs *after* Drive has already
   taken the change. */
describe('a storage that will not co-operate', () => {
  it('reads as nothing rather than throwing on boot', () => {
    expect(localLoopsCache(storageThatRefuses()).read()).toBeNull()
  })

  it('swallows a failed write, because Drive already has the loop', () => {
    expect(() => {
      localLoopsCache(storageThatRefuses()).write(someLoops())
    }).not.toThrow()
  })
})
