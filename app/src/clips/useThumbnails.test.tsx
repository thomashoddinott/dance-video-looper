import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { DriveApi } from '../drive/driveApi'
import { DriveError } from '../drive/driveApi'
import { aDriveApi } from '../drive/driveApi.factory'
import { DriveSessionProvider } from '../drive/DriveSessionProvider'
import type { TokenSource } from '../drive/gisTokenSource'
import type { TokenStore } from '../drive/tokenStore'
import type { ThumbnailCache } from './clipCache'
import { noThumbnails, thumbnailsHolding } from './clipCache.factory'
import type { ThumbnailCapture } from './thumbnail'
import { useThumbnails } from './useThumbnails'

const AN_HOUR = 3599

const A_CLIP = 'added-shuffle-drill-26-1756000000000'

const aStill = () => new Blob([new Uint8Array(31_204)], { type: 'image/jpeg' })

const aTokenStore = (): TokenStore => ({
  read: () => ({ value: 'ya29.kept', expiresAt: Date.now() + AN_HOUR * 1000 }),
  write: () => {},
  clear: () => {},
})

const granting: TokenSource = async () => ({
  ok: true,
  grant: { value: 'ya29.a-token', expiresInSeconds: AN_HOUR },
})

/* A capture that always yields a still, so a case about storage is not also a
   case about decoding. The ones that are about decoding say so. */
const capturing: ThumbnailCapture = async () => aStill()

const renderThumbnails = (
  api: DriveApi,
  {
    cache = noThumbnails,
    clipIds = [A_CLIP],
    capture = capturing,
    tokenSource = granting,
    tokenStore = aTokenStore(),
  }: {
    readonly cache?: ThumbnailCache
    readonly clipIds?: readonly string[]
    readonly capture?: ThumbnailCapture
    readonly tokenSource?: TokenSource
    readonly tokenStore?: TokenStore
  } = {},
) =>
  renderHook(() => useThumbnails(api, cache, clipIds, capture), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <DriveSessionProvider tokenSource={tokenSource} tokenStore={tokenStore}>
        {children}
      </DriveSessionProvider>
    ),
  })

describe('painting a grid from the stills already on this device', () => {
  /* The cache is asked before the token, and the order is the whole point
     rather than an optimisation — the argument `useClipSource` makes about
     nine megabytes, applied to thirty kilobytes. `requireToken` renews through
     Google's sign-in popup, and a grid of tiles is not worth flashing one. */
  it('needs no Drive token at all for stills it already holds', async () => {
    const tokenSource = vi.fn(granting)
    const { result } = renderThumbnails(aDriveApi(), {
      cache: thumbnailsHolding(aStill()),
      tokenSource,
    })

    await waitFor(() => {
      expect(result.current.urls[A_CLIP]).toBeDefined()
    })
    expect(tokenSource).not.toHaveBeenCalled()
  })

  it('lets go of the urls it minted when the grid goes', async () => {
    const api = aDriveApi()
    const { result, unmount } = renderThumbnails(api, {
      cache: thumbnailsHolding(aStill()),
    })

    await waitFor(() => {
      expect(result.current.urls[A_CLIP]).toBeDefined()
    })
    unmount()

    expect(api.releaseUrl).toHaveBeenCalled()
  })
})

describe('fetching a still this device has not seen', () => {
  const holdingAStillFor = (clipId: string) =>
    aDriveApi({ listThumbnails: vi.fn(async () => ({ [clipId]: 'still-1' })) })

  it('downloads it from Drive and paints the tile with it', async () => {
    const api = holdingAStillFor(A_CLIP)
    const { result } = renderThumbnails(api)

    await waitFor(() => {
      expect(result.current.urls[A_CLIP]).toBeDefined()
    })
    expect(api.download).toHaveBeenCalledWith(expect.any(String), 'still-1')
  })

  /* Thirty kilobytes a tile is cheap once and wasteful every time. Criterion 7
     is that a still already fetched is served locally. */
  it('keeps what it fetched, so the next open costs nothing', async () => {
    const put = vi.fn(async () => {})
    const { result } = renderThumbnails(holdingAStillFor(A_CLIP), {
      cache: { get: async () => null, put, forget: async () => {} },
    })

    await waitFor(() => {
      expect(put).toHaveBeenCalledWith(A_CLIP, expect.any(Blob))
    })
    expect(result.current.urls[A_CLIP]).toBeDefined()
  })

  /* Every clip uploaded before #77, until its bytes are next in hand. A grey
     tile is the honest answer, and it must not become a download of the clip
     itself — which is the ~9 MB per tile this whole ticket exists to avoid. */
  it('leaves a clip Drive holds no still for alone', async () => {
    const api = aDriveApi()
    const { result } = renderThumbnails(api)

    await waitFor(() => {
      expect(api.listThumbnails).toHaveBeenCalled()
    })
    expect(result.current.urls[A_CLIP]).toBeUndefined()
    expect(api.download).not.toHaveBeenCalled()
  })

  it('keeps the stills it has when Drive cannot be reached', async () => {
    const { result } = renderThumbnails(
      aDriveApi({
        listThumbnails: vi.fn(async () => {
          throw new DriveError('boom', 500)
        }),
      }),
      { cache: thumbnailsHolding(aStill()) },
    )

    await waitFor(() => {
      expect(result.current.urls[A_CLIP]).toBeDefined()
    })
  })
})

