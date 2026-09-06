import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { App } from './App'
import type { Clip } from './clips/clip'
import { getClip } from './clips/clip.factory'
import type { ClipCache } from './clips/clipCache'
import {
  forgetting,
  holdsNothing,
  noThumbnails,
} from './clips/clipCache.factory'
import type { ClipProbe } from './clips/clipProbe'
import type { ThumbnailCapture } from './clips/thumbnail'
import type { DriveApi } from './drive/driveApi'
import { DriveError } from './drive/driveApi'
import { aDriveApi } from './drive/driveApi.factory'
import { DriveSessionProvider } from './drive/DriveSessionProvider'
import { useDriveSession } from './drive/driveSession'
import type { TokenSource } from './drive/gisTokenSource'
import type { TokenStore } from './drive/tokenStore'
import type { SavedLoop } from './loops/loop'
import { getLoop } from './loops/loop.factory'
import { localOpenedStore } from './clips/openedStore'
import { inMemoryStorage } from './drive/keyValueStorage.factory'
import { aLoopsCache } from './loops/loopsCache.factory'
import { NO_LOOPS, serialiseLoops } from './loops/loopsFile'
import { inDocumentOrder } from './test/documentOrder'

const AN_HOUR_IN_SECONDS = 3599

/* Nothing kept between visits, so every test here starts from a clean sign-in.
   Resuming is the provider's own test's business. */
const aTokenStore = (): TokenStore => ({
  read: () => null,
  write: () => {},
  clear: () => {},
})

/* A dancer who connected on an earlier visit. Anything that reads or writes the
   library needs this: with nothing kept, the session starts signed-out, the
   library correctly settles empty without reaching Drive, and an add has
   nowhere to upload to. The Drive-status cases below deliberately keep the
   store above, because a Connect button is what they are about. */
const aConnectedStore = (): TokenStore => ({
  read: () => ({
    value: 'ya29.kept',
    expiresAt: Date.now() + AN_HOUR_IN_SECONDS * 1000,
  }),
  write: () => {},
  clear: () => {},
})

/* The library is Drive's now, so a test that wants clips in the grid puts them
   in Drive. Uploads succeed unless a case says otherwise — the failure paths
   are `useLibrary`'s own test's business. */
const driveHolding = (
  clips: readonly Clip[] = [],
  /* What `loops.json` has in it. Separate from the clips because it is a
     separate file, read separately and arriving separately — which is the
     whole reason `clip.loops` has to be put together at `App` rather than read
     off the clip listing (US-01-15). */
  loops: Record<string, readonly SavedLoop[]> = {},
): DriveApi =>
  aDriveApi({
    listClips: async () => clips,
    upload: async (_token, { file }) => ({
      id: `drive-${file.name}`,
      name: file.name,
    }),
    findJson: async () => ({ id: 'drive-loops', version: '1' }),
    readJson: async () => serialiseLoops({ ...NO_LOOPS, clips: loops }),
  })

const sourceGranting = (): TokenSource => async () => ({
  ok: true,
  grant: {
    value: 'ya29.a0-a-real-looking-access-token',
    expiresInSeconds: AN_HOUR_IN_SECONDS,
  },
})

const sourceRefusing = (): TokenSource => async () => ({
  ok: false,
  because: 'consent-refused',
})

const sourceUnreachable = (): TokenSource => async () => ({
  ok: false,
  because: 'drive-unreachable',
})

const sourceUnconfigured = (): TokenSource => async () => ({
  ok: false,
  because: 'drive-not-configured',
})

/* A token that is already stale on arrival, so a renewal can be provoked
   without winding a clock forward. */
const sourceGrantingThenRenewing = () =>
  vi
    .fn<TokenSource>()
    .mockResolvedValueOnce({
      ok: true,
      grant: { value: 'ya29.already-stale', expiresInSeconds: 0 },
    })
    .mockResolvedValueOnce({
      ok: true,
      grant: { value: 'ya29.renewed', expiresInSeconds: AN_HOUR_IN_SECONDS },
    })

/* Withdrawal is discovered by a Drive call coming back refused, and the calls
   themselves belong to US-01-14/15/16. These stand in for the ones that will. */
const ARefusedDriveCall = () => {
  const { reportConsentWithdrawn } = useDriveSession()

  return (
    <button type="button" onClick={reportConsentWithdrawn}>
      a refused Drive call
    </button>
  )
}

const ADriveCall = () => {
  const { requireToken } = useDriveSession()

  return (
    <button
      type="button"
      onClick={() => {
        void requireToken()
      }}
    >
      a Drive call
    </button>
  )
}


