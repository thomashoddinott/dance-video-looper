import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getClip } from './clips/clip.factory'
import { holdsNothing, noThumbnails } from './clips/clipCache.factory'
import { localOpenedStore } from './clips/openedStore'
import { DEMO_YOUTUBE } from './demo/demoVideos'
import demoLoops from './demo/demoLoops.json'
import type { DriveApi } from './drive/driveApi'
import { aDriveApi } from './drive/driveApi.factory'
import { DriveSessionProvider } from './drive/DriveSessionProvider'
import type { TokenSource } from './drive/gisTokenSource'
import { inMemoryStorage } from './drive/keyValueStorage.factory'
import type { TokenStore } from './drive/tokenStore'
import { aLoopsCache } from './loops/loopsCache.factory'
import { aYouTube } from './player/youtubePlayer.factory'
import { Root } from './Root'
import { inDocumentOrder } from './test/documentOrder'

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
   a showcase that reached for it would be caught doing so. */
const theDancersDrive = () =>
  aDriveApi({ listClips: vi.fn(async () => [THE_DANCERS_CLIP]) })

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
    youtube = aYouTube(),
  }: {
    readonly tokenSource?: TokenSource
    readonly tokenStore?: TokenStore
    readonly liveApi?: DriveApi
    readonly youtube?: ReturnType<typeof aYouTube>
  } = {},
) => ({
  ...render(
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
            urls: { toUrl: () => 'blob:showcase', releaseUrl: () => {} },
            mountYouTube: youtube.mount,
          }}
        />
        <Where />
      </MemoryRouter>
    </DriveSessionProvider>,
  ),
  youtube,
})

/* Names carry brackets and punctuation — "(Part 1)" — so they are matched
   as text, not as patterns. */
const named = (name: string) => new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

const tileNames = () =>
  within(screen.getByRole('list', { name: 'Clips' }))
    .queryAllByRole('listitem')
    .map((tile) => within(tile).getByRole('link').textContent)

const aShowcaseVideo = () => {
  const video = DEMO_YOUTUBE.find(({ videoId }) => videoId === 'l-H1OAu9N28')

  if (video === undefined) throw new Error('the showcase holds no Bachata Sensual video')

  return video
}

const theShowcase = () =>
  screen.findByRole('link', { name: named(aShowcaseVideo().name) })

const panel = () => within(screen.getByRole('region', { name: 'Saved loops' }))

/* Every entry in the showcase is a YouTube video, so a test that loops one
   readies the stand-in YouTube as the IFrame API would: mounted, then ready. */
const openTheVideo = async (youtube: ReturnType<typeof aYouTube>) => {
  await userEvent.click(await theShowcase())
  await waitFor(() => {
    expect(youtube.mount).toHaveBeenCalled()
  })
  act(() => {
    youtube.ready()
  })
  await screen.findByRole('slider', { name: 'Loop end' })
}

const saveALoopNamed = async (name: string) => {
  await userEvent.type(panel().getByRole('textbox', { name: 'Loop name' }), name)
  await userEvent.click(panel().getByRole('button', { name: 'Save' }))
  await panel().findByRole('button', { name: new RegExp(`^${name}`) })
}

/* #77. A visitor lands on real dance videos with their moves already looped,
   rather than on an empty page and a button to press. */
