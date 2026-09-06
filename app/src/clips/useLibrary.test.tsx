import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { DriveApi, UploadRequest } from '../drive/driveApi'
import { DriveError } from '../drive/driveApi'
import { aDriveApi } from '../drive/driveApi.factory'
import { DriveSessionProvider } from '../drive/DriveSessionProvider'
import type { TokenSource } from '../drive/gisTokenSource'
import type { TokenStore } from '../drive/tokenStore'
import { getClip } from './clip.factory'
import type { ClipCache } from './clipCache'
import { forgetting, holdsNothing } from './clipCache.factory'
import type { ClipCompressor } from './clipCompressor'
import { uploadOf } from './library'
import { useLibrary } from './useLibrary'

const AN_HOUR = 3599

/* A dancer who connected on an earlier visit, which is the ordinary case the
   library loads in: the provider resumes a kept token on mount, so the session
   is already holding one and nothing has to be tapped first. A store that keeps
   nothing would leave the session signed-out, and the library would correctly
   settle empty without ever reaching Drive — true, and not what these cases are
   about. */
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

const refusing: TokenSource = async () => ({
  ok: false,
  because: 'consent-refused',
})

const A_STORED_CLIP = getClip({ id: 'from-drive', driveId: 'drive-1' })

/* The shared factory, plus the one default this file wants differently: these
   cases are about a library that already has something in it. */
const anApi = (overrides: Partial<DriveApi> = {}): DriveApi =>
  aDriveApi({ listClips: vi.fn(async () => [A_STORED_CLIP]), ...overrides })

/* The clip goes up exactly as it came in. Compression is US-01-17's business
   and is pinned by its own tests; every case that is not about it wants the
   file it passed in to be the file that arrives. */
const uncompressed: ClipCompressor = async (file) => file

const renderLibrary = (
  api: DriveApi,
  tokenSource: TokenSource = granting,
  tokenStore: TokenStore = aTokenStore(),
  compress: ClipCompressor = uncompressed,
  cache: ClipCache = holdsNothing,
) =>
  renderHook(() => useLibrary(api, { compress, cache }), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <DriveSessionProvider tokenSource={tokenSource} tokenStore={tokenStore}>
        {children}
      </DriveSessionProvider>
    ),
  })

const JUST_ADDED = getClip({ id: 'added-shuffle', name: 'Shuffle drill' })

const aFile = () =>
  new File([new Uint8Array(26)], 'Shuffle drill.mp4', { type: 'video/mp4' })

describe('reading the library out of Drive', () => {
  it('lists what the app has uploaded', async () => {
    const { result } = renderLibrary(anApi())

    await waitFor(() => {
      expect(result.current.library.state).toBe('ready')
    })
    expect(result.current.library.clips).toEqual([A_STORED_CLIP])
  })

  /* Criterion 7. Nothing has been uploaded because nothing could have been, so
     an empty grid is the honest answer — not a failure, and not a spinner that
     never resolves. */
  it('settles on an empty library when there is no Drive to read', async () => {
    const api = anApi()

    const { result } = renderLibrary(api, refusing, keepingNothing())

    await waitFor(() => {
      expect(result.current.library.state).toBe('ready')
    })
    expect(result.current.library.clips).toEqual([])
    expect(api.listClips).not.toHaveBeenCalled()
  })

  it('says the library could not be read when Drive refuses', async () => {
    const { result } = renderLibrary(
      anApi({
        listClips: vi.fn(async () => {
          throw new DriveError('boom', 500)
        }),
      }),
    )

    await waitFor(() => {
      expect(result.current.library.state).toBe('failed')
    })
  })

  /* Criterion 9. The session retires tokens early so an expiry cannot surface
     as a 401 — what is left is a grant the dancer revoked, and the footer has a
     sentence for exactly that. */
  it('reports a withdrawal rather than a generic failure on a 401', async () => {
    const { result } = renderLibrary(
      anApi({
        listClips: vi.fn(async () => {
          throw new DriveError('no', 401)
        }),
      }),
    )

    await waitFor(() => {
      expect(result.current.status).toBe('consent-withdrawn')
    })
  })
})

