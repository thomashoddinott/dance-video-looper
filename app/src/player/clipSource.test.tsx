import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { ClipCache } from '../clips/clipCache'
import {
  holding as alreadyHolding,
  holdsNothing,
} from '../clips/clipCache.factory'
import { getClip } from '../clips/clip.factory'
import type { DriveApi } from '../drive/driveApi'
import { DriveError } from '../drive/driveApi'
import { aDriveApi } from '../drive/driveApi.factory'
import { DriveSessionProvider } from '../drive/DriveSessionProvider'
import type { TokenSource } from '../drive/gisTokenSource'
import type { TokenStore } from '../drive/tokenStore'
import { useClipSource } from './clipSource'

const AN_HOUR = 3599

const granting: TokenSource = async () => ({
  ok: true,
  grant: { value: 'ya29.a-token', expiresInSeconds: AN_HOUR },
})

const aConnectedStore = (): TokenStore => ({
  read: () => ({ value: 'ya29.kept', expiresAt: Date.now() + AN_HOUR * 1000 }),
  write: () => {},
  clear: () => {},
})

const THE_BYTES = new Blob([new Uint8Array(9)])

/* The shared factory, plus the one default this file wants differently: every
   case here is about the bytes, so they have to be the same bytes each time. */
const anApi = (overrides: Partial<DriveApi> = {}): DriveApi =>
  aDriveApi({ download: vi.fn(async () => THE_BYTES), ...overrides })

/* A download held open, so a test can act while it is still in flight. `let` is
   control flow rather than test data here — a promise cannot hand out its own
   resolver — and it is the same liberty `media.ts` takes for the same reason. */
const stillArriving = () => {
  let deliver: (bytes: Blob) => void = () => {}

  const bytes = new Promise<Blob>((resolve) => {
    deliver = resolve
  })

  return { bytes, deliver: () => { deliver(THE_BYTES) } }
}

const renderSource = (
  clip: ReturnType<typeof getClip>,
  api: DriveApi,
  cache: ClipCache = holdsNothing,
  session: {
    readonly tokenSource?: TokenSource
    readonly tokenStore?: TokenStore
    readonly onBytes?: (bytes: Blob) => void
  } = {},
) =>
  renderHook(() => useClipSource(clip, api, cache, session.onBytes), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <DriveSessionProvider
        tokenSource={session.tokenSource ?? granting}
        tokenStore={session.tokenStore ?? aConnectedStore()}
      >
        {children}
      </DriveSessionProvider>
    ),
  })

describe('a clip added in this session', () => {
  /* Criterion 3. The bytes are already here — re-fetching what was just
     uploaded would be strictly worse, and is not what US-01-16 means. */
  it('plays from the file it was added from, downloading nothing', async () => {
    const api = anApi()
    const clip = getClip({ src: 'blob:the-local-file', driveId: 'drive-1' })

    const { result } = renderSource(clip, api)

    expect(result.current.src).toBe('blob:the-local-file')
    expect(api.download).not.toHaveBeenCalled()
  })
})