const renderAppAt = (
  path: string,
  tokenSource: TokenSource = sourceGranting(),
  extras: ReactNode = null,
  {
    tokenStore = aTokenStore(),
    driveApi = driveHolding(),
    openedStore = localOpenedStore(inMemoryStorage()),
  } = {},
) =>
  render(
    <DriveSessionProvider tokenSource={tokenSource} tokenStore={tokenStore}>
      <MemoryRouter initialEntries={[path]}>
        <App
          driveApi={driveApi}
          clipCache={holdsNothing}
          loopsCache={aLoopsCache()}
          openedStore={openedStore}
        />
        {extras}
      </MemoryRouter>
    </DriveSessionProvider>,
  )

/* The library lives here rather than on the Clips screen, because an added clip
   has to be reachable in the player too — so the add flow is exercised through
   the app, not through the screen. */
const renderLibraryWith = (
  probe: ClipProbe,
  driveApi = driveHolding(),
  clipCache: ClipCache = holdsNothing,
  /* Nothing captured unless a case is about stills, so an add stays an add.
     The cases that are about them hand in one that yields a frame. */
  capture: ThumbnailCapture = async () => null,
) => {
  const rendered = render(
    <DriveSessionProvider
      tokenSource={sourceGranting()}
      tokenStore={aConnectedStore()}
    >
      <MemoryRouter initialEntries={['/']}>
        <App
          probe={probe}
          driveApi={driveApi}
          clipCache={clipCache}
          loopsCache={aLoopsCache()}
          thumbnailCache={noThumbnails}
          capture={capture}
        />
      </MemoryRouter>
    </DriveSessionProvider>,
  )

  /* The grid starts out saying it is still looking (US-01-14 criterion 8), and
     an add before it has settled would be racing the listing that replaces it.
     Every case below is about what happens after the library has arrived. */
  return waitForTheLibrary().then(() => rendered)
}

const waitForTheLibrary = () =>
  waitFor(() => {
    expect(
      screen.queryByRole('status', { name: 'Clips' }),
    ).not.toBeInTheDocument()
  })

const probeReading = (seconds: number): ClipProbe => async () => ({
  ok: true,
  seconds,
  src: 'blob:the-clip-just-added',
})

/* A probe that holds every answer back until it is let go — which is what a real
   one is, for a moment, on a clip big enough to be worth adding. Gated on an
   `EventTarget` for the same reason `clipProbe.test.ts` reaches for one: it is a
   real thing that waits, rather than a stand-in that only looks like one. */
const aProbeHeldOpen = () => {
  const gate = new EventTarget()
  const held = new Promise<void>((resolve) => {
    gate.addEventListener('answer', () => resolve(), { once: true })
  })

  const probe: ClipProbe = async () => {
    await held

    return { ok: true, seconds: 26, src: 'blob:the-clip-just-added' }
  }

  return { probe, answer: () => gate.dispatchEvent(new Event('answer')) }
}

/* The mime type is load-bearing: `userEvent.upload` honours the input's
   `accept`, so a file that is not a video is silently dropped before the
   screen ever sees it — which is the restriction working, not a broken test. */
const aVideoFile = ({
  named = 'Shuffle drill.mp4',
  bytes = 26,
  lastModified = 1_756_000_000_000,
}: {
  readonly named?: string
  readonly bytes?: number
  readonly lastModified?: number
} = {}) =>
  new File([new Uint8Array(bytes)], named, {
    type: 'video/mp4',
    lastModified,
  })

const fileChooser = () => {
  const chooser = document.querySelector<HTMLInputElement>('input[type="file"]')

  if (!chooser) throw new Error('The screen offers no file chooser')

  return chooser
}

const chooseFile = async (file: File) => {
  await userEvent.upload(fileChooser(), file)
}

const tileCount = () => screen.queryAllByRole('listitem').length

/* Which ordering the accessibility tree reports as active, rather than which
   class a chip happens to carry (US-01-03). */
const pressedChips = () =>
  within(screen.getByRole('toolbar', { name: 'Order clips' }))
    .getAllByRole('button', { pressed: true })
    .map((chip) => chip.textContent)

const tileFor = (name: string) => {
  const tile = screen
    .getAllByRole('listitem')
    .find((item) => item.textContent?.includes(name))

  if (!tile) throw new Error(`No tile mentions "${name}"`)

  return tile
}

describe('the app', () => {
  it('opens on the Clips screen, with nothing in front of it', () => {
    renderAppAt('/')

    expect(screen.getByRole('heading', { name: 'Clips' })).toBeInTheDocument()
  })
})