describe('a visitor who is not signed in', () => {
  it('lands on the showcase, every video in it', async () => {
    renderRootAt('/')

    await theShowcase()
    expect(where()).toBe('/')
    expect(tileNames()).toEqual(DEMO_YOUTUBE.map(({ name }) => expect.stringContaining(name)))
  })

  it('is offered no demo mode, and nothing to leave', async () => {
    renderRootAt('/')
    await theShowcase()

    expect(screen.queryByRole('link', { name: 'Demo mode' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Exit demo' })).not.toBeInTheDocument()
  })

  /* The one way in for the dancer: at the top beside the source link (#83),
     rather than below a showcase long enough to hide it. */
  it('is offered Connect Google Drive above the showcase', async () => {
    renderRootAt('/')
    await theShowcase()

    expect(
      inDocumentOrder({
        connect: screen.getByRole('button', { name: /connect google drive/i }),
        clips: screen.getByRole('list', { name: 'Clips' }),
      }),
    ).toEqual(['connect', 'clips'])
  })

  /* #73. Nothing has been opened in a visit that has just begun, so Last
     opened ties every video, and a tie keeps the order they are listed in. */
  it('starts on Last opened, drawing every video though none has been opened', async () => {
    renderRootAt('/')
    await theShowcase()

    expect(screen.getByRole('button', { name: 'Last opened' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(tileNames()).toHaveLength(DEMO_YOUTUBE.length)
  })

  it('opens a video in the player, with nothing to fetch', async () => {
    const { youtube } = renderRootAt('/')

    await openTheVideo(youtube)

    expect(where()).toBe(`/clip/yt:${aShowcaseVideo().videoId}`)
    expect(screen.queryByText(/fetching this clip/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('is told nothing about a demo in the player', async () => {
    const { youtube } = renderRootAt('/')

    await openTheVideo(youtube)

    expect(screen.queryByText('Demo', { selector: 'header *' })).not.toBeInTheDocument()
  })

  it('never reaches the dancer’s Drive, nor asks Google for a token', async () => {
    const liveApi = theDancersDrive()
    const tokenSource = sourceGranting()
    const { youtube } = renderRootAt('/', { liveApi, tokenSource })

    await openTheVideo(youtube)
    await saveALoopNamed('Mine')

    Object.values(liveApi).forEach((method) => {
      expect(method).not.toHaveBeenCalled()
    })
    expect(tokenSource).not.toHaveBeenCalled()
  })

  it('narrows the showcase to one style', async () => {
    renderRootAt('/')
    await theShowcase()

    await userEvent.click(
      within(screen.getByRole('group', { name: 'Filter by style' })).getByRole('button', {
        name: 'Bachata',
      }),
    )

    expect(tileNames()).toEqual(
      DEMO_YOUTUBE.filter(({ style }) => style === 'bachata').map(({ name }) =>
        expect.stringContaining(name),
      ),
    )
  })

  /* `/demo` was an address a CV could point at (#33); it still lands. */
  it('reaching the old demo address, lands on the showcase', async () => {
    renderRootAt('/demo')

    await theShowcase()
    expect(where()).toBe('/')
  })
})

describe('the dancer', () => {
  it('lands on their own library once signed in', async () => {
    renderRootAt('/', { tokenStore: connectedEarlier() })

    expect(await screen.findByText('Shuffle drill')).toBeInTheDocument()
    expect(screen.queryByText(aShowcaseVideo().name)).not.toBeInTheDocument()
  })

  it('signs in from below the showcase, and gets their own library in its place', async () => {
    renderRootAt('/')
    await theShowcase()

    await userEvent.click(screen.getByRole('button', { name: /connect google drive/i }))

    expect(await screen.findByText('Shuffle drill')).toBeInTheDocument()
    expect(screen.queryByText(aShowcaseVideo().name)).not.toBeInTheDocument()
  })

  it('reaching the old demo address while signed in, lands on their own library', async () => {
    renderRootAt('/demo', { tokenStore: connectedEarlier() })

    expect(await screen.findByText('Shuffle drill')).toBeInTheDocument()
    expect(where()).toBe('/')
  })
})

/* #63. The moves picked out of each video, already looped. */
describe('the loops the showcase ships with', () => {
  it('are counted on each tile they belong to', async () => {
    renderRootAt('/')
    await theShowcase()
    const shipped = Object.entries(demoLoops.clips)

    expect(shipped).not.toHaveLength(0)

    for (const [clipId, loops] of shipped) {
      const name = DEMO_YOUTUBE.find(({ videoId }) => `yt:${videoId}` === clipId)?.name ?? ''
      const tile = screen.getByRole('link', { name: named(name) })

      await waitFor(() => {
        expect(tile).toHaveTextContent(`(${loops.length})`)
      })
    }
  })
})

/* #66. Not persistent: a visitor who comes back finds the showcase as they
   first did. */
describe('loops a visitor saves in the showcase', () => {
  it('are still there after a trip back to the grid', async () => {
    const { youtube } = renderRootAt('/')

    await openTheVideo(youtube)
    await saveALoopNamed('Mine')
    await userEvent.click(screen.getByRole('link', { name: 'Back to clips' }))
    await openTheVideo(youtube)

    expect(await panel().findByRole('button', { name: /^Mine/ })).toBeInTheDocument()
  })

  it('are gone after a reload', async () => {
    const first = renderRootAt('/')

    await openTheVideo(first.youtube)
    await saveALoopNamed('Mine')
    first.unmount()

    const second = renderRootAt('/')
    await openTheVideo(second.youtube)

    expect(panel().queryByRole('button', { name: /^Mine/ })).not.toBeInTheDocument()
  })

  it('are never written to this browser', async () => {
    const setItem = vi.spyOn(localStorage, 'setItem')
    const { youtube } = renderRootAt('/')

    await openTheVideo(youtube)
    await saveALoopNamed('Mine')

    expect(setItem).not.toHaveBeenCalled()
  })

  /* #66's reproduction: a browser that saved in the old demo. Its keys are
     left where they are and never read. */
  it('do not hide the shipped loops in a browser that saved in the old demo', async () => {
    const video = aShowcaseVideo()
    localStorage.setItem(
      'looper.demo.demo.file.loops.json',
      JSON.stringify({
        version: '1',
        body: JSON.stringify({
          schema: 1,
          clips: { [`yt:${video.videoId}`]: [{ id: 'old', name: 'Old', a: 0, b: 5, speed: 1 }] },
          touched: {},
        }),
      }),
    )

    renderRootAt('/')
    const shipped = demoLoops.clips['yt:l-H1OAu9N28']

    await waitFor(async () => {
      expect(await theShowcase()).toHaveTextContent(`(${shipped.length})`)
    })
  })
})