/* UC-01 Q-08. Deliberately the mirror image of an add: that one puts the tile
   up before a byte has gone, because it is covering thirteen seconds. This one
   waits for Drive, because it is covering two hundred milliseconds and the
   thing it must never do is show a library the dancer's Drive disagrees with. */
describe('deleting a clip from the library', () => {
  const readyWith = async (api: DriveApi, cache: ClipCache = holdsNothing) => {
    const rendered = renderLibrary(api, granting, aTokenStore(), uncompressed, cache)

    await waitFor(() => {
      expect(rendered.result.current.library.state).toBe('ready')
    })

    return rendered
  }

  it('sends the clip to Drive’s bin, and the tile goes with it', async () => {
    const api = anApi()
    const { result } = await readyWith(api)

    await act(async () => {
      await result.current.remove(A_STORED_CLIP)
    })

    expect(api.trash).toHaveBeenCalledWith(expect.anything(), 'drive-1')
    expect(result.current.library.clips).toEqual([])
  })

  it('drops the cached bytes, which are budget held against nothing now', async () => {
    const { cache, forgotten } = forgetting()
    const { result } = await readyWith(anApi(), cache)

    await act(async () => {
      await result.current.remove(A_STORED_CLIP)
    })

    expect(forgotten()).toEqual(['from-drive'])
  })

  /* The criterion the whole ordering exists for: a tile that vanished from a
     library Drive still holds would come back on the next reload, and the
     dancer would have watched the app lose a clip and then un-lose it. */
  it('leaves the clip in the grid when Drive refuses, and says which one', async () => {
    const { result } = await readyWith(
      anApi({
        trash: vi.fn(async () => {
          throw new DriveError('boom', 500)
        }),
      }),
    )

    await act(async () => {
      await result.current.remove(getClip({ ...A_STORED_CLIP, name: 'Shuffle drill' }))
    })

    expect(result.current.library.clips).toEqual([A_STORED_CLIP])
    expect(result.current.notice).toContain('Shuffle drill')
  })

  it('reports a withdrawal when the delete is what gets the 401', async () => {
    const { result } = await readyWith(
      anApi({
        trash: vi.fn(async () => {
          throw new DriveError('no', 401)
        }),
      }),
    )

    await act(async () => {
      await result.current.remove(A_STORED_CLIP)
    })

    expect(result.current.status).toBe('consent-withdrawn')
  })

  /* A clip retracted mid-upload has no `driveId`, so there is no file to ask
     Drive about — and `${API}/files/undefined` is the quiet way to turn that
     into a 404 the dancer is shown as a failed delete. */
  it('asks Drive nothing about a clip Drive never stored', async () => {
    const api = anApi({ listClips: vi.fn(async () => [getClip({ id: 'half-sent' })]) })
    const { result } = await readyWith(api)

    await act(async () => {
      await result.current.remove(getClip({ id: 'half-sent' }))
    })

    expect(api.trash).not.toHaveBeenCalled()
    expect(result.current.library.clips).toEqual([])
  })
})

