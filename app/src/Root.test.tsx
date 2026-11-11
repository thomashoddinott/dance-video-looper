import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getClip } from './clips/clip.factory'
import { holdsNothing, noThumbnails } from './clips/clipCache.factory'
import { localOpenedStore } from './clips/openedStore'
import { DEMO_CLIP, DEMO_YOUTUBE } from './demo/demoClip'
import demoLoops from './demo/demoLoops.json'
import type { DriveApi } from './drive/driveApi'
import { aDriveApi } from './drive/driveApi.factory'
import { DriveSessionProvider } from './drive/DriveSessionProvider'
import type { TokenSource } from './drive/gisTokenSource'
import { inMemoryStorage } from './drive/keyValueStorage.factory'
import type { TokenStore } from './drive/tokenStore'
import { aLoopsCache } from './loops/loopsCache.factory'
import { Root } from './Root'
import { playable } from './test/media'

const AN_HOUR_IN_SECONDS = 3599

const nothingKept = (): TokenStore => ({
  read: () => null,
  write: () => {},
  clear: () => {},
})

const connectedEarlier = (): TokenStore => ({
  read: () => ({
    value: 'ya29.kept',
    expiresAt: Date.now() + AN_HOUR_IN_SECONDS * 1000,
  }),
  write: () => {},
  clear: () => {},
})

const sourceGranting = () =>
  vi.fn<TokenSource>().mockResolvedValue({
    ok: true,
    grant: { value: 'ya29.real', expiresInSeconds: AN_HOUR_IN_SECONDS },
  })

const THE_DANCERS_CLIP = getClip({
  id: 'shuffle-drill',
  driveId: 'drive-shuffle',
  name: 'Shuffle drill',
})

/* The dancer's own Drive, holding one clip of theirs. Every method a spy, so
   a demo that reached for it would be caught doing so. */
const theDancersDrive = () =>
  aDriveApi({ listClips: vi.fn(async () => [THE_DANCERS_CLIP]) })

const clipBytes = new Blob([new Uint8Array(12)], { type: 'video/mp4' })

const Where = () => <p data-testid="where">{useLocation().pathname}</p>

const where = () => screen.getByTestId('where').textContent

/* The browser's own `localStorage`, fresh for each test and the same one
   across renders inside it — so a test can reload against it, and catch
   anything written to it (#66). The test environment's own is not a working
   one (`keyValueStorage.factory`). */