describe('a clip this device has never held', () => {
  const stored = () => getClip({ src: undefined, driveId: 'drive-1' })

  it('fetches the bytes and plays them', async () => {
    const { result } = renderSource(stored(), anApi())

    await waitFor(() => {
      expect(result.current.src).toBe('blob:downloaded')
    })
  })

  it('asks Drive for the file the clip was stored as', async () => {
    const api = anApi()

    renderSource(stored(), api)

    await waitFor(() => {
      expect(api.download).toHaveBeenCalledWith(
        expect.any(String),
        'drive-1',
        expect.any(Function),
      )
    })
  })

  /* A 9 MB clip is still 7 s of nothing on the *first* open, cache or no
     cache — there is nothing to serve until it has been fetched once. Saying
     nothing for those seven seconds is the silence US-01-06 removed. */
  it('is fetching until the bytes arrive, rather than silently blank', () => {
    const { result } = renderSource(
      stored(),
      anApi({ download: () => new Promise<never>(() => {}) }),
    )

    expect(result.current.fetching).toBe(true)
  })

  it('gives up plainly when the bytes will not come', async () => {
    const { result } = renderSource(
      stored(),
      anApi({
        download: async () => {
          throw new DriveError('boom', 500)
        },
      }),
    )

    await waitFor(() => {
      expect(result.current.unreachable).toBe(true)
    })
    expect(result.current.fetching).toBe(false)
  })

  /* A url per open of a clip not yet cached, at nine megabytes a time, so one
     left behind is not a rounding error. */
  it('releases the url it minted when the player goes', async () => {
    const api = anApi()
    const { result, unmount } = renderSource(stored(), api)

    await waitFor(() => {
      expect(result.current.src).toBe('blob:downloaded')
    })
    unmount()

    expect(api.releaseUrl).toHaveBeenCalledWith('blob:downloaded')
  })

  /* Minting a url for a download that failed would leak it: nothing holds it,
     so nothing can release it. `clipProbe` keeps the same discipline, and this
     assertion moved here from `driveDownload` along with the minting itself. */
  it('mints no url for bytes that never arrived', async () => {
    const api = anApi({
      download: async () => {
        throw new DriveError('boom', 500)
      },
    })
    const { result } = renderSource(stored(), api)

    await waitFor(() => {
      expect(result.current.unreachable).toBe(true)
    })
    expect(api.toUrl).not.toHaveBeenCalled()
  })

  /* Seven seconds is long enough to open a clip and change your mind. The url
     would otherwise be minted *after* the cleanup that should have released it,
     so nothing would ever hold it — a leak the old shape could not avoid,
     because `download` minted before the hook could ask whether anyone still
     cared. */
  it('mints no url for a player that has already gone', async () => {
    const arriving = stillArriving()
    const api = anApi({ download: vi.fn(() => arriving.bytes) })
    const { unmount } = renderSource(stored(), api)

    await waitFor(() => {
      expect(api.download).toHaveBeenCalled()
    })
    unmount()
    arriving.deliver()
    await arriving.bytes

    expect(api.toUrl).not.toHaveBeenCalled()
  })

  it('does not release a url it did not mint', async () => {
    const api = anApi()
    const { unmount } = renderSource(
      getClip({ src: 'blob:the-local-file' }),
      api,
    )

    unmount()

    expect(api.releaseUrl).not.toHaveBeenCalled()
  })
})

describe('a clip this device has already fetched once', () => {
  const stored = () => getClip({ src: undefined, driveId: 'drive-1' })

  const holding = (checksum?: string) => alreadyHolding(THE_BYTES, checksum)

  it('plays without fetching it again', async () => {
    const api = anApi()
    const { result } = renderSource(stored(), api, holding())

    await waitFor(() => {
      expect(result.current.src).toBe('blob:downloaded')
    })
    expect(api.download).not.toHaveBeenCalled()
  })

  /* The studio with bad signal, which UC-01 `*c` calls the expected case rather
     than the edge one. A session that could not produce a token if it tried is
     how "no connectivity" is expressible here, and the clip has to play anyway. */
  it('plays with no connection to Drive at all', async () => {
    const disconnected: TokenStore = {
      read: () => null,
      write: () => {},
      clear: () => {},
    }
    const { result } = renderSource(stored(), anApi(), holding(), {
      tokenStore: disconnected,
    })

    await waitFor(() => {
      expect(result.current.src).toBe('blob:downloaded')
    })
    expect(result.current.unreachable).toBe(false)
  })

  /* The third thing caching buys, and the one that would rot silently. A held
     token expires roughly hourly and `requireToken` renews it through Google's
     sign-in popup — so a cached clip that asked for one anyway would flash a
     window in the middle of a move, for bytes it already had. */
  it('asks for no token, so no sign-in popup lands mid-practice', async () => {
    const wouldPopUp = vi.fn(granting)
    const expired: TokenStore = {
      read: () => ({ value: 'ya29.stale', expiresAt: Date.now() - 1 }),
      write: () => {},
      clear: () => {},
    }
    const { result } = renderSource(stored(), anApi(), holding(), {
      tokenSource: wouldPopUp,
      tokenStore: expired,
    })

    await waitFor(() => {
      expect(result.current.src).toBe('blob:downloaded')
    })
    expect(wouldPopUp).not.toHaveBeenCalled()
  })
})

