import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ReactNode } from 'react'

import type { Clip } from '../clips/clip'
import type { DriveApi } from '../drive/driveApi'
import { aDriveApi } from '../drive/driveApi.factory'
import { DriveSessionProvider } from '../drive/DriveSessionProvider'
import type { TokenSource } from '../drive/gisTokenSource'
import type { TokenStore } from '../drive/tokenStore'
import { getClip } from '../clips/clip.factory'
import { holdsNothing } from '../clips/clipCache.factory'
import { getLoop } from '../loops/loop.factory'
import { A_REFUSAL, useFakeLoops } from '../loops/loopsHandle.factory'
import { NO_LOOPS } from '../loops/loopsFile'
import { inDocumentOrder } from '../test/documentOrder'
import { laidOut } from '../test/layout'
import { playable, runsOut } from '../test/media'
import { PlayerScreen } from './PlayerScreen'

/* The player reaches Drive now, for a clip this device has never held
   (US-01-14). Nothing in this file is about that — every clip here is local —
   so these stand the session and the api up and are never called. */
const anUnconfiguredDrive: TokenSource = async () => ({
  ok: false,
  because: 'drive-not-configured',
})

const anEmptyTokenStore: TokenStore = {
  read: () => null,
  write: () => {},
  clear: () => {},
}

const noDrive: DriveApi = aDriveApi({
  download: () => {
    throw new Error('nothing here is fetched from Drive')
  },
  toUrl: () => {
    throw new Error('nothing here mints a url')
  },
})

const inASession = (children: ReactNode) => (
  <DriveSessionProvider
    tokenSource={anUnconfiguredDrive}
    tokenStore={anEmptyTokenStore}
  >
    {children}
  </DriveSessionProvider>
)

/* The one case in this file that does reach Drive: a clip whose bytes are still
   coming down the wire, reporting as they go. It needs a session already
   *holding* a live token, not merely one that could get one — `requireToken`
   renews only a token that has expired, so a signed-out session refuses
   outright and the player says the clip could not be played instead. */
const aHeldToken = (): TokenStore => ({
  read: () => ({ value: 'ya29.kept', expiresAt: Date.now() + 3599 * 1000 }),
  write: () => {},
  clear: () => {},
})

/* The loops live above both screens now (US-01-15), so the player is handed a
   store rather than keeping one. `useFakeLoops` is that store with the Drive
   taken out — stateful on purpose, because what these cases are about is the
   round trip: save a loop and it is in the list, remove it and the number it
   freed is offered again. */
type LoopOptions = Parameters<typeof useFakeLoops>[0]

const Player = ({
  clip,
  clips = [clip],
  driveApi = noDrive,
  stillLoading = false,
  ...loops
}: {
  readonly clip: Clip
  readonly clips?: readonly Clip[]
  readonly driveApi?: DriveApi
  readonly stillLoading?: boolean
} & LoopOptions) => {
  const store = useFakeLoops(loops)

  return (
    <PlayerScreen
      clips={clips}
      driveApi={driveApi}
      clipCache={holdsNothing}
      stillLoading={stillLoading}
      loops={store}
    />
  )
}

const renderPlayerFetching = (
  { loaded, total }: { readonly loaded: number; readonly total: number },
) => {
  const clip = getClip({ src: undefined, driveId: 'drive-1' })

  /* Built once rather than inline in the JSX, for the reason `main.tsx` gives
     about the token store: `useClipSource` keys its effect on the api's
     identity, so a fresh object each render would tear down and restart the
     download on every state change — including the one the progress report
     causes. */
  const fetching: DriveApi = {
    ...noDrive,
    download: (_token, _driveId, onProgress) => {
      onProgress?.(loaded, total)

      /* Never resolves: the assertion is about what is on screen *during* the
         seven seconds, which is the whole point. */
      return new Promise<never>(() => {})
    },
  }

  return render(
    <DriveSessionProvider
      tokenSource={anUnconfiguredDrive}
      tokenStore={aHeldToken()}
    >
      <MemoryRouter initialEntries={[`/clip/${clip.id}`]}>
        <Routes>
          <Route
            path="/clip/:clipId"
            element={<Player clip={clip} driveApi={fetching} />}
          />
        </Routes>
      </MemoryRouter>
    </DriveSessionProvider>,
  )
}

const renderPlayer = (clip: Clip, loops: LoopOptions = {}) =>
  render(
    inASession(
      <MemoryRouter initialEntries={[`/clip/${clip.id}`]}>
        <Routes>
          <Route
            path="/clip/:clipId"
            element={<Player clip={clip} {...loops} />}
          />
        </Routes>
      </MemoryRouter>,
    ),
  )

/* The clip surface carries no accessible name — it is the subject of the screen,
   not a labelled control — so it is found as what it is: the video element. The
   same call ClipsScreen.test.tsx makes for the poster. Throws rather than
   returning null, so a screen that rendered no clip fails once here instead of
   making every caller narrow the type before it can assert anything. */
const clipSurface = (container: HTMLElement) => {
  const surface = container.querySelector('video')

  if (!surface) throw new Error('The player rendered no clip surface')

  return surface
}

/* A clip the library does not hold *yet*. Opening `/clip/:id` directly — a
   reload, a bookmark, a link sent to the phone — arrives before Drive has
   answered, and bouncing then would make a stored clip unopenable by its own
   URL for as long as the library takes to load. */
const renderPlayerLoading = () =>
  render(
    inASession(
      <MemoryRouter initialEntries={['/clip/not-here-yet']}>
        <Routes>
          <Route
            path="/clip/:clipId"
            element={
              <Player
                clip={getClip({ id: 'not-here-yet' })}
                clips={[]}
                stillLoading
              />
            }
          />
          <Route path="/" element={<h1>Clips</h1>} />
        </Routes>
      </MemoryRouter>,
    ),
  )

/* The same open, carried through to the moment the library answers. This is what
   every direct open looks like — a reload, a bookmark, the link sent to the
   phone — so the clip is never in hand on the first render. */
const renderPlayerAwaiting = (clip: Clip) => {
  const openedOn = (clips: readonly Clip[], stillLoading: boolean) =>
    inASession(
      <MemoryRouter initialEntries={[`/clip/${clip.id}`]}>
        <Routes>
          <Route
            path="/clip/:clipId"
            element={
              <Player clip={clip} clips={clips} stillLoading={stillLoading} />
            }
          />
          <Route path="/" element={<h1>Clips</h1>} />
        </Routes>
      </MemoryRouter>,
    )

  const rendered = render(openedOn([], true))

  rendered.rerender(openedOn([clip], false))

  return rendered
}

/* Most of the transport's behaviour only exists once the clip is ready — before
   metadata there is no region to loop and no length to return to — so these tests
   start where the dancer does, at a clip that decoded. */
const aReadyClip = ({
  seconds = 12,
  ...loops
}: { readonly seconds?: number } & LoopOptions = {}) => {
  const { container } = renderPlayer(
    getClip({ src: '/wave-practice.mp4' }),
    loops,
  )
  const clip = playable(clipSurface(container), { seconds })

  fireEvent.loadedMetadata(clip)

  return clip
}

/* The words on the controls, in the order they sit in. Read off the rendered text
   rather than an aria-label, because the criterion is about what the dancer
   reads. */
const transportLabels = () =>
  within(screen.getByRole('toolbar', { name: 'Transport' }))
    .getAllByRole('button')
    .map((control) => control.textContent?.trim())

/* Enough for a frame to be handed out. The enforcement runs on
   `requestAnimationFrame`, which vitest's fake timers stand in for along with
   everything else on the clock (BR-07). */
const A_FEW_FRAMES = 100

afterEach(() => {
  vi.useRealTimers()
})

/* The five regions US-01-05 reserved, named once. Both questions zen mode asks
   are asked of the same five, and a list per question is a list that can drift. */
const regions = [
  { role: 'toolbar', name: 'Seek and speed' },
  { role: 'group', name: 'Loop range' },
  { role: 'note', name: 'Keyboard shortcuts' },
  { role: 'toolbar', name: 'Transport' },
  { role: 'region', name: 'Saved loops' },
] as const

/* Asked for the way a dancer meets them: as things the screen is offering. A
   region that is present but hidden is not being offered, and role queries
   answer that question rather than the DOM question — which is the one zen mode
   is actually about. */
const controlsOnOffer = () =>
  regions
    .map(({ role, name }) => screen.queryByRole(role, { name }))
    .filter((region) => region !== null)

/* The same five, asked for as DOM rather than as offers. BR-08 lives in the gap
   between the two answers: still there, and not on offer. */
const controlsInPlace = (container: HTMLElement) =>
  container.querySelectorAll(
    regions.map(({ name }) => `[aria-label="${name}"]`).join(', '),
  )

/* The spike measured 7.08 s for a 9.33 MB clip, and until this story nothing on
   screen said how much of it was left. The notice itself has been here since
   US-01-14 and had no test at all — it gets one now, as the thing the fraction
   hangs off. */