beforeEach(() => {
  vi.stubGlobal('localStorage', inMemoryStorage())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const renderRootAt = (
  path: string,
  {
    tokenSource = sourceGranting(),
    tokenStore = nothingKept(),
    liveApi = theDancersDrive(),
    fetchBytes = vi.fn(async (_url: string) => clipBytes),
  }: {
    readonly tokenSource?: TokenSource
    readonly tokenStore?: TokenStore
    readonly liveApi?: DriveApi
    readonly fetchBytes?: (url: string) => Promise<Blob>
  } = {},
) =>
  render(
    <DriveSessionProvider tokenSource={tokenSource} tokenStore={tokenStore}>
      <MemoryRouter initialEntries={[path]}>
        <Root
          live={{
            driveApi: liveApi,
            clipCache: holdsNothing,
            loopsCache: aLoopsCache(),
            openedStore: localOpenedStore(inMemoryStorage()),
            thumbnailCache: noThumbnails,
          }}
          demo={{
            fetchBytes,
            capture: async () => null,
            urls: { toUrl: () => 'blob:demo-clip', releaseUrl: () => {} },
          }}
        />
        <Where />
      </MemoryRouter>
    </DriveSessionProvider>,
  )

const tiles = () =>
  within(screen.getByRole('list', { name: 'Clips' })).queryAllByRole('listitem')

const theDemoTile = () =>
  screen.findByRole('link', { name: new RegExp(DEMO_CLIP.name) })

const aDemoVideo = () => {
  const [video] = DEMO_YOUTUBE

  if (video === undefined) throw new Error('the demo holds no YouTube video')

  return video
}

const panel = () => within(screen.getByRole('region', { name: 'Saved loops' }))

/* The clip is downloaded before it plays, and jsdom has no media stack — so
   once the bytes are in, the surface is stood up as a browser's would be. */
const aPlayingDemoClip = async (container: HTMLElement) => {
  await waitFor(() => {
    expect(container.querySelector('video')).toHaveAttribute(
      'src',
      'blob:demo-clip',
    )
  })

  const video = container.querySelector('video') as HTMLVideoElement

  fireEvent.loadedMetadata(playable(video, { seconds: 12 }))
}

const saveALoop = async () => {
  await userEvent.click(panel().getByRole('button', { name: 'Save' }))
  await panel().findByRole('button', { name: /^Loop 1/ })
}

describe('going into the demo', () => {
  it('shows a gallery holding the demo clip and the YouTube videos', async () => {
    renderRootAt('/')

    await userEvent.click(screen.getByRole('link', { name: 'Demo mode' }))

    await theDemoTile()
    expect(where()).toBe('/demo')
    expect(tiles().map((tile) => within(tile).getByRole('link').textContent)).toEqual([
      expect.stringContaining(DEMO_CLIP.name),
      ...DEMO_YOUTUBE.map(({ name }) => expect.stringContaining(name)),
    ])
  })

  /* #58. Played from YouTube, so there is nothing to fetch — and nothing to
     fail at fetching, which an entry the player took for a clip would. */
  it('opens a YouTube video in the player, with nothing to fetch', async () => {
    renderRootAt('/demo')
    const video = aDemoVideo()

    await userEvent.click(
      await screen.findByRole('link', { name: new RegExp(video.name) }),
    )

    expect(where()).toBe(`/demo/clip/yt:${video.videoId}`)
    expect(
      await screen.findByText(video.name, { selector: 'header *' }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/fetching this clip/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  /* #61. No sentence about the demo and no sign-in: Exit demo says what this
     is, and is the way out. */
  it('offers only Exit demo under the heading', async () => {
    renderRootAt('/demo')

    await theDemoTile()

    expect(screen.getByRole('link', { name: 'Exit demo' })).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Demo' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /connect google drive/i }),
    ).not.toBeInTheDocument()
  })

  it('never reaches the dancer’s Drive, nor asks Google for a token', async () => {
    const liveApi = theDancersDrive()
    const tokenSource = sourceGranting()
    const { container } = renderRootAt('/demo', { liveApi, tokenSource })

    await userEvent.click(await theDemoTile())
    await aPlayingDemoClip(container)
    await saveALoop()

    Object.values(liveApi).forEach((method) => {
      expect(method).not.toHaveBeenCalled()
    })
    expect(tokenSource).not.toHaveBeenCalled()
  })

  /* #58. Salsa and bachata both, so the filter has something to do. */
  it('narrows the gallery to one style', async () => {
    renderRootAt('/demo')
    await theDemoTile()

    await userEvent.click(
      within(screen.getByRole('group', { name: 'Filter by style' })).getByRole(
        'button',
        { name: 'Salsa' },
      ),
    )

    expect(tiles().map((tile) => within(tile).getByRole('link').textContent)).toEqual(
      DEMO_YOUTUBE.filter(({ style }) => style === 'salsa').map(({ name }) =>
        expect.stringContaining(name),
      ),
    )
  })

  it('lands a dancer who is already signed in on their own library', async () => {
    renderRootAt('/demo', { tokenStore: connectedEarlier() })

    expect(await screen.findByText('Shuffle drill')).toBeInTheDocument()
    expect(where()).toBe('/')
  })
})

describe('the demo clip', () => {
  it('plays the clip bundled with the site', async () => {
    const fetchBytes = vi.fn(async (_url: string) => clipBytes)
    const { container } = renderRootAt('/demo', { fetchBytes })

    await userEvent.click(await theDemoTile())
    await aPlayingDemoClip(container)

    expect(fetchBytes).toHaveBeenCalledWith(DEMO_CLIP.url)
  })

  it('says, in the player too, that this is the demo', async () => {
    renderRootAt('/demo')

    await userEvent.click(await theDemoTile())

    expect(await screen.findByText('Demo', { selector: 'header *' })).toBeInTheDocument()
  })
})

/* The loops are the product. A visitor who saves one and wanders back to the
   gallery must find it still there, as they would on any site that remembers
   them — and a reload is not leaving. */
/* #63. A visitor opens the demo onto loops already made — the moves picked
   out of each video — rather than onto clips with nothing in them. */
describe('the loops the demo ships with', () => {
  it('are counted on each tile they belong to', async () => {
    renderRootAt('/demo')
    await theDemoTile()
    const shipped = Object.entries(demoLoops.clips)

    expect(shipped).not.toHaveLength(0)

    for (const [clipId, loops] of shipped) {
      const name =
        DEMO_YOUTUBE.find(({ videoId }) => `yt:${videoId}` === clipId)?.name ?? DEMO_CLIP.name
      const tile = screen.getByRole('link', { name: new RegExp(name) })

      await waitFor(() => {
        expect(tile).toHaveTextContent(`(${loops.length})`)
      })
    }
  })
})

describe('loops saved in the demo', () => {
  it('are still there after a trip back to the gallery', async () => {
    const { container } = renderRootAt('/demo')

    await userEvent.click(await theDemoTile())
    await aPlayingDemoClip(container)
    await saveALoop()

    await userEvent.click(screen.getByRole('link', { name: 'Back to clips' }))
    await userEvent.click(await theDemoTile())
    await aPlayingDemoClip(container)

    expect(
      await panel().findByRole('button', { name: /^Loop 1/ }),
    ).toBeInTheDocument()
  })

  /* #66. The demo is not persistent: a visitor who comes back finds it as
     they first did, on the loops it ships with. */
  it('are gone after a reload', async () => {
    const first = renderRootAt('/demo')

    await userEvent.click(await theDemoTile())
    await aPlayingDemoClip(first.container)
    await saveALoop()
    first.unmount()

    const second = renderRootAt(`/demo/clip/${DEMO_CLIP.id}`)
    await aPlayingDemoClip(second.container)

    expect(panel().queryByRole('button', { name: /^Loop 1/ })).not.toBeInTheDocument()
  })

  it('are gone after leaving the demo and coming back', async () => {
    const { container } = renderRootAt('/demo')

    await userEvent.click(await theDemoTile())
    await aPlayingDemoClip(container)
    await saveALoop()
    await userEvent.click(screen.getByRole('link', { name: 'Back to clips' }))
    await userEvent.click(await screen.findByRole('link', { name: 'Exit demo' }))
    await userEvent.click(screen.getByRole('link', { name: 'Demo mode' }))
    await userEvent.click(await theDemoTile())
    await aPlayingDemoClip(container)

    expect(panel().queryByRole('button', { name: /^Loop 1/ })).not.toBeInTheDocument()
  })

  it('are never written to this browser', async () => {
    const setItem = vi.spyOn(localStorage, 'setItem')
    const { container } = renderRootAt('/demo')

    await userEvent.click(await theDemoTile())
    await aPlayingDemoClip(container)
    await saveALoop()

    expect(setItem).not.toHaveBeenCalled()
  })

  /* #66's reproduction: a browser that saved in the demo before it stopped
     keeping anything. Its old keys are left where they are and never read. */
  it('do not hide the shipped loops in a browser that saved in the demo before', async () => {
    localStorage.setItem(
      'looper.demo.demo.file.loops.json',
      JSON.stringify({
        version: '1',
        body: JSON.stringify({
          schema: 1,
          clips: { [DEMO_CLIP.id]: [{ id: 'old', name: 'Old', a: 0, b: 5, speed: 1 }] },
          touched: {},
        }),
      }),
    )

    renderRootAt('/demo')
    await theDemoTile()
    const shipped = demoLoops.clips['yt:l-H1OAu9N28']

    await waitFor(() => {
      expect(
        screen.getByRole('link', { name: /Bachata Sensual/ }),
      ).toHaveTextContent(`(${shipped.length})`)
    })
  })
})

describe('leaving the demo', () => {
  it('goes back to the dashboard on Exit demo', async () => {
    renderRootAt('/demo')

    await userEvent.click(await screen.findByRole('link', { name: 'Exit demo' }))

    expect(where()).toBe('/')
  })

  /* #61. The demo no longer offers sign-in itself; it is one step away. */
  it('leads to sign-in, and from there to the dancer’s real library', async () => {
    renderRootAt('/demo')
    await theDemoTile()

    await userEvent.click(screen.getByRole('link', { name: 'Exit demo' }))
    await userEvent.click(
      screen.getByRole('button', { name: /connect google drive/i }),
    )

    expect(await screen.findByText('Shuffle drill')).toBeInTheDocument()
    expect(where()).toBe('/')
    expect(screen.queryByText(DEMO_CLIP.name)).not.toBeInTheDocument()
  })
})