describe('keeping a fetched clip for next time', () => {
  const stored = (checksum?: string) =>
    getClip({ src: undefined, driveId: 'drive-1', checksum })

  /* Built on the shared empty cache rather than hand-rolled, for the reason
     `aDriveApi` exists: a method added to `ClipCache` should not mean repairing
     a literal in every file that ever needed one. */
  const aCache = (overrides: Partial<ClipCache> = {}): ClipCache => ({
    ...holdsNothing,
    put: vi.fn(() => Promise.resolve()),
    ...overrides,
  })

  it('stores the bytes it fetched, under the checksum Drive gave', async () => {
    const cache = aCache()
    const { result } = renderSource(stored('md5-1'), anApi(), cache)

    await waitFor(() => {
      expect(result.current.src).toBe('blob:downloaded')
    })
    expect(cache.put).toHaveBeenCalledWith('shuffle-drill', THE_BYTES, 'md5-1')
  })

  /* The clip is already on screen by the time this runs. A cache that will not
     take the bytes — a full quota, a private window, storage the browser has
     just evicted — makes the *next* open slow, and must not turn this one into
     a clip that could not be played. */
  it('plays on when the bytes cannot be stored', async () => {
    const cache = aCache({
      put: () => Promise.reject(new Error('quota exceeded')),
    })
    const { result } = renderSource(stored('md5-1'), anApi(), cache)

    await waitFor(() => {
      expect(result.current.src).toBe('blob:downloaded')
    })
    expect(result.current.unreachable).toBe(false)
  })

  /* Same argument in the other direction: a cache that cannot even be read is a
     reason to go to Drive, not a reason to give up on the clip. */
  it('falls back to Drive when the cache cannot be read', async () => {
    const api = anApi()
    const cache = aCache({
      get: () => Promise.reject(new Error('IndexedDB is unavailable')),
    })
    const { result } = renderSource(stored('md5-1'), api, cache)

    await waitFor(() => {
      expect(result.current.src).toBe('blob:downloaded')
    })
    expect(api.download).toHaveBeenCalled()
  })
})

describe('a cached clip whose copy in Drive may have moved on', () => {
  const stored = (checksum?: string) =>
    getClip({ src: undefined, driveId: 'drive-1', checksum })

  const holdingUnder = (checksum?: string) =>
    alreadyHolding(THE_BYTES, checksum)

  it('fetches again when the checksums disagree', async () => {
    const api = anApi()
    const { result } = renderSource(
      stored('md5-2'),
      api,
      holdingUnder('md5-1'),
    )

    await waitFor(() => {
      expect(result.current.src).toBe('blob:downloaded')
    })
    expect(api.download).toHaveBeenCalled()
  })

  /* Unknown is not changed, and the difference is nine megabytes. A clip whose
     listing never arrived — the studio with no signal — carries no checksum at
     all, and treating that as "may have moved on" would re-download every clip
     on every open in exactly the conditions the cache exists for. */
  it('serves the cache when the clip carries no checksum to compare', async () => {
    const api = anApi()
    const { result } = renderSource(stored(), api, holdingUnder('md5-1'))

    await waitFor(() => {
      expect(result.current.src).toBe('blob:downloaded')
    })
    expect(api.download).not.toHaveBeenCalled()
  })

  it('serves the cache when what was stored carries no checksum either', async () => {
    const api = anApi()
    const { result } = renderSource(stored('md5-1'), api, holdingUnder())

    await waitFor(() => {
      expect(result.current.src).toBe('blob:downloaded')
    })
    expect(api.download).not.toHaveBeenCalled()
  })

  it('serves the cache when the checksums agree', async () => {
    const api = anApi()
    const { result } = renderSource(
      stored('md5-1'),
      api,
      holdingUnder('md5-1'),
    )

    await waitFor(() => {
      expect(result.current.src).toBe('blob:downloaded')
    })
    expect(api.download).not.toHaveBeenCalled()
  })
})

