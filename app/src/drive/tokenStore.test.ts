import { describe, expect, it } from 'vitest'

import { inMemoryStorage } from './keyValueStorage.factory'
import type { AccessToken } from './session'
import { localTokenStore } from './tokenStore'

const KEY = 'looper.drive.token'

const aToken = (overrides: Partial<AccessToken> = {}): AccessToken => ({
  value: 'ya29.a0-a-real-looking-access-token',
  expiresAt: 1_756_000_000_000,
  ...overrides,
})

describe('remembering the Drive token between visits', () => {
  it('gives back the token it was given, so a reload need not ask again', () => {
    const store = localTokenStore(inMemoryStorage())

    store.write(aToken({ value: 'ya29.from-the-last-visit' }))

    expect(store.read()).toEqual(aToken({ value: 'ya29.from-the-last-visit' }))
  })

  it('has nothing to give back on a first ever visit', () => {
    expect(localTokenStore(inMemoryStorage()).read()).toBeNull()
  })

  it('forgets the token when told to, so a withdrawn grant is not resumed', () => {
    const store = localTokenStore(inMemoryStorage())
    store.write(aToken())

    store.clear()

    expect(store.read()).toBeNull()
  })

  it('treats an unreadable entry as nothing rather than throwing on boot', () => {
    const store = localTokenStore(inMemoryStorage({ [KEY]: 'not json{' }))

    expect(store.read()).toBeNull()
  })

  it('treats an entry missing its token as nothing, not as a token of undefined', () => {
    const store = localTokenStore(
      inMemoryStorage({ [KEY]: '{"expiresAt":123}' }),
    )

    expect(store.read()).toBeNull()
  })
})