describe('making a still for a clip that has none', () => {
  it('captures from the bytes it is handed and stores them in Drive', async () => {
    const api = aDriveApi()
    const { result } = renderThumbnails(api)

    await waitFor(() => {
      expect(api.listThumbnails).toHaveBeenCalled()
    })
    await act(async () => {
      await result.current.capture(A_CLIP, new Blob([new Uint8Array(9)]))
    })

    expect(api.uploadThumbnail).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ clipId: A_CLIP }),
    )
    expect(result.current.urls[A_CLIP]).toBeDefined()
  })

  /* The backfill runs every time a clip is opened, and a clip is opened over
     and over — that is what practice is. Without this, every open would upload
     another still and the folder would fill with duplicates of one frame. */
  it('does nothing for a clip that already has one', async () => {
    const api = aDriveApi({
      listThumbnails: vi.fn(async () => ({ [A_CLIP]: 'still-1' })),
    })
    const { result } = renderThumbnails(api)

    await waitFor(() => {
      expect(result.current.urls[A_CLIP]).toBeDefined()
    })
    await act(async () => {
      await result.current.capture(A_CLIP, new Blob([new Uint8Array(9)]))
    })

    expect(api.uploadThumbnail).not.toHaveBeenCalled()
  })

  it('stores nothing for a clip no still could be captured from', async () => {
    const api = aDriveApi()
    const { result } = renderThumbnails(api, { capture: async () => null })

    await waitFor(() => {
      expect(api.listThumbnails).toHaveBeenCalled()
    })
    await act(async () => {
      await result.current.capture(A_CLIP, new Blob([new Uint8Array(9)]))
    })

    expect(api.uploadThumbnail).not.toHaveBeenCalled()
  })

  /* A still is not worth failing anything over. The clip plays either way, and
     the caller — the player, mid-download — has nothing to say about it. */
  it('swallows a Drive that refuses to take the still', async () => {
    const api = aDriveApi({
      uploadThumbnail: vi.fn(async () => {
        throw new DriveError('boom', 500)
      }),
    })
    const { result } = renderThumbnails(api)

    await waitFor(() => {
      expect(api.listThumbnails).toHaveBeenCalled()
    })

    await expect(
      act(async () => {
        await result.current.capture(A_CLIP, new Blob([new Uint8Array(9)]))
      }),
    ).resolves.toBeUndefined()
  })
})

/* #78 deletes clips. A still left behind is a file in the dancer's Drive
   belonging to nothing — and if they ever add the same clip again, a frame
   from the copy they threw away. */
describe('losing the still of a clip that has been deleted', () => {
  const holdingAStill = () =>
    aDriveApi({ listThumbnails: vi.fn(async () => ({ [A_CLIP]: 'still-1' })) })

  it('trashes it in Drive alongside the clip', async () => {
    const api = holdingAStill()
    const { result } = renderThumbnails(api)

    await waitFor(() => {
      expect(result.current.urls[A_CLIP]).toBeDefined()
    })
    await act(async () => {
      await result.current.forget(A_CLIP)
    })

    expect(api.trash).toHaveBeenCalledWith(expect.any(String), 'still-1')
  })

  it('drops the local copy too, so a re-add cannot inherit it', async () => {
    const forget = vi.fn(async () => {})
    const { result } = renderThumbnails(holdingAStill(), {
      cache: { get: async () => null, put: async () => {}, forget },
    })

    await waitFor(() => {
      expect(result.current.urls[A_CLIP]).toBeDefined()
    })
    await act(async () => {
      await result.current.forget(A_CLIP)
    })

    expect(forget).toHaveBeenCalledWith(A_CLIP)
    expect(result.current.urls[A_CLIP]).toBeUndefined()
  })

  /* The clip is already gone from the grid by the time this runs. Failing
     loudly here would report a delete that did work as one that did not. */
  it('says nothing when Drive will not trash it', async () => {
    const api = aDriveApi({
      listThumbnails: vi.fn(async () => ({ [A_CLIP]: 'still-1' })),
      trash: vi.fn(async () => {
        throw new DriveError('boom', 500)
      }),
    })
    const { result } = renderThumbnails(api)

    await waitFor(() => {
      expect(result.current.urls[A_CLIP]).toBeDefined()
    })

    await expect(
      act(async () => {
        await result.current.forget(A_CLIP)
      }),
    ).resolves.toBeUndefined()
  })
})