describe('watching a download arrive', () => {
  const stored = () => getClip({ src: undefined, driveId: 'drive-1' })

  const reporting = (loaded: number, total: number) =>
    anApi({
      download: async (_token, _driveId, onProgress) => {
        onProgress?.(loaded, total)

        return THE_BYTES
      },
    })

  it('has nothing to report before the first byte lands', () => {
    const { result } = renderSource(
      stored(),
      anApi({ download: () => new Promise<never>(() => {}) }),
    )

    expect(result.current.progress).toBeUndefined()
  })

  it('reports how far along the bytes are, as a fraction', async () => {
    const { result } = renderSource(stored(), reporting(4, 10))

    await waitFor(() => {
      expect(result.current.progress).toBe(0.4)
    })
  })

  /* Drive answering without a length is not Drive answering without bytes: the
     download still completes, there is simply nothing to be a fraction of. The
     player says it is fetching without claiming to know how far along. */
  it('reports no fraction when Drive would not say how big the clip is', async () => {
    const { result } = renderSource(stored(), reporting(4, 0))

    await waitFor(() => {
      expect(result.current.src).toBe('blob:downloaded')
    })
    expect(result.current.progress).toBeUndefined()
  })
})

describe('a clip that is neither here nor in Drive', () => {
  /* The state US-01-06 wrote its "couldn't be played" message for. Nothing to
     fetch and nothing to play, so it must not sit claiming to be fetching. */
  it('is not fetching, because there is nothing to fetch', () => {
    const { result } = renderSource(
      getClip({ src: undefined, driveId: undefined }),
      anApi(),
    )

    expect(result.current.fetching).toBe(false)
    expect(result.current.src).toBeUndefined()
  })
})

/* #77's backfill. Every clip uploaded before that ticket has no still, and
   making one needs the clip's bytes — which are right here, having just been
   fetched or read from the cache to play it. Handing them over is what lets the
   library heal itself without a bulk download of every clip in it. */
describe('reporting the bytes it got hold of', () => {
  it('hands over bytes that came from Drive', async () => {
    const onBytes = vi.fn()
    const clip = getClip({ driveId: 'drive-1' })

    renderSource(clip, anApi(), holdsNothing, { onBytes })

    await waitFor(() => {
      expect(onBytes).toHaveBeenCalledWith(THE_BYTES)
    })
  })

  /* The cached path matters more than the downloaded one: a clip practised
     with daily is served from the cache every time, so a backfill that only
     fired on a download would never reach the clips most in need of a still. */
  it('hands over bytes that came from the cache', async () => {
    const onBytes = vi.fn()
    const clip = getClip({ driveId: 'drive-1' })

    renderSource(clip, anApi(), alreadyHolding(THE_BYTES), { onBytes })

    await waitFor(() => {
      expect(onBytes).toHaveBeenCalledWith(THE_BYTES)
    })
  })

  /* A clip added in this session already has its bytes on screen and had its
     still captured at the add. Nothing is fetched, so there is nothing to
     report. */
  it('has nothing to hand over for a clip playing from its own file', async () => {
    const onBytes = vi.fn()
    const clip = getClip({ src: 'blob:the-local-file', driveId: 'drive-1' })

    const { result } = renderSource(clip, anApi(), holdsNothing, { onBytes })

    await waitFor(() => {
      expect(result.current.src).toBe('blob:the-local-file')
    })
    expect(onBytes).not.toHaveBeenCalled()
  })
})
