import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { DriveApi } from '../drive/driveApi'
import { DriveError } from '../drive/driveApi'
import { A_LOOPS_FILE, aDriveApi } from '../drive/driveApi.factory'
import { DriveSessionProvider } from '../drive/DriveSessionProvider'
import type { TokenSource } from '../drive/gisTokenSource'
import type { TokenStore } from '../drive/tokenStore'
import { getLoop } from './loop.factory'
import type { LoopsCache } from './loopsCache'
import { aLoopsCache } from './loopsCache.factory'
import { NO_LOOPS, serialiseLoops } from './loopsFile'
import { useLoops } from './useLoops'

const AN_HOUR = 3599
const A_CLIP = 'shuffle-drill'

const aTokenStore = (): TokenStore => ({
  read: () => ({ value: 'ya29.kept', expiresAt: Date.now() + AN_HOUR * 1000 }),
  write: () => {},
  clear: () => {},
})

const keepingNothing = (): TokenStore => ({
  read: () => null,
  write: () => {},
  clear: () => {},
})

const granting: TokenSource = async () => ({
  ok: true,
  grant: { value: 'ya29.a-token', expiresInSeconds: AN_HOUR },
})

const unreachable: TokenSource = async () => ({
  ok: false,
  because: 'drive-unreachable',
})

const holding = (clips: Record<string, readonly ReturnType<typeof getLoop>[]>) =>
  aDriveApi({
    findJson: vi.fn(async () => ({ id: A_LOOPS_FILE, version: '3' })),
    readJson: vi.fn(async () => serialiseLoops({ ...NO_LOOPS, clips })),
  })

const renderLoops = (
  api: DriveApi,
  {
    cache = aLoopsCache(),
    tokenSource = granting,
    tokenStore = aTokenStore(),
  }: {
    readonly cache?: LoopsCache
    readonly tokenSource?: TokenSource
    readonly tokenStore?: TokenStore
  } = {},
) =>
  renderHook(() => useLoops(api, cache), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <DriveSessionProvider tokenSource={tokenSource} tokenStore={tokenStore}>
        {children}
      </DriveSessionProvider>
    ),
  })

describe('reading the loops on load', () => {
  it('reads what Drive holds', async () => {
    const loop = getLoop()

    const { result } = renderLoops(holding({ [A_CLIP]: [loop] }))

    await waitFor(() => {
      expect(result.current.loops.clips).toEqual({ [A_CLIP]: [loop] })
    })
  })

  it('keeps the copy for the next time there is no signal', async () => {
    const loop = getLoop()
    const cache = aLoopsCache()

    renderLoops(holding({ [A_CLIP]: [loop] }), { cache })

    await waitFor(() => {
      expect(cache.write).toHaveBeenCalledWith({
        ...NO_LOOPS,
        clips: { [A_CLIP]: [loop] },
      })
    })
  })

  /* BR-13's ordering argument, applied to the loops rather than the bytes: the
     local copy is on screen from the first render, so a hall with no signal
     shows the loops it already knows about instead of an empty panel. */
  it('starts from the local copy rather than from nothing', () => {
    const loop = getLoop()

    const { result } = renderLoops(aDriveApi(), {
      cache: aLoopsCache({
        read: () => ({ ...NO_LOOPS, clips: { [A_CLIP]: [loop] } }),
      }),
    })

    expect(result.current.loops.clips).toEqual({ [A_CLIP]: [loop] })
  })

  it('holds on to the local copy when Drive cannot be reached', async () => {
    const loop = getLoop()
    const api = aDriveApi()

    const { result } = renderLoops(api, {
      cache: aLoopsCache({
        read: () => ({ ...NO_LOOPS, clips: { [A_CLIP]: [loop] } }),
      }),
      tokenSource: unreachable,
      tokenStore: keepingNothing(),
    })

    await waitFor(() => {
      expect(api.findOrCreateFolder).not.toHaveBeenCalled()
    })
    expect(result.current.loops.clips).toEqual({ [A_CLIP]: [loop] })
  })

  /* Offline is the expected case here, not an error — UC-01 exception *c —
     so it does not get a sentence. Only a *write* that failed does. */
  it('says nothing about being offline', async () => {
    const { result } = renderLoops(aDriveApi(), {
      tokenSource: unreachable,
      tokenStore: keepingNothing(),
    })

    await waitFor(() => {
      expect(result.current.notice).toBeNull()
    })
  })
})

