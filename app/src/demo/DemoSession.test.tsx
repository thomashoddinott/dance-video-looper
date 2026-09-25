import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { DriveSessionProvider } from '../drive/DriveSessionProvider'
import { useDriveSession } from '../drive/driveSession'
import type { TokenSource } from '../drive/gisTokenSource'
import type { TokenStore } from '../drive/tokenStore'
import { DemoSession } from './DemoSession'

const nothingKept = (): TokenStore => ({
  read: () => null,
  write: () => {},
  clear: () => {},
})

const sourceGranting = () =>
  vi.fn<TokenSource>().mockResolvedValue({
    ok: true,
    grant: { value: 'ya29.real', expiresInSeconds: 3599 },
  })

const inTheDemo = (tokenSource: TokenSource) => {
  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <DriveSessionProvider tokenSource={tokenSource} tokenStore={nothingKept()}>
      <DemoSession>{children}</DemoSession>
    </DriveSessionProvider>
  )

  return renderHook(() => useDriveSession(), { wrapper })
}

/* The library, the loops, the stills and the player all ask the session for a
   token before they touch their `DriveApi`. In the demo that api is the
   browser, so there is always a token — and asking Google for one would put a
   sign-in popup in front of a visitor who chose not to sign in. */
describe('the session inside the demo', () => {
  it('always has a token to hand out', async () => {
    const { result } = inTheDemo(sourceGranting())

    expect(await result.current.requireToken()).toMatchObject({
      available: true,
    })
  })

  it('never asks Google for it', async () => {
    const tokenSource = sourceGranting()
    const { result } = inTheDemo(tokenSource)

    await result.current.requireToken()

    expect(tokenSource).not.toHaveBeenCalled()
  })

  /* Signing in is how a visitor leaves the demo, so the status and the sign-in
     inside it are the real ones rather than a pretence of being connected. */
  it('still reports the real sign-in status', () => {
    const { result } = inTheDemo(sourceGranting())

    expect(result.current.status).toBe('signed-out')
  })

  it('signs in for real', async () => {
    const tokenSource = sourceGranting()
    const { result } = inTheDemo(tokenSource)

    await act(() => result.current.signIn())

    expect(tokenSource).toHaveBeenCalledOnce()
    expect(result.current.status).toBe('active')
  })

  /* A refusal from the demo's own api is not the dancer's Google account
     having withdrawn consent, and must not be reported as one. */
  it('does not let the demo report consent withdrawn on the real session', () => {
    const { result } = inTheDemo(sourceGranting())

    act(() => result.current.reportConsentWithdrawn())

    expect(result.current.status).toBe('signed-out')
  })
})