describe('a clip still coming down from Drive', () => {
  it('says it is fetching rather than sitting blank', async () => {
    renderPlayerFetching({ loaded: 0, total: 10 })

    expect(await screen.findByRole('status')).toHaveTextContent(
      /fetching this clip from drive/i,
    )
  })

  it('shows how far along the download is', async () => {
    renderPlayerFetching({ loaded: 4, total: 10 })

    expect(await screen.findByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '40',
    )
  })

  /* No length from Drive means no fraction to draw — and a bar stuck at zero
     would read as a download that had stalled, which is worse than no bar. */
  it('offers no bar when Drive would not say how big the clip is', async () => {
    renderPlayerFetching({ loaded: 4, total: 0 })

    await screen.findByRole('status')

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
})

describe('a player whose clip arrives after it opened', () => {
  /* Whether the clip can be played is decided from the clip, so it cannot be
     decided before there is one. Deciding it on the first render — when a direct
     open has nothing yet — condemns every clip that arrives afterwards. */
  it('plays the clip, rather than condemning one it had not seen yet', () => {
    const { container } = renderPlayerAwaiting(
      getClip({ src: '/wave-practice.mp4' }),
    )

    expect(clipSurface(container)).toHaveAttribute('src', '/wave-practice.mp4')
  })

  it('does not claim a clip it can play could not be played', () => {
    renderPlayerAwaiting(getClip({ src: '/wave-practice.mp4' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('a player opened before the library has arrived', () => {
  it('waits, rather than bouncing to a grid that is also still loading', () => {
    renderPlayerLoading()

    expect(
      screen.queryByRole('heading', { name: 'Clips' }),
    ).not.toBeInTheDocument()
  })

  it('says it is still opening the clip', () => {
    renderPlayerLoading()

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('offers the way back out while it waits', () => {
    renderPlayerLoading()

    expect(
      screen.getByRole('link', { name: 'Back to clips' }),
    ).toBeInTheDocument()
  })
})

describe('the player', () => {
  it('names the clip it was opened on', () => {
    renderPlayer(getClip({ name: 'Wave practice' }))

    expect(screen.getByText('Wave practice')).toBeInTheDocument()
  })

  /* The control carries an aria-label of its own, so finding it by accessible
     name says nothing about what is on screen. The criterion is about the word
     a dancer reads, which only the rendered text can answer. */
  it('spells the way back out in a word, not only to a screen reader', () => {
    renderPlayer(getClip())

    expect(
      screen.getByRole('link', { name: 'Back to clips' }),
    ).toHaveTextContent('Clips')
  })

  it('puts the clip on screen as a video playing from its own source', () => {
    const { container } = renderPlayer(getClip({ src: '/wave-practice.mp4' }))

    expect(clipSurface(container)).toHaveAttribute('src', '/wave-practice.mp4')
  })

  it('reserves the controls their places, in the order they will be used', () => {
    const { container } = renderPlayer(getClip({ src: '/shuffle-drill.mp4' }))

    const order = inDocumentOrder({
      clip: clipSurface(container),
      seekAndSpeed: screen.getByRole('toolbar', { name: 'Seek and speed' }),
      loop: screen.getByRole('group', { name: 'Loop range' }),
      hint: screen.getByRole('note', { name: 'Keyboard shortcuts' }),
      transport: screen.getByRole('toolbar', { name: 'Transport' }),
      saved: screen.getByRole('region', { name: 'Saved loops' }),
    })

    expect(order).toEqual([
      'clip',
      'seekAndSpeed',
      'loop',
      'hint',
      'transport',
      'saved',
    ])
  })

  it('keeps the clip on screen once its metadata arrives', () => {
    const { container } = renderPlayer(getClip({ src: '/wave-practice.mp4' }))
    const clip = playable(clipSurface(container), { seconds: 12 })

    fireEvent.loadedMetadata(clip)

    expect(clipSurface(container)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  /* The mockup fails silently here — duration stays 00:00, the handles sit on top
     of each other and Save offers 00:00 – 00:00 — which UC-01 recorded as
     exception 6a because it was reached by accident, not chosen. A deliberate
     departure, settled at this story's approval gate. */
  it('says so when the browser cannot play the clip', () => {
    const { container } = renderPlayer(getClip({ src: '/wave-practice.mp4' }))

    fireEvent.error(clipSurface(container))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This clip couldn’t be played',
    )
    expect(container.querySelector('video')).toBeNull()
  })

  /* A clip carrying no source reaches neither route: nothing loads, so no error
     fires and no metadata arrives, and left alone it is the silent failure
     US-01-06 exists to remove. It used to be reachable through `sampleClips`,
     which kept two such clips on purpose; the library is Drive's now
     (US-01-14), so a clip with neither a local file nor a Drive id is a clip
     whose upload never finished. */
  it('says so when the clip has no source to play at all', () => {
    renderPlayer(getClip({ src: undefined }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This clip couldn’t be played',
    )
  })

  /* The failure UC-01 actually watched: Chrome declined to decode in a
     non-foreground tab, so metadata arrived carrying no length at all. It reads
     as success right up until something asks how long the clip is. */
  it('says so when the metadata arrives without a length to loop over', () => {
    const { container } = renderPlayer(getClip({ src: '/wave-practice.mp4' }))

    fireEvent.loadedMetadata(clipSurface(container))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This clip couldn’t be played',
    )
  })

  it('plays the clip when the dancer taps it', async () => {
    const { container } = renderPlayer(getClip({ src: '/wave-practice.mp4' }))
    const clip = playable(clipSurface(container), { seconds: 12 })

    await userEvent.click(clip)

    expect(clip.paused).toBe(false)
  })

  it('pauses the clip when the dancer taps it again', async () => {
    const { container } = renderPlayer(getClip({ src: '/wave-practice.mp4' }))
    const clip = playable(clipSurface(container), { seconds: 12 })

    await userEvent.click(clip)
    await userEvent.click(clip)

    expect(clip.paused).toBe(true)
  })

  /* Playback stops for reasons the app never hears about — the clip ends, the
     phone takes a call, another tab claims the audio. A player keeping its own
     idea of whether it is playing would answer the next tap with pause() on an
     already-paused clip, and the dancer would have to tap twice. */
  it('plays a clip that stopped on its own, rather than pausing it again', async () => {
    const { container } = renderPlayer(getClip({ src: '/wave-practice.mp4' }))
    const clip = playable(clipSurface(container), { seconds: 12 })

    await userEvent.click(clip)
    fireEvent.pause(clip)
    await userEvent.click(clip)

    expect(clip.paused).toBe(false)
  })

  /* Zen mode. The clip alone on black, because once the section is framed there
     is nothing left to look at but the movement (UC-01 step 16). */
  it('takes everything but the clip off the screen when the video is isolated', async () => {
    renderPlayer(getClip({ src: '/wave-practice.mp4' }))

    await userEvent.click(
      screen.getByRole('button', { name: 'Isolate the video' }),
    )

    expect(screen.queryByRole('link', { name: 'Back to clips' })).toBeNull()
    expect(controlsOnOffer()).toHaveLength(0)
  })

  /* BR-08: zen mode restyles the player, it never rebuilds it. Moving the clip
     in the page would remount it — the clip reloads and the position being
     watched is gone — so the controls are hidden where they stand rather than
     torn down, and the clip is the same element on both sides of the toggle. */
  it('hides the controls where they stand rather than tearing them down', async () => {
    const { container } = renderPlayer(getClip({ src: '/wave-practice.mp4' }))
    const clip = clipSurface(container)

    await userEvent.click(
      screen.getByRole('button', { name: 'Isolate the video' }),
    )

    expect(controlsInPlace(container)).toHaveLength(5)
    expect(clipSurface(container)).toBe(clip)
  })

  /* The consequence the dancer actually feels, and the reason BR-08 is a rule
     rather than a preference: the clip is still running, from where it was. */
  it('keeps the clip playing when the video is isolated', async () => {
    const { container } = renderPlayer(getClip({ src: '/wave-practice.mp4' }))
    await userEvent.click(playable(clipSurface(container), { seconds: 12 }))

    await userEvent.click(
      screen.getByRole('button', { name: 'Isolate the video' }),
    )

    expect(clipSurface(container).paused).toBe(false)
  })

  /* One control changing identity, not two: the same button a dancer used to
     get here is the way back out, which is what keeps them from being trapped
     with the header gone and no shortcut in hand. */
  it('gives the controls back when the video is released', async () => {
    renderPlayer(getClip({ src: '/wave-practice.mp4' }))
    await userEvent.click(
      screen.getByRole('button', { name: 'Isolate the video' }),
    )

    await userEvent.click(
      screen.getByRole('button', { name: 'Leave the isolated view' }),
    )

    expect(
      screen.getByRole('link', { name: 'Back to clips' }),
    ).toBeInTheDocument()
    expect(controlsOnOffer()).toHaveLength(5)
  })

  /* The close control lives on the video, so a clip that fails while isolated
     takes the way out with it: the message renders on the black field with no
     header and — until US-01-10 — no shortcut either. Zen mode has nothing left
     to isolate at that point, so it lets go. */
  it('lets the dancer out when the clip fails while the video is isolated', async () => {
    const { container } = renderPlayer(getClip({ src: '/wave-practice.mp4' }))
    await userEvent.click(
      screen.getByRole('button', { name: 'Isolate the video' }),
    )

    fireEvent.error(clipSurface(container))

    expect(
      screen.getByRole('link', { name: 'Back to clips' }),
    ).toBeInTheDocument()
  })

  it('leaves the way back where it was when the clip will not play', () => {
    const { container } = renderPlayer(getClip({ src: '/wave-practice.mp4' }))

    fireEvent.error(clipSurface(container))

    expect(
      screen.getByRole('link', { name: 'Back to clips' }),
    ).toBeInTheDocument()
  })
})

describe('the transport', () => {
  it('offers three controls, in the order they are reached for', () => {
    aReadyClip()

    expect(transportLabels()).toEqual(['START', 'LOOPING', 'PLAY'])
  })

  /* BR-01: the player opens ready to loop, so pressing play immediately does the
     thing the app is for. US-01-06 seeds the region and `playback.test.ts` pins
     that; what this asserts is that the screen shows it. */
  it('opens already looping', () => {
    aReadyClip()

    expect(screen.getByRole('button', { name: 'LOOPING' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('releases the loop when LOOPING is pressed, and takes it back again', async () => {
    aReadyClip()

    await userEvent.click(screen.getByRole('button', { name: 'LOOPING' }))

    expect(transportLabels()).toEqual(['START', 'START LOOP', 'PLAY'])
    expect(screen.getByRole('button', { name: 'START LOOP' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )

    await userEvent.click(screen.getByRole('button', { name: 'START LOOP' }))

    expect(transportLabels()).toEqual(['START', 'LOOPING', 'PLAY'])
  })

  it('offers PAUSE while the clip is playing', async () => {
    const clip = aReadyClip()

    await userEvent.click(clip)

    expect(transportLabels()).toEqual(['START', 'LOOPING', 'PAUSE'])
  })

  /* The word has to come from the element rather than from the tap that started
     it. A clip that reaches its end, or that a phone call stops, sends the app no
     message — and a label set by the click would still be offering PAUSE on a
     clip that had already stopped. US-01-06 refused to keep that second copy of
     the answer for the same reason (`PlayerScreen.tsx:7-10`). */
  it('goes back to PLAY when the clip stops on its own', async () => {
    const clip = aReadyClip()

    await userEvent.click(clip)
    fireEvent.pause(clip)

    expect(transportLabels()).toEqual(['START', 'LOOPING', 'PLAY'])
  })

  /* Tapping the clip already worked (US-01-06). This is the same thing from a
     control the dancer can hit without looking, which is the point of the
     transport. */
  it('plays and pauses the clip from the transport itself', async () => {
    const clip = aReadyClip()

    await userEvent.click(screen.getByRole('button', { name: 'PLAY' }))

    expect(clip.paused).toBe(false)

    await userEvent.click(screen.getByRole('button', { name: 'PAUSE' }))

    expect(clip.paused).toBe(true)
  })

  /* A is 0 for every clip until US-01-08 lets it be dragged, so this cannot yet
     tell "jumps to A" from "jumps to nought" — only that it jumps, and that it
     leaves everything else where it was. The second half is the criterion's real
     content anyway: START is for restarting the section without losing the loop
     or stopping the music. */
  it('jumps back to A when START is pressed, and changes nothing else', async () => {
    const clip = aReadyClip()

    await userEvent.click(screen.getByRole('button', { name: 'PLAY' }))
    clip.currentTime = 7

    await userEvent.click(screen.getByRole('button', { name: 'START' }))

    expect(clip.currentTime).toBe(0)
    expect(clip.paused).toBe(false)
    expect(screen.getByRole('button', { name: 'LOOPING' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})

describe('the speed stepper', () => {
  it('opens at normal speed, in the region reserved for it', () => {
    aReadyClip()

    expect(
      within(
        screen.getByRole('toolbar', { name: 'Seek and speed' }),
      ).getByLabelText('Playback speed'),
    ).toHaveTextContent(/^1$/)
  })

  /* The mockup offers the stepper whatever state the clip is in, so a clip that
     will not decode still gets a rate control with nothing to apply it to.
     US-01-07 settled the opposite shape for the transport, and a dead speed
     control is the same mistake — a deliberate departure, settled at this
     story's approval gate. */
  it('is not offered on a clip that will not play', () => {
    const { container } = renderPlayer(getClip({ src: '/wave-practice.mp4' }))

    fireEvent.error(clipSurface(container))

    expect(screen.queryByLabelText('Playback speed')).not.toBeInTheDocument()
  })

  /* The other half of it, and not the same case: a clip still waiting on its
     metadata has not failed, it simply has nothing to play yet. Gating on
     "has not failed" rather than "is ready" would pass the test above and fail
     this one. */
  it('is not offered before the clip is ready', () => {
    renderPlayer(getClip({ src: '/wave-practice.mp4' }))

    expect(screen.queryByLabelText('Playback speed')).not.toBeInTheDocument()
  })

  it('slows the clip itself down, not just the number on the screen', async () => {
    const clip = aReadyClip()

    await userEvent.click(screen.getByRole('button', { name: 'Slower' }))

    expect(clip.playbackRate).toBe(0.95)
  })

  /* The half of the criterion that is about what does *not* happen. A rate is
     changed while the section is running — that is the whole point of it — so a
     change that stopped the clip, or dropped the loop and let it run on past B,
     would have taken away the thing the dancer was in the middle of doing. */
  it('changes the rate without interrupting the loop', () => {
    vi.useFakeTimers()
    const clip = aReadyClip({ seconds: 12 })

    fireEvent.play(clip)
    fireEvent.click(screen.getByRole('button', { name: 'Much slower' }))
    clip.currentTime = 12
    vi.advanceTimersByTime(A_FEW_FRAMES)

    expect(clip.playbackRate).toBe(0.9)
    expect(clip.paused).toBe(false)
    expect(clip.currentTime).toBe(0)
  })
})

/* BR-07: enforced per animation frame rather than on the video's own progress
   events, which fire at about 4 Hz — the spike measured 86 ms of overshoot on a
   two-second loop that way, which is visible. */
describe('holding the clip inside the loop', () => {
  it('returns to A when playback reaches B', () => {
    vi.useFakeTimers()
    const clip = aReadyClip({ seconds: 12 })

    fireEvent.play(clip)
    clip.currentTime = 12
    vi.advanceTimersByTime(A_FEW_FRAMES)

    expect(clip.currentTime).toBe(0)
  })

  /* `fireEvent` rather than `userEvent` throughout this block: userEvent waits on
     its own timers, which the fake clock is now holding.

     This one used to also assert `getTimerCount()` was 0, as a proxy for "the
     enforcement callback was not scheduled". That held only while enforcement
     was the sole animation frame in the player; US-01-08 added the playhead's,
     which runs on any playing clip whether or not it is looping, so the count
     stopped meaning what the test was reading it as. The behavioural assertion
     below is the one that pins the rule. BR-07's battery claim keeps its guard
     in the paused test, where nothing at all is scheduled and 0 still means 0. */
  it('lets the clip run on past B once looping is off', () => {
    vi.useFakeTimers()
    const clip = aReadyClip({ seconds: 12 })

    fireEvent.click(screen.getByRole('button', { name: 'LOOPING' }))
    fireEvent.play(clip)
    clip.currentTime = 12
    vi.advanceTimersByTime(A_FEW_FRAMES)

    expect(clip.currentTime).toBe(12)
  })

  /* The other half of BR-07's settled form, and the answer to its open question
     about battery: a paused clip has no overshoot to correct, so there is nothing
     for a callback to do and it is not scheduled at all. The mockup subscribes
     once and never stops, running for as long as the player is open whatever the
     clip is doing. */
  it('enforces nothing, and schedules nothing, while the clip is paused', () => {
    vi.useFakeTimers()
    const clip = aReadyClip({ seconds: 12 })

    clip.currentTime = 12
    vi.advanceTimersByTime(A_FEW_FRAMES)

    expect(clip.currentTime).toBe(12)
    expect(vi.getTimerCount()).toBe(0)
  })

  /* US-01-12's fifth criterion, which had no loop to run when zen mode was
     built and has one now that US-01-07 has landed. It is the consequence BR-08
     exists for: the enforcement holds a ref to the element and the effect is
     keyed on playback, so a toggle that remounted the clip would hand the loop
     a stale handle and the section would run away. Isolating changes classes
     and nothing else, so the loop does not notice. */
  it('keeps holding the clip inside the loop while the video is isolated', () => {
    vi.useFakeTimers()
    const clip = aReadyClip({ seconds: 12 })

    fireEvent.play(clip)
    fireEvent.click(screen.getByRole('button', { name: 'Isolate the video' }))
    clip.currentTime = 12
    vi.advanceTimersByTime(A_FEW_FRAMES)

    expect(clip.currentTime).toBe(0)
    expect(
      screen.getByRole('button', { name: 'Leave the isolated view' }),
    ).toBeInTheDocument()
  })

  /* B sits at the clip's end until US-01-08 moves it (BR-01), so "reaching B" and
     "the clip running out" are the same instant — and the element can win that
     race, ending before the frame that would have sent it back. Once it has
     ended it is paused, so no frame is ever scheduled to notice, and the clip
     just stops. Found by driving the real app; jsdom fires no `ended` of its own,
     so nothing here could have caught it. */
  it('returns to A when the clip runs out on B, rather than stopping there', () => {
    const clip = aReadyClip({ seconds: 12 })

    fireEvent.play(clip)
    clip.currentTime = 12
    runsOut(clip)

    expect(clip.currentTime).toBe(0)
    expect(clip.paused).toBe(false)
  })
})

/* The span and the playhead carry no accessible identity, and that is the right
   a11y model rather than an omission: the two handles are the sliders, and these
   are decoration mirroring what they already announce. They are named in the
   markup so a test can still ask where they sit — the same move
   `container.querySelector('video')` makes above for the clip itself. */
const loopSpan = (container: HTMLElement) => container.querySelector('.loop-span')

describe('the loop slider', () => {
  it('offers nothing to frame until the clip has a length to frame against', () => {
    renderPlayer(getClip({ src: '/wave-practice.mp4' }))

    expect(
      within(screen.getByRole('group', { name: 'Loop range' })).queryByRole(
        'slider',
      ),
    ).not.toBeInTheDocument()
  })

  /* BR-01: the player opens ready to loop, with A and B spanning the whole clip.
     The highlight is the visible half of that — a dancer who presses play sees
     the entire track lit, which is what "nothing has to be armed first" looks
     like. */
  it('highlights the whole clip when the player opens', () => {
    const { container } = renderPlayer(getClip({ src: '/wave-practice.mp4' }))

    fireEvent.loadedMetadata(playable(clipSurface(container), { seconds: 12 }))

    expect(loopSpan(container)).toHaveStyle({ left: '0%', width: '100%' })
  })
})

/* BR-07, extended at this story's approval gate: the marker is sampled per
   animation frame like the loop itself. The mockup reads it from `timeupdate`
   instead, which fires at about 4 Hz — the rate BR-07 already rejected as too
   coarse to enforce a loop with, and just as visible in a marker that ticks
   rather than glides. */
describe('the playhead marker', () => {
  const playhead = (container: HTMLElement) =>
    container.querySelector('.loop-playhead')

  it('follows the clip as it plays', () => {
    vi.useFakeTimers()
    const { container } = renderPlayer(getClip({ src: '/wave-practice.mp4' }))
    const clip = playable(clipSurface(container), { seconds: 12 })

    fireEvent.loadedMetadata(clip)
    fireEvent.play(clip)
    clip.currentTime = 6
    /* The enforcement tests above advance the clock bare, because that callback
       writes to the video element. This one writes React state, so the render it
       causes has to be flushed before the marker can be read. */
    act(() => vi.advanceTimersByTime(A_FEW_FRAMES))

    expect(playhead(container)).toHaveStyle({ left: '50%' })
  })

  /* The reason this is a second callback rather than a share of the loop's. That
     one is gated on looping as well as playing (BR-07), so a marker riding on it
     would freeze the moment the dancer let the clip run on — at exactly the
     point they are watching where it has got to. */
  it('keeps following the clip once the loop is released', () => {
    vi.useFakeTimers()
    const { container } = renderPlayer(getClip({ src: '/wave-practice.mp4' }))
    const clip = playable(clipSurface(container), { seconds: 12 })

    fireEvent.loadedMetadata(clip)
    fireEvent.click(screen.getByRole('button', { name: 'LOOPING' }))
    fireEvent.play(clip)
    clip.currentTime = 9
    act(() => vi.advanceTimersByTime(A_FEW_FRAMES))

    expect(playhead(container)).toHaveStyle({ left: '75%' })
  })
})

describe('the loop handles', () => {
  const handles = () =>
    screen.getAllByRole('slider').map((handle) => handle.getAttribute('aria-label'))

  it('offers one handle for each end of the loop', () => {
    aReadyClip({ seconds: 12 })

    expect(handles()).toEqual(['Loop start', 'Loop end'])
  })

  /* Each handle ranges over the whole clip, not over the loop: B can be dragged
     anywhere from A to the end, and saying otherwise would tell a screen-reader
     user the clip is shorter than it is. */
  it('announces each handle against the whole clip', () => {
    aReadyClip({ seconds: 12 })

    const start = screen.getByRole('slider', { name: 'Loop start' })

    expect(start).toHaveAttribute('aria-valuemin', '0')
    expect(start).toHaveAttribute('aria-valuemax', '12')
    expect(start).toHaveAttribute('aria-valuenow', '0')
  })

  /* `aria-valuenow` on its own is read out as a bare number, and after a drag it
     is a number like 4.283. The dancer is choosing a moment in a clip, so the
     handle says the time. */
  it('speaks its position as a time rather than a count of seconds', () => {
    aReadyClip({ seconds: 12 })

    expect(screen.getByRole('slider', { name: 'Loop end' })).toHaveAttribute(
      'aria-valuetext',
      '0:12',
    )
  })

  /* Written the way the grid writes them (`formatDuration`), not the way the
     mockup does — the player should not spell a length differently from the tile
     it was opened from. */
  it('writes the time of each boundary beside its handle', () => {
    aReadyClip({ seconds: 75 })

    expect(screen.getByText('0:00')).toBeInTheDocument()
    expect(screen.getByText('1:15')).toBeInTheDocument()
  })
})

/* A drag reads where the pointer landed against the width of the track, and
   jsdom lays nothing out — so the track has to be given a size before any of
   this can be asked. 200px over a 12s clip makes every position a round number:
   100px is 6s. */
const aLaidOutTrack = ({ width = 200 } = {}) => {
  const track = document.querySelector('.loop-track')

  if (!track) throw new Error('The player rendered no track')

  return laidOut(track, { width })
}

const dragTo = (handle: HTMLElement, clientX: number) => {
  fireEvent.pointerDown(handle, { pointerId: 1 })
  fireEvent.pointerMove(handle, { pointerId: 1, clientX })
}

describe('dragging a loop boundary', () => {
  it('moves the boundary to where the drag reaches', () => {
    aReadyClip({ seconds: 12 })
    aLaidOutTrack()

    dragTo(screen.getByRole('slider', { name: 'Loop end' }), 100)

    expect(screen.getByRole('slider', { name: 'Loop end' })).toHaveAttribute(
      'aria-valuenow',
      '6',
    )
  })

  /* The criterion's reason for existing: the boundary is chosen by what is on
     screen, not by arithmetic. A drag that moved the handle without moving the
     clip would make the dancer guess. */
  it('seeks the clip as the boundary moves', () => {
    const clip = aReadyClip({ seconds: 12 })
    aLaidOutTrack()

    dragTo(screen.getByRole('slider', { name: 'Loop end' }), 50)

    expect(clip.currentTime).toBe(3)
  })

  it('lights the track between A and B as B is brought in', () => {
    const { container } = renderPlayer(getClip({ src: '/wave-practice.mp4' }))

    fireEvent.loadedMetadata(playable(clipSurface(container), { seconds: 12 }))
    aLaidOutTrack()
    dragTo(screen.getByRole('slider', { name: 'Loop end' }), 100)

    expect(loopSpan(container)).toHaveStyle({ left: '0%', width: '50%' })
  })

  /* BR-18, from the far end of the track: `movedTo` is what holds the floor, and
     this is the drag proving it goes through it rather than clamping its own
     way. */
  it('stops A short of B rather than letting it cross', () => {
    aReadyClip({ seconds: 12 })
    aLaidOutTrack()

    dragTo(screen.getByRole('slider', { name: 'Loop start' }), 400)

    expect(screen.getByRole('slider', { name: 'Loop start' })).toHaveAttribute(
      'aria-valuenow',
      '11.8',
    )
  })

  it('moves nothing when the pointer travels without a drag having begun', () => {
    aReadyClip({ seconds: 12 })
    aLaidOutTrack()

    fireEvent.pointerMove(screen.getByRole('slider', { name: 'Loop end' }), {
      pointerId: 1,
      clientX: 50,
    })

    expect(screen.getByRole('slider', { name: 'Loop end' })).toHaveAttribute(
      'aria-valuenow',
      '12',
    )
  })

  it('lets the boundary go when the drag ends', () => {
    aReadyClip({ seconds: 12 })
    aLaidOutTrack()

    const end = screen.getByRole('slider', { name: 'Loop end' })

    dragTo(end, 100)
    fireEvent.pointerUp(end, { pointerId: 1 })
    fireEvent.pointerMove(end, { pointerId: 1, clientX: 20 })

    expect(end).toHaveAttribute('aria-valuenow', '6')
  })
})

/* BR-19. The player opens looping (BR-01), so a loop that is *running* is the
   ordinary condition a boundary gets moved in — not an edge case. Enforcement
   and the drag's own seek are then the same clip pulled two ways: the drag puts
   the playhead on B so the dancer can see the boundary they are placing, and
   enforcement reads that as the loop having reached its end and sends it to A on
   the very next frame. The dancer sees the start of the clip, and the criterion
   about choosing a boundary by what is on screen quietly stops holding. */
describe('framing the loop while it runs', () => {
  it('shows the boundary being dragged rather than restarting the loop', () => {
    vi.useFakeTimers()
    const clip = aReadyClip({ seconds: 12 })
    aLaidOutTrack()

    fireEvent.play(clip)
    dragTo(screen.getByRole('slider', { name: 'Loop end' }), 100)
    act(() => vi.advanceTimersByTime(A_FEW_FRAMES))

    expect(clip.currentTime).toBe(6)
  })

  /* The keyed route reaches the same clip through the same `movedTo`, so it
     stands down for the same reason. */
  it('shows the boundary a key just moved rather than restarting the loop', () => {
    vi.useFakeTimers()
    const clip = aReadyClip({ seconds: 12 })

    fireEvent.play(clip)
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Loop end' }), {
      key: 'Home',
    })
    act(() => vi.advanceTimersByTime(A_FEW_FRAMES))

    expect(clip.currentTime).toBe(0.2)
  })

  /* Standing down is for the length of the adjustment and no longer. Letting go
     is the dancer saying they are done framing, and the loop they have just
     framed is what they wanted to hear. */
  it('enforces the loop again as soon as the drag ends', () => {
    vi.useFakeTimers()
    const clip = aReadyClip({ seconds: 12 })
    aLaidOutTrack()

    fireEvent.play(clip)
    const end = screen.getByRole('slider', { name: 'Loop end' })

    dragTo(end, 100)
    fireEvent.pointerUp(end, { pointerId: 1 })
    act(() => vi.advanceTimersByTime(A_FEW_FRAMES))

    expect(clip.currentTime).toBe(0)
  })

  it('enforces the loop again as soon as the key is released', () => {
    vi.useFakeTimers()
    const clip = aReadyClip({ seconds: 12 })
    const end = screen.getByRole('slider', { name: 'Loop end' })

    fireEvent.play(clip)
    fireEvent.keyDown(end, { key: 'Home' })
    fireEvent.keyUp(end, { key: 'Home' })
    act(() => vi.advanceTimersByTime(A_FEW_FRAMES))

    expect(clip.currentTime).toBe(0)
  })

  /* A handle tabbed away from mid-adjustment never sees its own keyup, and a
     loop that stayed released would be a loop the dancer had to re-arm without
     being told it had stopped. */
  it('enforces the loop again when the handle loses focus', () => {
    vi.useFakeTimers()
    const clip = aReadyClip({ seconds: 12 })
    const end = screen.getByRole('slider', { name: 'Loop end' })

    fireEvent.play(clip)
    fireEvent.keyDown(end, { key: 'Home' })
    fireEvent.blur(end)
    act(() => vi.advanceTimersByTime(A_FEW_FRAMES))

    expect(clip.currentTime).toBe(0)
  })

  /* The other half of the rule: nothing about framing touches a clip that is not
     looping, so the drag's seek is the only thing writing to the playhead and it
     stays where the boundary landed whether the handle is held or let go. */
  it('leaves a released loop alone whether the handle is held or not', () => {
    vi.useFakeTimers()
    const clip = aReadyClip({ seconds: 12 })
    aLaidOutTrack()

    fireEvent.click(screen.getByRole('button', { name: 'LOOPING' }))
    fireEvent.play(clip)
    const end = screen.getByRole('slider', { name: 'Loop end' })

    dragTo(end, 100)
    fireEvent.pointerUp(end, { pointerId: 1 })
    act(() => vi.advanceTimersByTime(A_FEW_FRAMES))

    expect(clip.currentTime).toBe(6)
  })
})

describe('tapping the track', () => {
  it('seeks the clip to the point tapped', () => {
    const clip = aReadyClip({ seconds: 12 })

    fireEvent.pointerDown(aLaidOutTrack(), { pointerId: 1, clientX: 50 })

    expect(clip.currentTime).toBe(3)
  })

  /* Scrubbing and framing are separate acts. A tap that dragged the nearest
     boundary with it would destroy the loop every time the dancer looked
     somewhere else in the clip. */
  it('leaves both boundaries where they were', () => {
    aReadyClip({ seconds: 12 })

    fireEvent.pointerDown(aLaidOutTrack(), { pointerId: 1, clientX: 50 })

    expect(screen.getByRole('slider', { name: 'Loop start' })).toHaveAttribute(
      'aria-valuenow',
      '0',
    )
    expect(screen.getByRole('slider', { name: 'Loop end' })).toHaveAttribute(
      'aria-valuenow',
      '12',
    )
  })

  /* A paused clip schedules no frame, so nothing would otherwise notice the
     playhead had moved and the marker would sit where the clip used to be. */
  it('moves the marker even though the clip is paused', () => {
    const { container } = renderPlayer(getClip({ src: '/wave-practice.mp4' }))

    fireEvent.loadedMetadata(playable(clipSurface(container), { seconds: 12 }))
    fireEvent.pointerDown(aLaidOutTrack(), { pointerId: 1, clientX: 150 })

    expect(container.querySelector('.loop-playhead')).toHaveStyle({ left: '75%' })
  })
})

/* The gap this story picked up at its approval gate: the mockup gives each
   handle `role="slider"` and `tabIndex={0}`, promising keyboard operation, and
   implements none — and US-01-10 is about space setting A and B, never about
   adjusting a handle that already has focus. */
describe('keying a focused loop boundary', () => {
  const start = () => screen.getByRole('slider', { name: 'Loop start' })
  const end = () => screen.getByRole('slider', { name: 'Loop end' })

  it('moves the boundary a second on, and seeks with it', () => {
    const clip = aReadyClip({ seconds: 12 })

    fireEvent.keyDown(start(), { key: 'ArrowRight' })

    expect(start()).toHaveAttribute('aria-valuenow', '1')
    expect(clip.currentTime).toBe(1)
  })

  it('moves it a second back, stopping at the start of the clip', () => {
    aReadyClip({ seconds: 12 })

    fireEvent.keyDown(start(), { key: 'ArrowRight' })
    fireEvent.keyDown(start(), { key: 'ArrowLeft' })
    fireEvent.keyDown(start(), { key: 'ArrowLeft' })

    expect(start()).toHaveAttribute('aria-valuenow', '0')
  })

  it('sends the boundary to the start of the clip with Home', () => {
    aReadyClip({ seconds: 12 })

    fireEvent.keyDown(start(), { key: 'ArrowRight' })
    fireEvent.keyDown(start(), { key: 'Home' })

    expect(start()).toHaveAttribute('aria-valuenow', '0')
  })

  /* Clamped by exactly what a drag is clamped by, because both go through
     `movedTo` — End asks for the end of the clip and gets as far as BR-18 allows
     rather than passing B. */
  it('sends it as far as End can reach without passing the other boundary', () => {
    aReadyClip({ seconds: 12 })

    fireEvent.keyDown(start(), { key: 'End' })

    expect(start()).toHaveAttribute('aria-valuenow', '11.8')
  })

  it('holds B off A when Home is pressed on it', () => {
    aReadyClip({ seconds: 12 })

    fireEvent.keyDown(end(), { key: 'Home' })

    expect(end()).toHaveAttribute('aria-valuenow', '0.2')
  })

  /* An arrow key on a focused element scrolls the page as well. `fireEvent`
     returns false when the handler called `preventDefault`, which is the only
     report jsdom can give of "and the page stays where it is". */
  it('does not let the page scroll out from under the handle', () => {
    aReadyClip({ seconds: 12 })

    expect(fireEvent.keyDown(start(), { key: 'ArrowRight' })).toBe(false)
  })

  it('leaves the loop alone for a key it has no use for', () => {
    aReadyClip({ seconds: 12 })

    fireEvent.keyDown(start(), { key: 'a' })

    expect(start()).toHaveAttribute('aria-valuenow', '0')
  })
})

describe('nudging the playhead', () => {
  const seekControls = () =>
    within(screen.getByRole('toolbar', { name: 'Seek and speed' }))
      .getAllByRole('button')
      .map((control) => control.getAttribute('aria-label'))

  /* A leading slice rather than the whole row, because US-01-09's speed stepper
     shares this toolbar and sits to the right of the seek pair — the mockup's
     arrangement, and the reason the row is `justify-between`. Asserting the
     slice says where the pair is as well as that it is there. */
  it('offers a second back and a second on, ahead of the speed stepper', () => {
    aReadyClip({ seconds: 12 })

    expect(seekControls().slice(0, 2)).toEqual([
      'Back 1 second',
      'Forward 1 second',
    ])
  })

  it('offers nothing to nudge until there is a clip to nudge through', () => {
    renderPlayer(getClip({ src: '/wave-practice.mp4' }))

    expect(
      within(screen.getByRole('toolbar', { name: 'Seek and speed' })).queryByRole(
        'button',
      ),
    ).not.toBeInTheDocument()
  })

  it('moves the clip on by a second', async () => {
    const clip = aReadyClip({ seconds: 12 })
    clip.currentTime = 4

    await userEvent.click(screen.getByRole('button', { name: 'Forward 1 second' }))

    expect(clip.currentTime).toBe(5)
  })

  it('moves the clip back by a second', async () => {
    const clip = aReadyClip({ seconds: 12 })
    clip.currentTime = 4

    await userEvent.click(screen.getByRole('button', { name: 'Back 1 second' }))

    expect(clip.currentTime).toBe(3)
  })

  it('stops at the end of the clip rather than running past it', async () => {
    const clip = aReadyClip({ seconds: 12 })
    clip.currentTime = 11.5

    await userEvent.click(screen.getByRole('button', { name: 'Forward 1 second' }))

    expect(clip.currentTime).toBe(12)
  })

  it('stops at the start of the clip rather than going behind it', async () => {
    const clip = aReadyClip({ seconds: 12 })
    clip.currentTime = 0.4

    await userEvent.click(screen.getByRole('button', { name: 'Back 1 second' }))

    expect(clip.currentTime).toBe(0)
  })

  /* The nudge is for looking around inside the clip, not for reframing it. */
  it('leaves the loop where it is', async () => {
    aReadyClip({ seconds: 12 })

    await userEvent.click(screen.getByRole('button', { name: 'Forward 1 second' }))

    expect(screen.getByRole('slider', { name: 'Loop start' })).toHaveAttribute(
      'aria-valuenow',
      '0',
    )
  })
})

/* Fired at the window rather than at a control, because that is where the handler
   listens: the point of a shortcut is that nothing has to be focused first. */
const press = (code: string) => fireEvent.keyDown(window, { code })

const boundary = (handle: 'Loop start' | 'Loop end') =>
  screen.getByRole('slider', { name: handle })

/* UC-01 steps 9–10. The section gets marked while it goes past, which is the whole
   reason the keyboard is here — aiming at a handle means stopping to aim. */
describe('setting the loop points with space', () => {
  it('sets A wherever the clip has got to', () => {
    const clip = aReadyClip({ seconds: 12 })
    clip.currentTime = 6

    press('Space')

    expect(boundary('Loop start')).toHaveAttribute('aria-valuenow', '6')
  })

  /* BR-02. Setting A alone would leave B behind the playhead and the loop
     invalid, so B goes to the end of the clip and what is on screen stays
     something the dancer could press play on. */
  it('parks B at the end of the clip so what is on screen is still a loop', () => {
    const clip = aReadyClip({ seconds: 12 })
    aLaidOutTrack()
    dragTo(boundary('Loop end'), 100)
    clip.currentTime = 9

    press('Space')

    expect(boundary('Loop end')).toHaveAttribute('aria-valuenow', '12')
  })

  /* The pair of presses the story exists for: one as the phrase starts, one as it
     ends, and the section is framed without the clip ever being stopped. */
  it('sets B on the next press, so two presses frame the section', () => {
    const clip = aReadyClip({ seconds: 12 })

    clip.currentTime = 6
    press('Space')
    clip.currentTime = 9
    press('Space')

    expect(boundary('Loop start')).toHaveAttribute('aria-valuenow', '6')
    expect(boundary('Loop end')).toHaveAttribute('aria-valuenow', '9')
  })

  /* BR-03: presses cycle A, B, A… so the dancer can reframe from wherever they
     are without reaching for anything. */
  it('comes round to A on the press after that', () => {
    const clip = aReadyClip({ seconds: 12 })

    clip.currentTime = 6
    press('Space')
    clip.currentTime = 9
    press('Space')
    clip.currentTime = 3
    press('Space')

    expect(boundary('Loop start')).toHaveAttribute('aria-valuenow', '3')
  })

  /* BR-18, through the same `movedTo` the drag uses. A press that lands B on top
     of A would leave a loop with nothing in it. */
  it('keeps B off A by the minimum loop', () => {
    const clip = aReadyClip({ seconds: 12 })

    clip.currentTime = 6
    press('Space')
    clip.currentTime = 6.05
    press('Space')

    expect(boundary('Loop end')).toHaveAttribute('aria-valuenow', '6.2')
  })

  /* Space is the page's scroll key and the activation key of whatever button was
     last touched, and the dancer has almost certainly just touched one. Marking a
     section would otherwise scroll the clip out of view, or start the loop over,
     or both at once. `fireEvent` reports whether the default survived. */
  it('takes the key rather than letting it scroll the page or press a button', () => {
    aReadyClip({ seconds: 12 })

    expect(fireEvent.keyDown(window, { code: 'Space' })).toBe(false)
  })
})

/* UC-01 alternate flow 11a. Space and the handles are two ways into one state,
   not two states — so a dancer who marks A and then decides to place B by hand
   finds space armed for A again, rather than for a B they have already set. */
describe('finishing a half-set loop by hand', () => {
  it('re-arms space for A when B is dragged into place', () => {
    const clip = aReadyClip({ seconds: 12 })
    aLaidOutTrack()

    clip.currentTime = 6
    press('Space')
    dragTo(boundary('Loop end'), 150)
    clip.currentTime = 3
    press('Space')

    /* A at 3 is the whole of it: had space still been armed for B it would have
       tried to put B at 3, where BR-18's floor would have held it at 6.2 and left
       A where it was. */
    expect(boundary('Loop start')).toHaveAttribute('aria-valuenow', '3')
  })

  /* The arrow keys reach the same boundary by the same route, and BR-03 makes
     the ways of setting the points one state — so nudging B finishes the loop
     exactly as dragging it does. */
  it('re-arms space for A when B is moved with its arrow keys', () => {
    const clip = aReadyClip({ seconds: 12 })

    clip.currentTime = 6
    press('Space')
    fireEvent.keyDown(boundary('Loop end'), { key: 'ArrowLeft' })
    clip.currentTime = 3
    press('Space')

    expect(boundary('Loop start')).toHaveAttribute('aria-valuenow', '3')
  })

  /* Only B finishes a loop. A is already set — that is what made the loop
     half-set — so moving it leaves space waiting for the B it is still missing. */
  it('leaves space armed for B when A is the handle that moved', () => {
    const clip = aReadyClip({ seconds: 12 })

    clip.currentTime = 6
    press('Space')
    fireEvent.keyDown(boundary('Loop start'), { key: 'ArrowLeft' })
    clip.currentTime = 9
    press('Space')

    expect(boundary('Loop end')).toHaveAttribute('aria-valuenow', '9')
  })
})

/* UC-01 step 16 and alternate flow 16a. `f` is the key YouTube already trained
   into the hand, and Escape is the way out of everything else that fills a
   screen. */
describe('isolating the video from the keyboard', () => {
  const isolated = () =>
    screen.queryByRole('button', { name: 'Leave the isolated view' }) !== null

  it('isolates the video when f is pressed', () => {
    aReadyClip({ seconds: 12 })

    press('KeyF')

    expect(isolated()).toBe(true)
  })

  it('gives the controls back when f is pressed again', () => {
    aReadyClip({ seconds: 12 })

    press('KeyF')
    press('KeyF')

    expect(isolated()).toBe(false)
  })

  it('leaves the isolated view when Escape is pressed', () => {
    aReadyClip({ seconds: 12 })

    press('KeyF')
    press('Escape')

    expect(isolated()).toBe(false)
  })

  /* A clip that will not decode has nothing to isolate and no position to mark,
     so nothing is bound on it — the same gate that keeps space off it. Without
     that, `f` would black out a screen whose only content is the sentence saying
     the clip could not be played. */
  it('does nothing on a clip that will not decode', () => {
    const { container } = renderPlayer(getClip({ src: '/wave-practice.mp4' }))

    fireEvent.error(clipSurface(container))
    press('KeyF')

    expect(isolated()).toBe(false)
  })
})

/* BR-05 and UC-01 alternate flow *a. Every shortcut here is space or a single
   printing character, so a caret in a text field turns each of them into
   something the dancer meant to type — otherwise a loop could not be named
   "space fix" without reframing the clip.

   The field is stood up here rather than found on screen: the player has none of
   its own until US-01-11 adds the loop-name field. It is a fair stand-in, because
   the rule the handler applies is about what the key landed on, not about where in
   the page that thing sits. */
describe('typing rather than pressing a shortcut', () => {
  const typeInAField = (code: string) => {
    const field = document.body.appendChild(document.createElement('input'))
    const survived = fireEvent.keyDown(field, { code })

    field.remove()

    return survived
  }

  it('leaves the loop alone when space is typed', () => {
    const clip = aReadyClip({ seconds: 12 })
    clip.currentTime = 6

    typeInAField('Space')

    expect(boundary('Loop start')).toHaveAttribute('aria-valuenow', '0')
  })

  it('leaves the video where it is when f is typed', () => {
    aReadyClip({ seconds: 12 })

    typeInAField('KeyF')

    expect(
      screen.queryByRole('button', { name: 'Leave the isolated view' }),
    ).toBeNull()
  })

  /* The other half of the criterion, and the half firing nothing does not buy:
     a handler that stood down but still took the key would leave the field
     empty however carefully it did nothing else. The default has to survive for
     the character to arrive, which is what makes a loop nameable "space fix".

     Pinned here rather than left to the shape of the handler, because US-01-11
     binds `s` under the same gate and is the story most able to move a
     `preventDefault` above it. */
  it('lets the character reach the field it was typed into', () => {
    aReadyClip({ seconds: 12 })

    expect(typeInAField('Space')).toBe(true)
  })
})

/* None of the above is discoverable, and the point that space will set next is
   not something the dancer can read off the screen any other way — two presses in
   and a glance away, and which one is coming is a guess. */
describe('the hint line', () => {
  const hint = () => screen.getByRole('note', { name: 'Keyboard shortcuts' })

  it('names the keys the player answers to', () => {
    aReadyClip({ seconds: 12 })

    expect(hint()).toHaveTextContent(/space/i)
    expect(hint()).toHaveTextContent(/f\s+toggles zen mode/i)
  })

  it('says space will set A before anything has been marked', () => {
    aReadyClip({ seconds: 12 })

    expect(hint()).toHaveTextContent(/space\s+sets\s+A/i)
  })

  it('says space will set B once A is marked', () => {
    const clip = aReadyClip({ seconds: 12 })

    clip.currentTime = 6
    press('Space')

    expect(hint()).toHaveTextContent(/space\s+sets\s+B/i)
  })

  /* The keys do nothing on a clip that will not decode, so the line that offers
     them says nothing either — the region stays where it is, because the five the
     player reserves are what zen mode hides and gives back (BR-08). */
  it('offers nothing on a clip that will not decode', () => {
    const { container } = renderPlayer(getClip({ src: '/wave-practice.mp4' }))

    fireEvent.error(clipSurface(container))

    expect(hint()).toBeEmptyDOMElement()
  })
})

/* A key held rather than tapped repeats at the operating system's rate, and every
   repeat arrives as another keydown. Marking a section is one act however long the
   thumb stays down — left alone, a held space would flicker A and B against each
   other tens of times a second and land wherever the release happened to fall. */
describe('a shortcut key held down', () => {
  it('sets one loop point rather than one per repeat', () => {
    const clip = aReadyClip({ seconds: 12 })

    clip.currentTime = 6
    press('Space')
    clip.currentTime = 9
    fireEvent.keyDown(window, { code: 'Space', repeat: true })

    expect(boundary('Loop end')).toHaveAttribute('aria-valuenow', '12')
  })

  it('leaves the video alone when f repeats', () => {
    aReadyClip({ seconds: 12 })

    fireEvent.keyDown(window, { code: 'KeyF', repeat: true })

    expect(
      screen.queryByRole('button', { name: 'Leave the isolated view' }),
    ).toBeNull()
  })
})

/* UC-01 steps 17–22, and the last of the five regions US-01-05 reserved. The
   panel is where a clip's four seconds stop being framed and start being kept. */
const panel = () => within(screen.getByRole('region', { name: 'Saved loops' }))

const nameField = () => panel().getByRole('textbox', { name: 'Loop name' })

const saveControl = () => panel().getByRole('button', { name: 'Save' })

describe('the saved loops panel', () => {
  it('names itself, so the region is more than a box', () => {
    aReadyClip({ seconds: 12 })

    expect(panel().getByRole('heading')).toHaveTextContent(/saved loops/i)
  })

  it('offers a name to type and a way to save it', () => {
    aReadyClip({ seconds: 12 })

    expect(nameField()).toBeInTheDocument()
    expect(saveControl()).toBeInTheDocument()
  })

  /* BR-10: naming is optional, so the field says what the loop would be called
     if the dancer types nothing at all. */
  it('offers a name rather than leaving the field blank', () => {
    aReadyClip({ seconds: 12 })

    expect(nameField()).toHaveAttribute('placeholder', 'Loop 1')
  })

  it('says what to do rather than showing an empty box', () => {
    aReadyClip({ seconds: 12 })

    expect(panel().getByText(/drag a and b, then save/i)).toBeInTheDocument()
  })

  /* Gated exactly as the transport, the slider and the stepper already are. A
     clip that will not decode has no loop to keep, and a Save button over it
     would be the dead control US-01-07 refused to draw. The heading stays,
     because the five regions are hidden and given back rather than built and
     torn down (BR-08). */
  it('offers nothing to save on a clip that will not decode', () => {
    const { container } = renderPlayer(getClip({ src: '/wave-practice.mp4' }))

    fireEvent.error(clipSurface(container))

    expect(panel().getByRole('heading')).toHaveTextContent(/saved loops/i)
    expect(panel().queryByRole('textbox')).toBeNull()
    expect(panel().queryByRole('button')).toBeNull()
  })
})

/* What each entry says, read off the control that recalls it rather than off the
   row — the row also holds the × that removes it, and a list of loops is not the
   place to be asserting on that glyph. The empty-state row has no control at all,
   so it drops out and an empty list reads as empty. */
const savedEntries = () =>
  panel()
    .queryAllByRole('listitem')
    .flatMap((entry) => within(entry).queryAllByRole('button').slice(0, 1))
    .map((recall) => recall.textContent?.trim())

/* UC-01 steps 18–19. BR-09: what gets kept is the name, A, B *and* the speed —
   the tempo is part of the loop rather than a setting that happens to be on. */
describe('saving a loop', () => {
  it('keeps it under the name that was offered, when none was typed', async () => {
    aReadyClip({ seconds: 12 })

    await userEvent.click(saveControl())

    expect(savedEntries()).toEqual(['Loop 10:00 - 0:12 · 1x'])
  })

  it('keeps it under the name the dancer typed', async () => {
    aReadyClip({ seconds: 12 })

    await userEvent.type(nameField(), 'chasse')
    await userEvent.click(saveControl())

    expect(savedEntries()).toEqual(['chasse0:00 - 0:12 · 1x'])
  })

  it('keeps the section actually framed, not the whole clip', async () => {
    const clip = aReadyClip({ seconds: 12 })

    clip.currentTime = 3
    press('Space')
    clip.currentTime = 7
    press('Space')
    await userEvent.click(saveControl())

    expect(savedEntries()).toEqual(['Loop 10:03 - 0:07 · 1x'])
  })

  it('keeps the tempo it was learned at, not the one it opened at', async () => {
    aReadyClip({ seconds: 12 })

    await userEvent.click(screen.getByRole('button', { name: 'Much slower' }))
    await userEvent.click(saveControl())

    expect(savedEntries()).toEqual(['Loop 10:00 - 0:12 · 0.9x'])
  })

  it('empties the field, ready for the next one', async () => {
    aReadyClip({ seconds: 12 })

    await userEvent.type(nameField(), 'chasse')
    await userEvent.click(saveControl())

    expect(nameField()).toHaveValue('')
  })

  it('offers the next number once one is taken', async () => {
    aReadyClip({ seconds: 12 })

    await userEvent.click(saveControl())

    expect(nameField()).toHaveAttribute('placeholder', 'Loop 2')
  })

  it('keeps each loop rather than replacing the last', async () => {
    aReadyClip({ seconds: 12 })

    await userEvent.click(saveControl())
    await userEvent.click(saveControl())

    expect(savedEntries()).toEqual([
      'Loop 10:00 - 0:12 · 1x',
      'Loop 20:00 - 0:12 · 1x',
    ])
  })

  /* BR-10 again: the offered name is what an empty field means, and a field
     holding only spaces is empty in every sense the dancer intends. */
  it('takes the offered name when the field holds only spaces', async () => {
    aReadyClip({ seconds: 12 })

    await userEvent.type(nameField(), '   ')
    await userEvent.click(saveControl())

    expect(savedEntries()).toEqual(['Loop 10:00 - 0:12 · 1x'])
  })
})

/* A preview of the entry that a Save would add, in the same words it will read
   in — so the dancer confirms what they framed before it joins the list rather
   than after. */
describe('the line beneath the name field', () => {
  it('says what a save would keep', () => {
    aReadyClip({ seconds: 12 })

    expect(panel().getByText(/^saves 0:00 - 0:12 · 1x$/)).toBeInTheDocument()
  })

  it('follows the loop as it is framed', () => {
    const clip = aReadyClip({ seconds: 12 })

    clip.currentTime = 3
    press('Space')
    clip.currentTime = 7
    press('Space')

    expect(panel().getByText(/^saves 0:03 - 0:07 · 1x$/)).toBeInTheDocument()
  })

  it('follows the tempo as it is slowed', async () => {
    aReadyClip({ seconds: 12 })

    await userEvent.click(screen.getByRole('button', { name: 'Much slower' }))

    expect(panel().getByText(/^saves 0:00 - 0:12 · 0.9x$/)).toBeInTheDocument()
  })
})

/* BR-04. Between space setting A and space setting B, B is still parked at the
   end of the clip — so a save would keep something nobody chose. The refusal is
   one guard read by every route in, which is why the button being disabled and
   the key doing nothing can never disagree. */
describe('a half-set loop', () => {
  it('refuses to be saved', () => {
    const clip = aReadyClip({ seconds: 12 })

    clip.currentTime = 3
    press('Space')

    expect(saveControl()).toBeDisabled()
  })

  it('says what is missing rather than what it would keep', () => {
    const clip = aReadyClip({ seconds: 12 })

    clip.currentTime = 3
    press('Space')

    expect(panel().getByText(/set b to finish the loop/i)).toBeInTheDocument()
    expect(panel().queryByText(/^saves /)).toBeNull()
  })

  it('can be saved again once B is set', () => {
    const clip = aReadyClip({ seconds: 12 })

    clip.currentTime = 3
    press('Space')
    clip.currentTime = 7
    press('Space')

    expect(saveControl()).toBeEnabled()
    expect(panel().getByText(/^saves 0:03 - 0:07 · 1x$/)).toBeInTheDocument()
  })

  /* UC-01 alternate flow 11a: dragging B by hand is the other way of finishing a
     loop space left half-set, so it lifts the refusal too. */
  it('can be saved again once B is dragged into place', () => {
    const clip = aReadyClip({ seconds: 12 })

    clip.currentTime = 3
    press('Space')
    fireEvent.keyDown(boundary('Loop end'), { key: 'ArrowLeft' })

    expect(saveControl()).toBeEnabled()
  })
})

/* An entry's accessible name is everything it says — its own name and the summary
   beneath it — so this matches the leading name rather than the whole run. The two
   are separate blocks on screen; jsdom does no layout, so nothing separates them
   here, and asserting the exact concatenation would be pinning that quirk. */
const savedLoop = (name: string) =>
  panel().getByRole('button', { name: new RegExp(`^${name}`) })

const speedShown = () => screen.getByLabelText('Playback speed').textContent

/* UC-01 step 21. BR-09's other half: the speed was saved *with* the loop, so
   recalling one has to bring the tempo back or the section is unlearnable at the
   rate it was learned at. */
describe('recalling a saved loop', () => {
  const aClipWithASlowLoopSaved = async () => {
    const clip = aReadyClip({ seconds: 12 })

    clip.currentTime = 3
    press('Space')
    clip.currentTime = 7
    press('Space')
    await userEvent.click(screen.getByRole('button', { name: 'Much slower' }))
    await userEvent.type(nameField(), 'chasse')
    await userEvent.click(saveControl())

    clip.currentTime = 0
    await userEvent.click(screen.getByRole('button', { name: 'Much faster' }))

    return clip
  }

  it('brings both boundaries back', async () => {
    await aClipWithASlowLoopSaved()

    await userEvent.click(savedLoop('chasse'))

    expect(boundary('Loop start')).toHaveAttribute('aria-valuenow', '3')
    expect(boundary('Loop end')).toHaveAttribute('aria-valuenow', '7')
  })

  it('brings the tempo back with them', async () => {
    await aClipWithASlowLoopSaved()

    await userEvent.click(savedLoop('chasse'))

    expect(speedShown()).toBe('0.9')
  })

  it('takes the loop back up rather than leaving it released', async () => {
    await aClipWithASlowLoopSaved()

    await userEvent.click(screen.getByRole('button', { name: 'LOOPING' }))
    await userEvent.click(savedLoop('chasse'))

    expect(
      screen.getByRole('button', { name: 'LOOPING' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('puts the clip at A, ready to run the section again', async () => {
    const clip = await aClipWithASlowLoopSaved()

    await userEvent.click(savedLoop('chasse'))

    expect(clip.currentTime).toBe(3)
  })

  /* A loop recalled is a whole loop, so space is armed for A again — otherwise
     the next press would move B on a section the dancer had just restored. */
  it('arms space for A, not for the B it already has', async () => {
    const clip = aReadyClip({ seconds: 12 })

    await userEvent.click(saveControl())
    clip.currentTime = 5
    press('Space')
    await userEvent.click(savedLoop('Loop 1'))

    expect(
      screen.getByRole('note', { name: 'Keyboard shortcuts' }),
    ).toHaveTextContent(/space\s+sets\s+A/i)
  })
})

const removeControl = (name: string) =>
  panel().getByRole('button', { name: `Remove ${name}` })

/* UC-01 step 22. The two controls sit side by side on one row, and the dancer is
   reaching for them with a thumb — so removing has to be its own target, not a
   corner of the one that recalls. */
describe('removing a saved loop', () => {
  const threeSaved = async () => {
    aReadyClip({ seconds: 12 })

    await userEvent.click(saveControl())
    await userEvent.click(saveControl())
    await userEvent.click(saveControl())
  }

  it('takes it out of the list', async () => {
    await threeSaved()

    await userEvent.click(removeControl('Loop 2'))

    expect(savedEntries()).toEqual([
      'Loop 10:00 - 0:12 · 1x',
      'Loop 30:00 - 0:12 · 1x',
    ])
  })

  it('frees the number for the next loop saved', async () => {
    await threeSaved()

    await userEvent.click(removeControl('Loop 1'))
    await userEvent.click(removeControl('Loop 2'))

    expect(nameField()).toHaveAttribute('placeholder', 'Loop 1')
  })

  it('is a target of its own, so tapping the loop cannot remove it', async () => {
    await threeSaved()

    await userEvent.click(savedLoop('Loop 2'))

    expect(savedEntries()).toHaveLength(3)
  })

  it('does not recall the loop it removes', async () => {
    const clip = aReadyClip({ seconds: 12 })

    clip.currentTime = 3
    press('Space')
    clip.currentTime = 7
    press('Space')
    await userEvent.click(saveControl())
    fireEvent.keyDown(boundary('Loop end'), { key: 'End' })

    await userEvent.click(removeControl('Loop 1'))

    expect(boundary('Loop end')).toHaveAttribute('aria-valuenow', '12')
  })

  it('says what to do again once the last one is gone', async () => {
    aReadyClip({ seconds: 12 })

    await userEvent.click(saveControl())
    await userEvent.click(removeControl('Loop 1'))

    expect(panel().getByText(/drag a and b, then save/i)).toBeInTheDocument()
  })
})

const markedEntries = () =>
  panel()
    .queryAllByRole('listitem')
    .flatMap((entry) => within(entry).queryAllByRole('button').slice(0, 1))
    .filter((recall) => recall.getAttribute('aria-current') === 'true')
    .map((recall) => recall.textContent?.trim())

/* UC-01 step 20. With half a dozen loops on one clip, the list says which of them
   the player is actually set to — otherwise the dancer is reading times off the
   slider and matching them by eye. Marked by value, so it is a claim about where
   they are rather than a memory of where they last tapped. */
describe('the loop currently loaded', () => {
  it('is marked as soon as it is saved', async () => {
    aReadyClip({ seconds: 12 })

    await userEvent.click(saveControl())

    expect(markedEntries()).toEqual(['Loop 10:00 - 0:12 · 1x'])
  })

  it('stops being marked once the loop is reframed', async () => {
    aReadyClip({ seconds: 12 })

    await userEvent.click(saveControl())
    fireEvent.keyDown(boundary('Loop end'), { key: 'ArrowLeft' })

    expect(markedEntries()).toEqual([])
  })

  /* BR-09 again: the speed is part of the loop, so a section at a different
     tempo is a different loop even where both boundaries agree. */
  it('stops being marked once the tempo changes', async () => {
    aReadyClip({ seconds: 12 })

    await userEvent.click(saveControl())
    await userEvent.click(screen.getByRole('button', { name: 'Much slower' }))

    expect(markedEntries()).toEqual([])
  })

  it('is marked again when it is recalled', async () => {
    const clip = aReadyClip({ seconds: 12 })

    await userEvent.click(saveControl())
    clip.currentTime = 3
    press('Space')
    clip.currentTime = 7
    press('Space')
    await userEvent.click(saveControl())
    await userEvent.click(savedLoop('Loop 1'))

    expect(markedEntries()).toEqual(['Loop 10:00 - 0:12 · 1x'])
  })

  it('marks only the one the player is set to', async () => {
    const clip = aReadyClip({ seconds: 12 })

    clip.currentTime = 3
    press('Space')
    clip.currentTime = 7
    press('Space')
    await userEvent.click(saveControl())
    fireEvent.keyDown(boundary('Loop end'), { key: 'End' })
    await userEvent.click(saveControl())

    expect(markedEntries()).toEqual(['Loop 20:03 - 0:12 · 1x'])
  })
})

/* The shortcut moved here from US-01-10 at that story's approval gate: `s` had
   nothing to call until this panel existed. It reads the same guard the button
   does, so the two cannot disagree about what a half-set loop means (BR-04). */
describe('saving with the s key', () => {
  it('keeps the loop, as the button would', () => {
    const clip = aReadyClip({ seconds: 12 })

    clip.currentTime = 3
    press('Space')
    clip.currentTime = 7
    press('Space')
    press('KeyS')

    expect(savedEntries()).toEqual(['Loop 10:03 - 0:07 · 1x'])
  })

  it('keeps it under the name the field is showing', async () => {
    aReadyClip({ seconds: 12 })

    await userEvent.type(nameField(), 'chasse')
    await userEvent.tab()
    press('KeyS')

    expect(savedEntries()).toEqual(['chasse0:00 - 0:12 · 1x'])
  })

  it('is refused on a half-set loop, exactly as the button is', () => {
    const clip = aReadyClip({ seconds: 12 })

    clip.currentTime = 3
    press('Space')
    press('KeyS')

    expect(savedEntries()).toEqual([])
  })

  /* BR-05: with the caret in the name field, `s` is a letter the dancer is
     typing. This is the first field on the player, so it is the first time the
     rule has anything to yield to. */
  it('types rather than saves while the name is being written', async () => {
    aReadyClip({ seconds: 12 })

    await userEvent.type(nameField(), 'chasse')

    expect(savedEntries()).toEqual([])
    expect(nameField()).toHaveValue('chasse')
  })

  it('saves once however long the key is held', () => {
    aReadyClip({ seconds: 12 })

    press('KeyS')
    fireEvent.keyDown(window, { code: 'KeyS', repeat: true })

    expect(savedEntries()).toEqual(['Loop 10:00 - 0:12 · 1x'])
  })

  it('does nothing on a clip that will not decode', () => {
    const { container } = renderPlayer(getClip({ src: '/wave-practice.mp4' }))

    fireEvent.error(clipSurface(container))
    press('KeyS')

    expect(panel().queryAllByRole('listitem')).toEqual([])
  })
})

/* Added at this story's approval gate. BR-05 costs something for the first time
   here: with the caret in the name box, `s` is a letter — so without Enter the
   one action that needs the field is the one the shortcut cannot finish, and
   naming a loop means typing, leaving the field, then pressing the key. */
describe('saving with Enter from the name field', () => {
  it('keeps the loop without the caret leaving the field', async () => {
    aReadyClip({ seconds: 12 })

    await userEvent.type(nameField(), 'chasse{Enter}')

    expect(savedEntries()).toEqual(['chasse0:00 - 0:12 · 1x'])
    expect(nameField()).toHaveFocus()
  })

  it('takes the offered name when nothing was typed', async () => {
    aReadyClip({ seconds: 12 })

    nameField().focus()
    await userEvent.keyboard('{Enter}')

    expect(savedEntries()).toEqual(['Loop 10:00 - 0:12 · 1x'])
  })

  it('is refused on a half-set loop, exactly as the button is', async () => {
    const clip = aReadyClip({ seconds: 12 })

    clip.currentTime = 3
    press('Space')
    await userEvent.type(nameField(), 'chasse{Enter}')

    expect(savedEntries()).toEqual([])
  })

  it('saves once however long the key is held', () => {
    aReadyClip({ seconds: 12 })

    fireEvent.keyDown(nameField(), { key: 'Enter' })
    fireEvent.keyDown(nameField(), { key: 'Enter', repeat: true })

    expect(savedEntries()).toEqual(['Loop 10:00 - 0:12 · 1x'])
  })
})

/* US-01-10 built the line with two segments and said the third would arrive with
   the panel `s` saves to. This is it — and the segment says when the key will not
   work, because a hint that keeps offering a key that does nothing is worse than
   one that admits it. */
describe('the s segment of the hint line', () => {
  const hintLine = () =>
    screen.getByRole('note', { name: 'Keyboard shortcuts' })

  it('names s among the keys the player answers to', () => {
    aReadyClip({ seconds: 12 })

    expect(hintLine()).toHaveTextContent(/s\s+saves the loop/i)
  })

  it('says B must be set first while the loop is half-set', () => {
    const clip = aReadyClip({ seconds: 12 })

    clip.currentTime = 3
    press('Space')

    expect(hintLine()).toHaveTextContent(/s\s+saves once B is set/i)
  })

  it('offers the key again once B is set', () => {
    const clip = aReadyClip({ seconds: 12 })

    clip.currentTime = 3
    press('Space')
    clip.currentTime = 7
    press('Space')

    expect(hintLine()).toHaveTextContent(/s\s+saves the loop/i)
  })
})

/* US-01-15. The panel's list is no longer something the screen keeps — it is
   what Drive holds, handed down from `App`. These are the four things that
   changes on screen. */
describe('a loop on its way to Drive', () => {
  const holdOpen = () => {
    const gate = new EventTarget()

    return {
      held: new Promise<void>((resolve) => {
        gate.addEventListener('let-go', () => resolve(), { once: true })
      }),
      letGo: () => gate.dispatchEvent(new Event('let-go')),
    }
  }

  /* Two hundred milliseconds is short, and it is not nothing — a Save that
     looked inert would be pressed twice, and the second press would save the
     same section again under the next offered name. */
  it('holds the Save while the write is in flight', async () => {
    const { held, letGo } = holdOpen()

    aReadyClip({ seconds: 12, held })

    await userEvent.click(saveControl())

    expect(saveControl()).toBeDisabled()

    letGo()
    await waitFor(() => {
      expect(saveControl()).toBeEnabled()
    })
  })

  it('refuses the s key while one is already going', async () => {
    const { held, letGo } = holdOpen()

    aReadyClip({ seconds: 12, held })

    await userEvent.click(saveControl())
    press('KeyS')

    letGo()
    await waitFor(() => {
      expect(savedEntries()).toHaveLength(1)
    })
  })

  /* The criterion the story turns on: the list means "what is in Drive", so a
     write that did not land puts nothing in it. */
  it('adds nothing to the list when the write does not land', async () => {
    aReadyClip({ seconds: 12, refuses: true })

    await userEvent.click(saveControl())

    expect(savedEntries()).toEqual([])
    expect(await screen.findByRole('alert')).toHaveTextContent(A_REFUSAL)
  })

  /* Losing the write is bad enough; losing what they called it as well would
     make the retry a re-type rather than a second press. */
  it('keeps the name that was typed, so the retry is one press', async () => {
    aReadyClip({ seconds: 12, refuses: true })

    await userEvent.type(nameField(), 'the hard bit')
    await userEvent.click(saveControl())

    expect(nameField()).toHaveValue('the hard bit')
  })
})

describe('the loops this clip already had', () => {
  it('lists what Drive was holding for it', () => {
    aReadyClip({
      seconds: 12,
      seed: {
        ...NO_LOOPS,
        clips: {
          'shuffle-drill': [getLoop({ name: 'from the laptop', a: 3, b: 7 })],
        },
      },
    })

    expect(savedEntries()).toEqual(['from the laptop0:03 - 0:07 · 1x'])
  })

  /* One file holds every clip's loops, so the panel has to take its own and
     leave the rest — which is also what stops an orphaned clip's loops from
     showing up under something else. */
  it('leaves another clip’s loops where they are', () => {
    aReadyClip({
      seconds: 12,
      seed: {
        ...NO_LOOPS,
        clips: { 'pivot-turn': [getLoop({ name: 'not this clip' })] },
      },
    })

    expect(savedEntries()).toEqual([])
  })

  /* BR-10, settled at US-01-11's gate on exactly this ground: a monotonic
     counter would reset on reload and collide with the loops Drive gave back,
     which is why the offer is the lowest unused number instead. */
  it('offers a number the restored loops have not already taken', () => {
    aReadyClip({
      seconds: 12,
      seed: {
        ...NO_LOOPS,
        clips: { 'shuffle-drill': [getLoop({ name: 'Loop 1' })] },
      },
    })

    expect(nameField()).toHaveAttribute('placeholder', 'Loop 2')
  })
})