describe('saving a loop', () => {
  it('puts it in Drive, and then in the list', async () => {
    const loop = getLoop()
    const api = holding({})

    const { result } = renderLoops(api)

    await waitFor(() => {
      expect(api.readJson).toHaveBeenCalled()
    })
    await result.current.save(A_CLIP, loop)

    expect(api.writeJson).toHaveBeenCalled()
    await waitFor(() => {
      expect(result.current.loops.clips).toEqual({ [A_CLIP]: [loop] })
    })
  })

  /* The panel clears the name field on a save and must not do it on one that
     failed — a dancer who typed "the hard bit" and lost the write should not
     also lose what they called it, and the retry is one press away. */
  it('says whether the write landed', async () => {
    const api = holding({})

    const { result } = renderLoops(api)

    await expect(result.current.save(A_CLIP, getLoop())).resolves.toBe(true)

    vi.mocked(api.writeJson).mockRejectedValue(new DriveError('boom', 500))

    await expect(result.current.save(A_CLIP, getLoop())).resolves.toBe(false)
  })

  it('refreshes the local copy with what was written', async () => {
    const loop = getLoop()
    const cache = aLoopsCache()

    const { result } = renderLoops(holding({}), { cache })

    await result.current.save(A_CLIP, loop)

    expect(cache.write).toHaveBeenCalledWith({
      ...NO_LOOPS,
      clips: { [A_CLIP]: [loop] },
    })
  })

  /* The criterion the whole story turns on: a loop silently lost is the worst
     outcome this app has, so a write that did not land adds nothing to the
     list — the list means "what is in Drive" at every moment. */
  it('adds nothing and says so when the write fails', async () => {
    const api = holding({})

    vi.mocked(api.writeJson).mockRejectedValue(new DriveError('boom', 500))

    const { result } = renderLoops(api)

    await result.current.save(A_CLIP, getLoop({ name: 'The hard bit' }))

    await waitFor(() => {
      expect(result.current.notice).toContain('The hard bit')
    })
    expect(result.current.loops).toEqual(NO_LOOPS)
  })

  /* A refusal rather than a failure, and it needs its own sentence: the loop is
     not saved *and* the dancer's existing loops are still sitting in a file the
     app will not touch. Telling them "could not be saved" would hide that. */
  it('says the file could not be read when that is what stopped it', async () => {
    const api = aDriveApi({
      findJson: vi.fn(async () => ({ id: A_LOOPS_FILE, version: '3' })),
      readJson: vi.fn(async () => 'not the file we wrote'),
    })

    const { result } = renderLoops(api)

    await result.current.save(A_CLIP, getLoop())

    await waitFor(() => {
      expect(result.current.notice).toMatch(/could not be read/i)
    })
    expect(api.writeJson).not.toHaveBeenCalled()
  })

  /* The session retires a token early so an expiry cannot arrive as a 401 —
     what is left is a grant the dancer revoked, and DriveStatus has a sentence
     for it. It matters most here: a write that failed on a withdrawn grant
     must not be reported as a saved loop. */
  it('reports a withdrawn grant', async () => {
    const api = holding({})

    vi.mocked(api.writeJson).mockRejectedValue(new DriveError('gone', 401))

    const { result } = renderLoops(api)

    await result.current.save(A_CLIP, getLoop())

    await waitFor(() => {
      expect(result.current.notice).not.toBeNull()
    })
    expect(result.current.loops).toEqual(NO_LOOPS)
  })

  /* The two hundred milliseconds the panel has to cover. Held open with a real
     gate rather than a stub that only looks like one, the same liberty
     `clipSource.test.tsx` takes for a download still in flight. */
  it('is writing while the write is in flight, and done afterwards', async () => {
    const gate = new EventTarget()
    const held = new Promise<void>((resolve) => {
      gate.addEventListener('let-go', () => resolve(), { once: true })
    })
    const api = holding({})

    vi.mocked(api.writeJson).mockImplementation(async () => {
      await held

      return { id: A_LOOPS_FILE, version: '4' }
    })

    const { result } = renderLoops(api)

    const saving = result.current.save(A_CLIP, getLoop())

    await waitFor(() => {
      expect(result.current.writing).toBe(true)
    })

    gate.dispatchEvent(new Event('let-go'))
    await saving

    await waitFor(() => {
      expect(result.current.writing).toBe(false)
    })
  })
})

describe('removing a loop', () => {
  it('takes it out of Drive, and then out of the list', async () => {
    const going = getLoop({ id: 'going' })
    const kept = getLoop({ id: 'kept' })
    const api = holding({ [A_CLIP]: [going, kept] })

    const { result } = renderLoops(api)

    await waitFor(() => {
      expect(result.current.loops.clips[A_CLIP]).toHaveLength(2)
    })
    await result.current.remove(A_CLIP, 'going')

    await waitFor(() => {
      expect(result.current.loops.clips).toEqual({ [A_CLIP]: [kept] })
    })
  })

  it('leaves the loop in the list when the removal does not land', async () => {
    const loop = getLoop()
    const api = holding({ [A_CLIP]: [loop] })

    vi.mocked(api.writeJson).mockRejectedValue(new DriveError('boom', 500))

    const { result } = renderLoops(api)

    await waitFor(() => {
      expect(result.current.loops.clips[A_CLIP]).toEqual([loop])
    })
    await result.current.remove(A_CLIP, loop.id)

    await waitFor(() => {
      expect(result.current.notice).not.toBeNull()
    })
    expect(result.current.loops.clips).toEqual({ [A_CLIP]: [loop] })
  })
})
