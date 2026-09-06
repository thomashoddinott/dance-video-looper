import { describe, expect, it } from 'vitest'

import {
  inMemoryStorage,
  storageThatRefuses,
} from '../drive/keyValueStorage.factory'
import { localOpenedStore, OPENED_KEY } from './openedStore'

const A_CLIP = 'shuffle-drill'
const ANOTHER_CLIP = 'pivot-turn'

const AT = '2026-09-06T18:04:11.000Z'
const LATER = '2026-09-06T21:30:00.000Z'

const written = (stamps: Record<string, unknown>) => JSON.stringify(stamps)

/* When each clip was last opened *on this device* (#16). It lives here rather
   than in `loops.json` because opening a clip is the commonest thing a session
   does, and a Drive write per open would put the file holding the loops in the
   path of an action worth nothing — four calls, and a refusal the dancer would
   have to be told about, for an ordering. */
describe('the clips this device has opened', () => {
  it('knows nothing before anything has been opened', () => {
    expect(localOpenedStore(inMemoryStorage()).read()).toEqual({})
  })

  it('remembers a clip that was opened', () => {
    const storage = inMemoryStorage()
    const store = localOpenedStore(storage)

    store.stamp(A_CLIP, AT)

    expect(store.read()).toEqual({ [A_CLIP]: AT })
  })

  /* The point of persisting rather than holding it in memory: the ordering has
     to survive the reload that a phone gives you for free when it reclaims the
     tab. */
  it('survives a reload, because it is written to storage', () => {
    const storage = inMemoryStorage()

    localOpenedStore(storage).stamp(A_CLIP, AT)

    expect(localOpenedStore(storage).read()).toEqual({ [A_CLIP]: AT })
  })

  it('moves the stamp on when the same clip is opened again', () => {
    const store = localOpenedStore(inMemoryStorage())

    store.stamp(A_CLIP, AT)
    store.stamp(A_CLIP, LATER)

    expect(store.read()).toEqual({ [A_CLIP]: LATER })
  })

  it('keeps a stamp per clip', () => {
    const store = localOpenedStore(inMemoryStorage())

    store.stamp(A_CLIP, AT)
    store.stamp(ANOTHER_CLIP, LATER)

    expect(store.read()).toEqual({ [A_CLIP]: AT, [ANOTHER_CLIP]: LATER })
  })

  /* Every rule below is the same one `loopsFile` makes about `touched`, for the
     same reason: an ordering is not worth failing over. Nothing here can cost
     the dancer a loop, so everything degrades to "nothing opened yet" rather
     than throwing on a boot path. */
  it('reads a body that is not JSON as nothing opened', () => {
    expect(
      localOpenedStore(inMemoryStorage({ [OPENED_KEY]: 'not json' })).read(),
    ).toEqual({})
  })

  it('reads a body that is not a map as nothing opened', () => {
    expect(
      localOpenedStore(inMemoryStorage({ [OPENED_KEY]: '["nope"]' })).read(),
    ).toEqual({})
  })

  it('drops a stamp that is not a time and keeps its siblings', () => {
    expect(
      localOpenedStore(
        inMemoryStorage({
          [OPENED_KEY]: written({ broken: 'last Tuesday-ish', kept: AT }),
        }),
      ).read(),
    ).toEqual({ kept: AT })
  })

  /* Same normalisation `loopsFile` does, and it has to be the same because the
     two maps are compared against each other to answer "when was this opened":
     these are ordered as plain strings, which is chronological only in UTC. */
  it('normalises a stamp that arrived in some other time zone', () => {
    expect(
      localOpenedStore(
        inMemoryStorage({
          [OPENED_KEY]: written({ [A_CLIP]: '2026-09-06T19:04:11+02:00' }),
        }),
      ).read(),
    ).toEqual({ [A_CLIP]: '2026-09-06T17:04:11.000Z' })
  })

  /* A private window, or a quota already full. This runs on boot and on every
     open, so throwing would be a white screen or a dead tile — and the cost of
     swallowing it is an ordering that forgets, which is the right way round. */
  it('survives storage that refuses to be read', () => {
    expect(localOpenedStore(storageThatRefuses()).read()).toEqual({})
  })

  it('survives storage that refuses to be written', () => {
    const store = localOpenedStore(storageThatRefuses())

    expect(() => {
      store.stamp(A_CLIP, AT)
    }).not.toThrow()
  })
})