describe('the Clips screen', () => {
  it('offers an Add clip action', () => {
    renderAppAt('/')

    expect(screen.getByRole('button', { name: 'Add clip' })).toBeInTheDocument()
  })

  it('explains that clips live in Drive and only arrive through the app', () => {
    renderAppAt('/')

    const note = screen.getByText(/clips live in google drive/i)

    expect(note).toHaveTextContent(/only sees files it uploaded itself/i)
  })

  /* Search reads before ordering, and both read before the grid they act on: you
     narrow the library, then say how what is left should be arranged. */
  it('lays the shell out heading, search, ordering, clips, then the note', () => {
    renderAppAt('/')

    const order = inDocumentOrder({
      heading: screen.getByRole('heading', { name: 'Clips' }),
      search: screen.getByRole('searchbox', { name: 'Search clips' }),
      ordering: screen.getByRole('toolbar', { name: 'Order clips' }),
      clips: screen.getByRole('list', { name: 'Clips' }),
      note: screen.getByText(/clips live in google drive/i),
    })

    expect(order).toEqual(['heading', 'search', 'ordering', 'clips', 'note'])
  })
})

describe('adding a clip', () => {
  it('takes the clip into the library under its own name and its real length', async () => {
    await renderLibraryWith(probeReading(26))

    await chooseFile(aVideoFile({ named: 'Camel walk.mp4' }))

    expect(await screen.findByText('Camel walk')).toBeInTheDocument()
    expect(tileFor('Camel walk')).toHaveTextContent('0:26')
  })

  /* Two clips added in one session share a calendar day, so **Recent** ties
     them and a stable sort falls back to arrival order (US-01-03). That makes
     this the test that can tell a prepend from an append: nothing about the
     comparator lifts the second one, only where it was put. */
  it('puts the clip just added ahead of one added moments before it', async () => {
    await renderLibraryWith(probeReading(26))

    await chooseFile(aVideoFile({ named: 'Camel walk.mp4' }))
    await screen.findByText('Camel walk')

    await chooseFile(aVideoFile({ named: 'Body roll.mp4', bytes: 30 }))
    await screen.findByText('Body roll')

    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Body roll')
  })

  it('switches back to Recent, so the new clip is where the eye already is', async () => {
    await renderLibraryWith(probeReading(26))

    await userEvent.click(screen.getByRole('button', { name: 'Name' }))
    await chooseFile(aVideoFile({ named: 'Camel walk.mp4' }))
    await screen.findByText('Camel walk')

    expect(pressedChips()).toEqual(['Recent'])
  })

  /* The same rule the ordering follows, for the same reason (US-01-18). A search
     the new clip does not match would hide it behind "no clips match" — the
     dancer would have added a clip and been told there are none. */
  it('clears the search, so the new clip is not hidden behind it', async () => {
    await renderLibraryWith(probeReading(26))

    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Search clips' }),
      'shuffle',
    )
    await chooseFile(aVideoFile({ named: 'Camel walk.mp4' }))

    expect(await screen.findByText('Camel walk')).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search clips' })).toHaveValue('')
  })

  /* The player finds a clip by id or bounces back to the grid, so "Back to
     clips" being on screen is the whole assertion: it is only reachable if the
     clip added a moment ago was in the list the player read. */
  it('opens a clip added moments ago, with no reload in between', async () => {
    await renderLibraryWith(probeReading(26))

    await chooseFile(aVideoFile({ named: 'Camel walk.mp4' }))
    await screen.findByText('Camel walk')

    await userEvent.click(within(tileFor('Camel walk')).getByRole('link'))

    expect(
      screen.getByRole('link', { name: 'Back to clips' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Camel walk')).toBeInTheDocument()
  })

  /* Backing out of the picker is not a small add, it is no add — and it must
     not cost a read of a file either. */
  it('adds nothing when the picker closes without a choice', async () => {
    const probe = vi.fn<ClipProbe>()
    await renderLibraryWith(probe)

    const before = tileCount()
    fireEvent.change(fileChooser(), { target: { files: [] } })

    expect(tileCount()).toBe(before)
    expect(probe).not.toHaveBeenCalled()
  })
})

describe('adding a clip that is already there', () => {
  it('refuses the file, and says which clip it already is', async () => {
    await renderLibraryWith(probeReading(26))

    await chooseFile(aVideoFile({ named: 'Camel walk.mp4' }))
    await screen.findByText('Camel walk')
    const before = tileCount()

    await chooseFile(aVideoFile({ named: 'Camel walk.mp4' }))

    const notice = await screen.findByRole('alert')

    expect(notice).toHaveTextContent('Camel walk')
    expect(notice).toHaveTextContent(/already/i)
    expect(tileCount()).toBe(before)
  })

  /* Name and size alone collide — the pair the mockup keys on. Last-modified is
     the field that tells a re-pick from a genuinely different clip. */
  it('takes a file that shares only a name and a size with one already there', async () => {
    await renderLibraryWith(probeReading(26))

    await chooseFile(
      aVideoFile({ named: 'Camel walk.mp4', lastModified: 1_756_000_000_000 }),
    )
    await screen.findByText('Camel walk')

    await chooseFile(
      aVideoFile({ named: 'Camel walk.mp4', lastModified: 1_756_999_999_999 }),
    )

    expect(await screen.findAllByText('Camel walk')).toHaveLength(2)
  })

  /* The refusal reads the library as it stood when the file was chosen, and a
     read still in flight has not reached it yet — so two picks of one file can
     both find it absent. What that admits is the thing this criterion exists to
     prevent: two tiles carrying the same id. Deleting one would now take both,
     since a delete addresses a clip by that id (UC-01 Q-08). */
  it('refuses the second pick while the first is still being read', async () => {
    const { probe, answer } = aProbeHeldOpen()
    await renderLibraryWith(probe)

    await chooseFile(aVideoFile({ named: 'Camel walk.mp4' }))
    await chooseFile(aVideoFile({ named: 'Camel walk.mp4' }))
    answer()

    expect(await screen.findAllByText('Camel walk')).toHaveLength(1)
  })

  it('drops the refusal once a clip does go in', async () => {
    await renderLibraryWith(probeReading(26))

    await chooseFile(aVideoFile({ named: 'Camel walk.mp4' }))
    await screen.findByText('Camel walk')
    await chooseFile(aVideoFile({ named: 'Camel walk.mp4' }))
    await screen.findByRole('alert')

    await chooseFile(aVideoFile({ named: 'Body roll.mp4', bytes: 30 }))
    await screen.findByText('Body roll')

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

/* AC 9 and AC 10 have two different triggers and one outcome, and the triggers
   are pinned where they differ — in `clipProbe.test.ts`, which has a case for
   the decode error and a case for the file that never answers. By the time the
   screen hears about it there is one trigger: the probe said no. So there is
   one test here, not two identical ones. */
describe('adding a file that yields no clip', () => {
  it('names the file, and leaves no tile behind', async () => {
    const probeFailing: ClipProbe = async () => ({ ok: false })
    await renderLibraryWith(probeFailing)

    const before = tileCount()
    await chooseFile(aVideoFile({ named: 'Camel walk.mp4' }))

    const notice = await screen.findByRole('alert')

    expect(notice).toHaveTextContent('Camel walk.mp4')
    expect(notice).not.toHaveTextContent(/already/i)
    expect(tileCount()).toBe(before)
  })
})

/* These used to lean on a seeded array. The library is Drive's now, so the clip
   being opened is one Drive lists — and it arrives asynchronously, which is why
   they wait for it rather than reading the grid on the first paint. */
describe('opening a clip', () => {
  const WAVE_PRACTICE: Clip = {
    id: 'wave-practice',
    driveId: 'drive-wave',
    name: 'Wave practice',
    added: '2026-08-21',
    seconds: 74,
    loops: 0,
  }

  const renderHolding = (path: string) =>
    renderAppAt(path, sourceGranting(), null, {
      tokenStore: aConnectedStore(),
      driveApi: driveHolding([WAVE_PRACTICE]),
    })

  it('lands on a screen built around the clip that was opened', async () => {
    renderHolding('/clip/wave-practice')

    expect(await screen.findByText('Wave practice')).toBeInTheDocument()
  })

  /* Criterion 10, through the app rather than through the hook: a clip this
     device never held, opened by its own URL. Nothing here is in hand on the
     first render — the library is still arriving — so this is the case that
     tells a screen which waits from one which merely has not bounced yet.

     The name above renders from the header whatever the surface is doing, which
     is why it cannot stand in for this. */
  it('plays a stored clip opened by its own URL, once the bytes arrive', async () => {
    const { container } = renderHolding('/clip/wave-practice')

    await screen.findByText('Wave practice')

    await waitFor(() => {
      expect(container.querySelector('video')).toHaveAttribute(
        'src',
        'blob:downloaded',
      )
    })
  })

  it('goes back to the clips from the player', async () => {
    renderHolding('/clip/wave-practice')
    await screen.findByText('Wave practice')

    await userEvent.click(screen.getByRole('link', { name: 'Back to clips' }))

    expect(screen.getByRole('heading', { name: 'Clips' })).toBeInTheDocument()
  })

  /* The bounce now waits for the library to answer, so this asserts the clip is
     genuinely absent rather than merely not here yet — which is the distinction
     the player gained in this story. */
  it('returns to the clips when the path names no clip it holds', async () => {
    renderHolding('/clip/nothing-by-this-name')

    expect(
      await screen.findByRole('heading', { name: 'Clips' }),
    ).toBeInTheDocument()
  })
})

describe('the Drive session on the Clips screen', () => {
  it('offers to connect Drive to a dancer who has not signed in', () => {
    renderAppAt('/')

    expect(
      screen.getByRole('button', { name: /connect google drive/i }),
    ).toBeInTheDocument()
  })

  it('says Drive is connected once the dancer has signed in', async () => {
    renderAppAt('/')

    await userEvent.click(
      screen.getByRole('button', { name: /connect google drive/i }),
    )

    expect(await screen.findByText(/drive is connected/i)).toBeInTheDocument()
  })

  it('says what is unavailable and why when the dancer declines', async () => {
    renderAppAt('/', sourceRefusing())

    await userEvent.click(
      screen.getByRole('button', { name: /connect google drive/i }),
    )

    const notice = await screen.findByRole('status')

    expect(notice).toHaveTextContent(/you declined/i)
    expect(notice).toHaveTextContent(/clips and saved loops/i)
  })

  it('offers sign-in again after the dancer declined, since they can change their mind', async () => {
    renderAppAt('/', sourceRefusing())

    await userEvent.click(
      screen.getByRole('button', { name: /connect google drive/i }),
    )
    await screen.findByRole('status')

    expect(
      screen.getByRole('button', { name: /connect google drive/i }),
    ).toBeInTheDocument()
  })

  it('says access was removed, not declined, when consent is withdrawn from the Google account', async () => {
    renderAppAt('/', sourceGranting(), <ARefusedDriveCall />)

    await userEvent.click(
      screen.getByRole('button', { name: /connect google drive/i }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'a refused Drive call' }),
    )

    const notice = await screen.findByRole('status')

    expect(notice).toHaveTextContent(/removed/i)
    expect(notice).not.toHaveTextContent(/you declined/i)
  })

  it('blames the sign-in service, not the dancer, when Google never loaded', async () => {
    renderAppAt('/', sourceUnreachable())

    await userEvent.click(
      screen.getByRole('button', { name: /connect google drive/i }),
    )

    const notice = await screen.findByRole('status')

    expect(notice).toHaveTextContent(/google sign-in is not available/i)
    expect(notice).not.toHaveTextContent(/you declined/i)
  })

  it('names the missing Client ID rather than implying Google is down', async () => {
    renderAppAt('/', sourceUnconfigured())

    await userEvent.click(
      screen.getByRole('button', { name: /connect google drive/i }),
    )

    const notice = await screen.findByRole('status')

    expect(notice).toHaveTextContent(/client id/i)
    expect(notice).not.toHaveTextContent(/not available right now/i)
  })

  it('tells the dancer their session renewed, so the popup that flashed is accounted for', async () => {
    renderAppAt('/', sourceGrantingThenRenewing(), <ADriveCall />)

    await userEvent.click(
      screen.getByRole('button', { name: /connect google drive/i }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'a Drive call' }))

    expect(await screen.findByRole('status')).toHaveTextContent(/renewed/i)
  })

  it('does not claim a renewal on a first sign-in, when no popup has flashed yet', async () => {
    renderAppAt('/')

    await userEvent.click(
      screen.getByRole('button', { name: /connect google drive/i }),
    )

    expect(await screen.findByRole('status')).not.toHaveTextContent(/renewed/i)
  })

  it('offers sign-in again after consent was withdrawn', async () => {
    renderAppAt('/', sourceGranting(), <ARefusedDriveCall />)

    await userEvent.click(
      screen.getByRole('button', { name: /connect google drive/i }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'a refused Drive call' }),
    )

    expect(
      await screen.findByRole('button', { name: /connect google drive/i }),
    ).toBeInTheDocument()
  })
})

/* US-01-15's last criterion, and the one that closes a gap US-01-03 shipped
   with: the Most looped chip has been sorting by a hardcoded zero since it
   landed, because `driveClips` reads every clip with `loops: 0` and nothing
   ever replaced it. The count lives in `loops.json`, which is a different file
   read at a different moment, so this is about the two being put together. */
/* UC-01 Q-08, end to end. The library lives at `App`, so this is the only place
   the whole act is visible: the tile asks, Drive is told, the grid changes. */
describe('deleting a clip', () => {
  /* Named and last-modified exactly as `aVideoFile` defaults, so this is the
     clip `clipIdFor` derives from that file — which is what makes re-adding it
     below a genuine second pick of the same file rather than a lookalike. */
  const A_SHUFFLE_FILE_IN_DRIVE = getClip({
    id: 'added-shuffle-drill-26-1756000000000',
    name: 'Shuffle drill',
    driveId: 'drive-shuffle',
  })

  const deleteTile = async (named: string) => {
    await userEvent.click(
      within(tileFor(named)).getByRole('button', { name: `Delete ${named}` }),
    )
    await userEvent.click(
      within(
        within(tileFor(named)).getByRole('group', { name: `Delete ${named}?` }),
      ).getByRole('button', { name: 'Delete' }),
    )
  }

  it('sends the clip to Drive’s bin and takes the tile with it', async () => {
    const driveApi = driveHolding([A_SHUFFLE_FILE_IN_DRIVE])
    await renderLibraryWith(probeReading(26), driveApi)

    await deleteTile('Shuffle drill')

    await waitFor(() => {
      expect(tileCount()).toBe(0)
    })
    expect(driveApi.trash).toHaveBeenCalledWith(expect.anything(), 'drive-shuffle')
  })

  it('gives the cached bytes back to the budget', async () => {
    const { cache, forgotten } = forgetting()
    await renderLibraryWith(
      probeReading(26),
      driveHolding([A_SHUFFLE_FILE_IN_DRIVE]),
      cache,
    )

    await deleteTile('Shuffle drill')

    await waitFor(() => {
      expect(forgotten()).toEqual(['added-shuffle-drill-26-1756000000000'])
    })
  })

  /* The tile does not vanish from a library that still holds it. A grid that
     disagreed with Drive would put the clip back on the next reload, and the
     dancer would have watched the app lose a clip and then un-lose it. */
  it('keeps the clip in the grid when Drive refuses, and says so', async () => {
    await renderLibraryWith(
      probeReading(26),
      aDriveApi({
        listClips: async () => [A_SHUFFLE_FILE_IN_DRIVE],
        trash: vi.fn(async () => {
          throw new Error('Drive said no')
        }),
      }),
    )

    await deleteTile('Shuffle drill')

    expect(await screen.findByRole('alert')).toHaveTextContent('Shuffle drill')
    expect(tileCount()).toBe(1)
  })

  it('answers no by leaving the clip exactly where it was', async () => {
    const driveApi = driveHolding([A_SHUFFLE_FILE_IN_DRIVE])
    await renderLibraryWith(probeReading(26), driveApi)

    await userEvent.click(
      screen.getByRole('button', { name: 'Delete Shuffle drill' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(tileCount()).toBe(1)
    expect(driveApi.trash).not.toHaveBeenCalled()
  })

  /* What US-01-04 was waiting for. Its duplicate refusal is keyed on the clips
     in the grid, so a deleted clip stops being a duplicate — which is the half
     of Q-08 that made refusing safe in the first place ("an unwanted tile would
     be permanent"). */
  it('lets the same file back in afterwards', async () => {
    await renderLibraryWith(
      probeReading(26),
      driveHolding([A_SHUFFLE_FILE_IN_DRIVE]),
    )

    await deleteTile('Shuffle drill')
    await waitFor(() => {
      expect(tileCount()).toBe(0)
    })
    await chooseFile(aVideoFile())

    expect(await screen.findByText('Shuffle drill')).toBeInTheDocument()
  })

  /* The loops are the asset and the clip is a file that can be re-uploaded, so
     the delete leaves `loops.json` alone (US-01-15 already refuses to prune
     orphans). Re-adding the same file recovers them, because `clipIdFor`
     derives the key from the file rather than from Drive. */
  it('gives the clip its saved loops back when it is added again', async () => {
    await renderLibraryWith(
      probeReading(26),
      driveHolding([A_SHUFFLE_FILE_IN_DRIVE], {
        'added-shuffle-drill-26-1756000000000': [
          getLoop({ id: 'one' }),
          getLoop({ id: 'two' }),
        ],
      }),
    )

    await deleteTile('Shuffle drill')
    await waitFor(() => {
      expect(tileCount()).toBe(0)
    })
    await chooseFile(aVideoFile())

    expect(await screen.findByText('(2)')).toBeInTheDocument()
  })
})

describe('the loops saved against each clip', () => {
  const SHUFFLE = getClip({ id: 'shuffle-drill', name: 'Shuffle drill' })
  const PIVOT = getClip({ id: 'pivot-turn', name: 'Pivot turn' })

  const twoLoops = () => [
    getLoop({ id: 'one', name: 'Loop 1' }),
    getLoop({ id: 'two', name: 'Loop 2' }),
  ]

  it('puts the real number in the tile', async () => {
    renderAppAt('/', sourceGranting(), null, {
      tokenStore: aConnectedStore(),
      driveApi: driveHolding([SHUFFLE], { 'shuffle-drill': twoLoops() }),
    })

    expect(await screen.findByText('(2)')).toBeInTheDocument()
  })

  it('says nothing at all for a clip with none', async () => {
    renderAppAt('/', sourceGranting(), null, {
      tokenStore: aConnectedStore(),
      driveApi: driveHolding([SHUFFLE], {}),
    })

    await waitForTheLibrary()

    /* No parentheses at all rather than "(0)" — the tile has suppressed a zero
       since US-01-02, and this is what that suppression is for now that the
       number is real. */
    expect(tileFor('Shuffle drill').textContent).not.toMatch(/\(\d+\)/)
  })

  it('orders by it under Most looped', async () => {
    renderAppAt('/', sourceGranting(), null, {
      tokenStore: aConnectedStore(),
      driveApi: driveHolding([SHUFFLE, PIVOT], {
        'pivot-turn': twoLoops(),
        'shuffle-drill': [getLoop()],
      }),
    })

    await screen.findByText('(2)')
    await userEvent.click(screen.getByRole('button', { name: 'Most looped' }))

    expect(
      screen.getAllByRole('listitem').map((tile) => tile.textContent),
    ).toEqual([
      expect.stringContaining('Pivot turn'),
      expect.stringContaining('Shuffle drill'),
    ])
  })
})

/* #77. A tile could only show a frame in the session that uploaded its clip,
   because `clip.src` is a url over the local file — so a reload, and the phone,
   painted grey. The still is what survives both. */
describe('the still a clip is remembered by', () => {
  const A_STILL = new Blob([new Uint8Array(31_204)], { type: 'image/jpeg' })

  const capturing: ThumbnailCapture = async () => A_STILL

  it('stores one in Drive for a clip that has just been added', async () => {
    const driveApi = driveHolding()
    await renderLibraryWith(probeReading(26), driveApi, holdsNothing, capturing)

    await chooseFile(aVideoFile())

    await waitFor(() => {
      expect(driveApi.uploadThumbnail).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ bytes: A_STILL }),
      )
    })
  })

  /* Criterion 4. The clip is what the dancer asked for; the still is a
     convenience, and a convenience that fails must not take the clip with it. */
  it('adds the clip anyway when no still can be captured from it', async () => {
    await renderLibraryWith(
      probeReading(26),
      driveHolding(),
      holdsNothing,
      async () => null,
    )

    await chooseFile(aVideoFile())

    await waitFor(() => {
      expect(tileCount()).toBe(1)
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  /* Criterion 5, and the reason the library heals rather than being migrated:
     a clip stored before #77 has no still, and making one needs its bytes —
     which the player has just fetched anyway in order to play it. */
  it('makes one for an older clip when its bytes are next in hand', async () => {
    const clip = getClip({ id: 'from-drive', driveId: 'drive-1' })
    const driveApi = driveHolding([clip])

    render(
      <DriveSessionProvider
        tokenSource={sourceGranting()}
        tokenStore={aConnectedStore()}
      >
        <MemoryRouter initialEntries={['/clip/from-drive']}>
          <App
            driveApi={driveApi}
            clipCache={holdsNothing}
            loopsCache={aLoopsCache()}
            thumbnailCache={noThumbnails}
            capture={capturing}
          />
        </MemoryRouter>
      </DriveSessionProvider>,
    )

    await waitFor(() => {
      expect(driveApi.uploadThumbnail).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ clipId: 'from-drive', bytes: A_STILL }),
      )
    })
  })

  /* #78 landed alongside this. A still left behind is a file in the dancer's
     Drive belonging to nothing — and if they ever add the same clip again, a
     frame from the copy they threw away. */
  it('goes when the clip it was taken from is deleted', async () => {
    const clip = getClip({ id: 'from-drive', driveId: 'drive-1' })
    const driveApi: DriveApi = {
      ...driveHolding([clip]),
      listThumbnails: vi.fn(async () => ({ 'from-drive': 'still-1' })),
    }

    await renderLibraryWith(probeReading(26), driveApi, holdsNothing, capturing)

    await userEvent.click(
      within(tileFor('Shuffle drill')).getByRole('button', {
        name: 'Delete Shuffle drill',
      }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(driveApi.trash).toHaveBeenCalledWith(expect.any(String), 'still-1')
    })
  })

  it('adds the clip anyway when Drive refuses to keep the still', async () => {
    const driveApi: DriveApi = {
      ...driveHolding(),
      uploadThumbnail: vi.fn(async () => {
        throw new DriveError('boom', 500)
      }),
    }

    await renderLibraryWith(probeReading(26), driveApi, holdsNothing, capturing)
    await chooseFile(aVideoFile())

    await waitFor(() => {
      expect(tileCount()).toBe(1)
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

/* #16 — the fourth chip. What it orders by is the last time the dancer opened
   the clip, which is the action a practice session is mostly made of; the
   **Last practised** chip it replaces moved only when a loop was saved or
   removed, which is rare enough that the ordering seldom changed. */
describe('ordering the grid by when each clip was last opened', () => {
  const THREE_CLIPS = [
    getClip({ id: 'newest', name: 'Newest', added: '2026-09-04' }),
    getClip({ id: 'middle', name: 'Middle', added: '2026-08-20' }),
    getClip({ id: 'oldest', name: 'Oldest', added: '2026-08-02' }),
  ]

  const renderGrid = (openedStore = localOpenedStore(inMemoryStorage())) =>
    renderAppAt('/', sourceGranting(), null, {
      tokenStore: aConnectedStore(),
      driveApi: driveHolding(THREE_CLIPS),
      openedStore,
    })

  const gridOrder = () =>
    within(screen.getByRole('list', { name: 'Clips' }))
      .getAllByRole('link')
      .map((link) => link.getAttribute('href')?.replace('/clip/', ''))

  const chip = () => screen.getByRole('button', { name: 'Last opened' })

  const openAndReturn = async (name: string) => {
    await userEvent.click(await screen.findByText(name))
    await userEvent.click(
      await screen.findByRole('link', { name: 'Back to clips' }),
    )
  }

  it('offers the chip in place of Last practised', async () => {
    renderGrid()
    await screen.findByText('Newest')

    expect(chip()).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Last practised' }),
    ).not.toBeInTheDocument()
  })

  /* The whole feature in one case: open a clip, come back, and it is top. */
  it('puts the clip just opened at the front', async () => {
    renderGrid()
    await screen.findByText('Newest')
    await userEvent.click(chip())

    await openAndReturn('Oldest')

    expect(gridOrder()[0]).toBe('oldest')
  })

  it('puts the one opened before it second', async () => {
    renderGrid()
    await screen.findByText('Newest')
    await userEvent.click(chip())

    await openAndReturn('Oldest')
    await openAndReturn('Middle')

    expect(gridOrder().slice(0, 2)).toEqual(['middle', 'oldest'])
  })

  /* Found by driving the mockup. The grid is unmounted while the player is up,
     so an ordering held on the screen itself started over at Recent on every
     return — which is the one moment this chip exists to be looked at. */
  it('is still the chosen ordering after a trip through the player', async () => {
    renderGrid()
    await screen.findByText('Newest')
    await userEvent.click(chip())

    await openAndReturn('Oldest')

    expect(chip()).toHaveAttribute('aria-pressed', 'true')
  })

  it('sorts a clip never opened below every clip that has been, and draws it', async () => {
    renderGrid()
    await screen.findByText('Newest')
    await userEvent.click(chip())

    await openAndReturn('Oldest')

    expect(gridOrder()).toHaveLength(3)
    expect(gridOrder()[0]).toBe('oldest')
  })

  /* The reason the stamp is kept on the device: an open costs Drive nothing.
     `loops.json` holds the loops, and writing it dozens of times a session for
     an ordering would put the asset in the path of an action worth nothing. */
  it('writes nothing to Drive when a clip is merely opened', async () => {
    const driveApi = driveHolding(THREE_CLIPS)

    renderAppAt('/', sourceGranting(), null, {
      tokenStore: aConnectedStore(),
      driveApi,
    })
    await screen.findByText('Newest')

    await openAndReturn('Oldest')

    expect(driveApi.writeJson).not.toHaveBeenCalled()
    expect(driveApi.createJson).not.toHaveBeenCalled()
  })

  /* Kept across a reload, which a phone gives you for free when it reclaims the
     tab — so the store is read back rather than the ordering starting over. */
  it('remembers what was opened on an earlier visit', async () => {
    const storage = inMemoryStorage()

    renderGrid(localOpenedStore(storage))
    await screen.findByText('Newest')
    await userEvent.click(chip())
    await openAndReturn('Oldest')

    /* Read back through a *second* store over the same storage, which is what a
       reload is: nothing of the first one's state survives it. */
    expect(localOpenedStore(storage).read()).toHaveProperty('oldest')
  })
})