describe('adding a clip to the library', () => {
  const addedTo = async (api: DriveApi, compress: ClipCompressor = uncompressed) => {
    const rendered = renderLibrary(api, granting, aTokenStore(), compress)

    await waitFor(() => {
      expect(rendered.result.current.library.state).toBe('ready')
    })

    return rendered
  }

  it('puts the clip in the grid before a byte has gone', async () => {
    const { result } = await addedTo(
      anApi({ upload: vi.fn(() => new Promise<never>(() => {})) }),
    )

    act(() => {
      void result.current.add(JUST_ADDED, aFile(), 26)
    })

    await waitFor(() => {
      expect(result.current.library.clips[0]?.id).toBe('added-shuffle')
    })
    expect(uploadOf(result.current.library, 'added-shuffle')).toBe(0)
  })

  it('advances as the bytes go', async () => {
    const { result } = await addedTo(
      anApi({
        upload: vi.fn(async (_token: string, { onProgress }: UploadRequest) => {
          onProgress(13, 26)

          return new Promise<never>(() => {})
        }),
      }),
    )

    act(() => {
      void result.current.add(JUST_ADDED, aFile(), 26)
    })

    await waitFor(() => {
      expect(uploadOf(result.current.library, 'added-shuffle')).toBeCloseTo(0.5)
    })
  })

  it('records the Drive file once it is stored', async () => {
    const { result } = await addedTo(anApi())

    await act(async () => {
      await result.current.add(JUST_ADDED, aFile(), 26)
    })

    expect(result.current.library.clips[0]?.driveId).toBe('drive-new')
    expect(uploadOf(result.current.library, 'added-shuffle')).toBeUndefined()
  })

  /* Criterion 4, and the cost the approval gate took on knowingly: the tile is
     already on screen, so failing means taking it back. */
  it('takes the clip back out when the upload fails, and says which one', async () => {
    const { result } = await addedTo(
      anApi({
        upload: vi.fn(async () => {
          throw new DriveError('boom', 500)
        }),
      }),
    )

    await act(async () => {
      await result.current.add(JUST_ADDED, aFile(), 26)
    })

    expect(result.current.library.clips).toEqual([A_STORED_CLIP])
    expect(result.current.notice).toContain('Shuffle drill')
  })

  it('reports a withdrawal when the upload is the thing that gets the 401', async () => {
    const { result } = await addedTo(
      anApi({
        upload: vi.fn(async () => {
          throw new DriveError('no', 401)
        }),
      }),
    )

    await act(async () => {
      await result.current.add(JUST_ADDED, aFile(), 26)
    })

    expect(result.current.status).toBe('consent-withdrawn')
  })

  it('never holds a token between calls, asking for one per call', async () => {
    const api = anApi()
    const { result } = await addedTo(api)

    await act(async () => {
      await result.current.add(JUST_ADDED, aFile(), 26)
    })

    /* The listing asked, and so did the upload. A held copy is the one thing
       that reintroduces the mid-flight 401 the session's skew exists to
       prevent — and a 13-second upload is long enough to straddle an expiry. */
    expect(api.findOrCreateFolder).toHaveBeenCalledTimes(2)
  })

  /* US-01-17. Roughly five seconds of encoding now sit between the dancer
     picking a clip and the first byte going up, and the whole story rests on
     none of it being visible. */
  describe('compressing it on the way up', () => {
    const compressingTo = (bytes: number, named = 'Shuffle drill.mp4') =>
      vi.fn<ClipCompressor>(
        async () =>
          new File([new Uint8Array(bytes)], named, { type: 'video/mp4' }),
      )

    it('has the clip in the grid before the encoder has finished', async () => {
      const { result } = await addedTo(
        anApi(),
        () => new Promise<never>(() => {}),
      )

      act(() => {
        void result.current.add(JUST_ADDED, aFile(), 26)
      })

      await waitFor(() => {
        expect(result.current.library.clips[0]?.id).toBe('added-shuffle')
      })
    })

    it('sends the encoded bytes to Drive rather than the picked ones', async () => {
      const api = anApi()
      const { result } = await addedTo(api, compressingTo(9))

      await act(async () => {
        await result.current.add(JUST_ADDED, aFile(), 26)
      })

      expect(api.upload).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          file: expect.objectContaining({ size: 9 }),
        }),
      )
    })

    /* The identity hazard, from the end that can still get it wrong. The bytes
       going up are a re-encode with its own name and size, and the clip has to
       come back from Drive as the one the tile was built for — which is also
       the id US-01-15 keys saved loops on. */
    it('stamps the picked clip’s id on the upload, whatever bytes went', async () => {
      const api = anApi()
      const { result } = await addedTo(
        api,
        compressingTo(9, 'Shuffle drill.mp4'),
      )

      await act(async () => {
        await result.current.add(JUST_ADDED, aFile(), 26)
      })

      expect(api.upload).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ clipId: 'added-shuffle' }),
      )
    })
  })
})
