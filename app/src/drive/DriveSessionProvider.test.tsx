import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DriveSessionProvider } from './DriveSessionProvider'
import { useDriveSession } from './driveSession'
import type { TokenSource } from './gisTokenSource'
import type { AccessToken } from './session'
import type { TokenStore } from './tokenStore'

const AN_HOUR_IN_SECONDS = 3599
const AN_HOUR_IN_MS = AN_HOUR_IN_SECONDS * 1000

const SIGN_IN = 1_756_000_000_000

const sourceGranting = (...values: readonly string[]) =>
  values.reduce(
    (source, value) =>
      source.mockResolvedValueOnce({
        ok: true,
        grant: { value, expiresInSeconds: AN_HOUR_IN_SECONDS },
      }),
    vi.fn<TokenSource>(),
  )

const sourceRefusing = () =>
  vi.fn<TokenSource>().mockResolvedValue({
    ok: false,
    because: 'consent-refused',
  })

const aTokenStore = (held: AccessToken | null = null) => {
  const kept = new Map(held === null ? [] : [['token', held]])

  return {
    read: () => kept.get('token') ?? null,
    write: (token: AccessToken) => {
      kept.set('token', token)
    },
    clear: () => {
      kept.delete('token')
    },
  } satisfies TokenStore
}

const withDriveSession = (
  tokenSource: TokenSource,
  tokenStore: TokenStore = aTokenStore(),
) => {
  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <DriveSessionProvider tokenSource={tokenSource} tokenStore={tokenStore}>
      {children}
    </DriveSessionProvider>
  )

  return renderHook(() => useDriveSession(), { wrapper })
}

const atTheStartOfTheHour = () => {
  vi.useFakeTimers()
  vi.setSystemTime(SIGN_IN)
}

afterEach(() => {
  vi.useRealTimers()
})

describe('signing in to Drive', () => {
  it('holds the token Google grants', async () => {
    atTheStartOfTheHour()
    const { result } = withDriveSession(sourceGranting('ya29.first'))

    await act(async () => {
      await result.current.signIn()
    })

    expect(result.current.status).toBe('active')
  })

  it('records a refusal instead of retrying at the dancer', async () => {
    atTheStartOfTheHour()
    const { result } = withDriveSession(sourceRefusing())

    await act(async () => {
      await result.current.signIn()
    })

    expect(result.current.status).toBe('consent-refused')
  })
})

describe('renewing an expired Drive token', () => {
  it('renews when the dancer does something that needs Drive', async () => {
    atTheStartOfTheHour()
    const source = sourceGranting('ya29.first', 'ya29.renewed')
    const { result } = withDriveSession(source)

    await act(async () => {
      await result.current.signIn()
    })
    act(() => {
      vi.advanceTimersByTime(AN_HOUR_IN_MS)
    })

    const lookup = await act(async () => result.current.requireToken())

    expect(lookup).toEqual({ available: true, value: 'ya29.renewed' })
  })

  it('never renews on the passage of time alone, so no popup arrives mid-move', async () => {
    atTheStartOfTheHour()
    const source = sourceGranting('ya29.first', 'ya29.renewed')
    const { result } = withDriveSession(source)

    await act(async () => {
      await result.current.signIn()
    })
    await act(async () => {
      vi.advanceTimersByTime(AN_HOUR_IN_MS * 3)
    })

    expect(source).toHaveBeenCalledTimes(1)
  })

  it('leaves a live token alone rather than spending a popup on it', async () => {
    atTheStartOfTheHour()
    const source = sourceGranting('ya29.first', 'ya29.renewed')
    const { result } = withDriveSession(source)

    await act(async () => {
      await result.current.signIn()
    })

    const lookup = await act(async () => result.current.requireToken())

    expect(lookup).toEqual({ available: true, value: 'ya29.first' })
    expect(source).toHaveBeenCalledTimes(1)
  })

  it('does not sign a dancer in behind their back when they never signed in at all', async () => {
    atTheStartOfTheHour()
    const source = sourceGranting('ya29.first')
    const { result } = withDriveSession(source)

    const lookup = await act(async () => result.current.requireToken())

    expect(lookup).toEqual({ available: false, because: 'signed-out' })
    expect(source).not.toHaveBeenCalled()
  })
})

describe('returning after closing the tab', () => {
  it('resumes the session it held, rather than making the dancer connect again', () => {
    atTheStartOfTheHour()
    const source = sourceGranting('ya29.first')
    const held = { value: 'ya29.from-last-time', expiresAt: SIGN_IN + AN_HOUR_IN_MS }

    const { result } = withDriveSession(source, aTokenStore(held))

    expect(result.current.status).toBe('active')
    expect(source).not.toHaveBeenCalled()
  })

  it('keeps the token it was granted, so the next visit has one to resume', async () => {
    atTheStartOfTheHour()
    const store = aTokenStore()
    const { result } = withDriveSession(sourceGranting('ya29.first'), store)

    await act(async () => {
      await result.current.signIn()
    })

    expect(store.read()).toEqual({
      value: 'ya29.first',
      expiresAt: SIGN_IN + AN_HOUR_IN_MS,
    })
  })

  it('forgets a token whose consent was withdrawn, so it is not resumed next visit', async () => {
    atTheStartOfTheHour()
    const store = aTokenStore()
    const { result } = withDriveSession(sourceGranting('ya29.first'), store)

    await act(async () => {
      await result.current.signIn()
    })
    act(() => {
      result.current.reportConsentWithdrawn()
    })

    expect(store.read()).toBeNull()
  })
})

describe('reaching for the session outside the provider', () => {
  it('fails loudly, rather than handing back a session that quietly does nothing', () => {
    expect(() => renderHook(() => useDriveSession())).toThrow(
      /DriveSessionProvider/,
    )
  })
})

describe('consent withdrawn while the app was away', () => {
  it('reports Drive unavailable once a Drive call is refused', async () => {
    atTheStartOfTheHour()
    const { result } = withDriveSession(sourceGranting('ya29.first'))

    await act(async () => {
      await result.current.signIn()
    })
    act(() => {
      result.current.reportConsentWithdrawn()
    })

    expect(result.current.status).toBe('consent-withdrawn')
  })
})
