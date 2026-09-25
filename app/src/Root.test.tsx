import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { getClip } from './clips/clip.factory'
import { holdsNothing, noThumbnails } from './clips/clipCache.factory'
import { localOpenedStore } from './clips/openedStore'
import { DEMO_CLIP } from './demo/demoClip'
import type { DriveApi } from './drive/driveApi'
import { aDriveApi } from './drive/driveApi.factory'
import { DriveSessionProvider } from './drive/DriveSessionProvider'
import type { TokenSource } from './drive/gisTokenSource'
import { inMemoryStorage } from './drive/keyValueStorage.factory'
import type { KeyValueStorage, TokenStore } from './drive/tokenStore'
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

const renderRootAt = (
  path: string,
  {
    tokenSource = sourceGranting(),
    tokenStore = nothingKept(),
    liveApi = theDancersDrive(),
    storage = inMemoryStorage(),
    fetchBytes = vi.fn(async (_url: string) => clipBytes),
  }: {
    readonly tokenSource?: TokenSource
    readonly tokenStore?: TokenStore
    readonly liveApi?: DriveApi
    readonly storage?: KeyValueStorage
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
            storage,
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
  it('shows a gallery holding only the demo clip', async () => {
    renderRootAt('/')

    await userEvent.click(screen.getByRole('link', { name: 'Demo mode' }))

    await theDemoTile()
    expect(where()).toBe('/demo')
    expect(tiles()).toHaveLength(1)
  })

  it('says it is a demo, so no one mistakes it for a real library', async () => {
    renderRootAt('/demo')

    await theDemoTile()

    expect(screen.getByRole('status', { name: 'Demo' })).toHaveTextContent(
      /demo/i,
    )
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

  it('are still there after a reload', async () => {
    const storage = inMemoryStorage()
    const first = renderRootAt('/demo', { storage })

    await userEvent.click(await theDemoTile())
    await aPlayingDemoClip(first.container)
    await saveALoop()
    first.unmount()

    const second = renderRootAt(`/demo/clip/${DEMO_CLIP.id}`, { storage })
    await aPlayingDemoClip(second.container)

    expect(
      await panel().findByRole('button', { name: /^Loop 1/ }),
    ).toBeInTheDocument()
  })

  it('are kept apart from the dancer’s own, under keys of their own', async () => {
    const storage = inMemoryStorage()
    const setItem = vi.spyOn(storage, 'setItem')
    const { container } = renderRootAt('/demo', { storage })

    await userEvent.click(await theDemoTile())
    await aPlayingDemoClip(container)
    await saveALoop()

    expect(setItem).toHaveBeenCalled()
    setItem.mock.calls.forEach(([key]) => {
      expect(key).toMatch(/^looper\.demo\./)
    })
  })
})

describe('leaving the demo', () => {
  it('goes back to the dashboard on Exit demo', async () => {
    renderRootAt('/demo')

    await userEvent.click(await screen.findByRole('link', { name: 'Exit demo' }))

    expect(where()).toBe('/')
  })

  it('ends the demo on signing in, and shows the dancer’s real library', async () => {
    renderRootAt('/demo')
    await theDemoTile()

    await userEvent.click(
      screen.getByRole('button', { name: /connect google drive/i }),
    )

    expect(await screen.findByText('Shuffle drill')).toBeInTheDocument()
    expect(where()).toBe('/')
    expect(screen.queryByText(DEMO_CLIP.name)).not.toBeInTheDocument()
  })
})
