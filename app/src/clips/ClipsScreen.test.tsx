import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { DriveSessionProvider } from '../drive/DriveSessionProvider'
import type { TokenSource } from '../drive/gisTokenSource'
import type { TokenStore } from '../drive/tokenStore'
import type { Clip } from './clip'
import { getClip } from './clip.factory'
import type { ClipProbe } from './clipProbe'
import { ClipsScreen } from './ClipsScreen'
import type { Library } from './library'
import { LOADING, failed, loaded } from './library'
import type { OrderingId } from './ordering'
import { orderings } from './ordering'

/* The screen carries the Drive status footer (US-01-13), and the session
   deliberately throws rather than degrading when there is no provider above it.
   Nothing in this file is about Drive: these two stand the context up and do
   nothing else, so the grid is tested with the footer inert beside it. */
const anUnconfiguredDrive: TokenSource = async () => ({
  ok: false,
  because: 'drive-not-configured',
})

const anEmptyTokenStore: TokenStore = {
  read: () => null,
  write: () => {},
  clear: () => {},
}

/* Nothing in this file adds a clip: the library lives in `App`, so the add flow
   is exercised there. These two stand the props up and are never reached. */
const noClipIsAdded = () => {}
const noFileIsProbed: ClipProbe = async () => ({ ok: false })
const noClipIsDeleted = () => {}

/* The ordering belongs to the caller now (#16), because the real one has to
   outlive this screen being unmounted for the player. Here the caller is this
   wrapper, so the chips still switch for real and the cases below are unchanged
   by the move.

   It takes the library whole rather than the clips in it, because `renderScreen`
   below builds a `ready` one by construction — and the two states that carry no
   clips for a reason of their own, not looked yet and looked and could not, are
   only reachable past it. */
function ScreenUnderTest({
  library,
  onDelete,
}: {
  readonly library: Library
  readonly onDelete: (clip: Clip) => void
}) {
  const [ordering, setOrdering] = useState<OrderingId>(orderings[0].id)

  return (
    <ClipsScreen
      library={library}
      ordering={ordering}
      onOrderingChange={setOrdering}
      onAdd={noClipIsAdded}
      onDelete={onDelete}
      probe={noFileIsProbed}
    />
  )
}

const renderScreenWith = (
  library: Library,
  onDelete: (clip: Clip) => void = noClipIsDeleted,
) =>
  render(
    <DriveSessionProvider
      tokenSource={anUnconfiguredDrive}
      tokenStore={anEmptyTokenStore}
    >
      <MemoryRouter>
        <ScreenUnderTest library={library} onDelete={onDelete} />
      </MemoryRouter>
    </DriveSessionProvider>,
  )

const renderScreen = (
  clips: readonly Clip[],
  onDelete: (clip: Clip) => void = noClipIsDeleted,
) => renderScreenWith(loaded(LOADING, clips), onDelete)

/* A tile's identity is the clip it is about, and `listitem` takes no name from
   its contents, so the lookup is "the tile that mentions this clip". */
const tileFor = (name: string) => {
  const tile = screen
    .getAllByRole('listitem')
    .find((item) => item.textContent?.includes(name))

  if (!tile) throw new Error(`No tile mentions "${name}"`)

  return tile
}

/* The poster is decorative — everything it conveys is written beside it — so it
   carries no accessible name to query by. What it *is* is the medium: a drawn
   poster is a video element, and a placeholder is the absence of one. */
const posterOf = (tile: HTMLElement) => tile.querySelector('video')

describe('the clips grid', () => {
  it('shows nothing to a dancer who has added no clips', () => {
    renderScreen([])

    expect(screen.getByRole('list', { name: 'Clips' })).toBeEmptyDOMElement()
  })

  it('draws one tile per clip', () => {
    renderScreen([
      getClip({ id: 'one', name: 'Shuffle drill' }),
      getClip({ id: 'two', name: 'Wave practice' }),
    ])

    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('names each clip on its own tile', () => {
    renderScreen([
      getClip({ id: 'one', name: 'Shuffle drill' }),
      getClip({ id: 'two', name: 'Wave practice' }),
    ])

    expect(tileFor('Shuffle drill')).toBeInTheDocument()
    expect(tileFor('Wave practice')).toBeInTheDocument()
  })

  it('dates each clip by the day it was added', () => {
    renderScreen([getClip({ name: 'Shuffle drill', added: '2026-08-12' })])

    expect(within(tileFor('Shuffle drill')).getByText('12 Aug')).toBeInTheDocument()
  })

  it('shows how long a clip runs', () => {
    renderScreen([getClip({ name: 'Shuffle drill', seconds: 26 })])

    expect(within(tileFor('Shuffle drill')).getByText('0:26')).toBeInTheDocument()
  })

  it('reads a clip over a minute long as a clock, not as seconds', () => {
    renderScreen([getClip({ name: 'Shuffle drill', seconds: 65 })])

    expect(within(tileFor('Shuffle drill')).getByText('1:05')).toBeInTheDocument()
  })

  it('sends the dancer to a clip of its own when a tile is tapped', () => {
    renderScreen([getClip({ id: 'shuffle-drill', name: 'Shuffle drill' })])

    expect(within(tileFor('Shuffle drill')).getByRole('link')).toHaveAttribute(
      'href',
      '/clip/shuffle-drill',
    )
  })

  /* "Taps anywhere on it" — the poster and the caption are one target, not a
     name that happens to be clickable. */
  it('makes the whole tile the tap target, not just the clip name', () => {
    renderScreen([
      getClip({ name: 'Shuffle drill', seconds: 26, added: '2026-08-12' }),
    ])

    const link = within(tileFor('Shuffle drill')).getByRole('link')

    expect(link).toHaveTextContent('0:26')
    expect(link).toHaveTextContent('12 Aug')
  })

  it('counts the loops saved against a clip', () => {
    renderScreen([getClip({ name: 'Shuffle drill', loops: 3 })])

    expect(within(tileFor('Shuffle drill')).getByText('(3)')).toBeInTheDocument()
  })

  it('counts nothing for a clip with no saved loops', () => {
    renderScreen([getClip({ name: 'Shuffle drill', loops: 0 })])

    expect(tileFor('Shuffle drill')).not.toHaveTextContent(/\(\d+\)/)
  })

  /* UC-01 exception 6a: a clip whose metadata never arrives has no length to
     show. A wrong number is worse than none, and NaN:NaN is the wrongest. */
  it('shows no duration at all for a clip whose length is unknown', () => {
    renderScreen([getClip({ name: 'Shuffle drill', seconds: undefined })])

    const tile = tileFor('Shuffle drill')

    expect(within(tile).queryByText(/^\d+:\d{2}$/)).not.toBeInTheDocument()
    expect(tile).not.toHaveTextContent('NaN')
  })

  it('draws a poster from the clip it has one for', () => {
    renderScreen([getClip({ name: 'Shuffle drill', src: 'blob:shuffle' })])

    expect(posterOf(tileFor('Shuffle drill'))).not.toBeNull()
  })

  it('stands a placeholder in for a clip with no poster to draw', () => {
    renderScreen([
      getClip({ id: 'shuffle-drill', name: 'Shuffle drill', src: undefined }),
    ])

    const tile = tileFor('Shuffle drill')

    expect(posterOf(tile)).toBeNull()
    expect(tile).not.toHaveTextContent('shuffle-drill')
  })

  /* The mockup only covers the clip that never had a poster. A clip that has one
     and cannot decode it is the same blank box to the dancer. */
  it('stands the same placeholder in when a poster fails to load', () => {
    renderScreen([getClip({ name: 'Shuffle drill', src: 'blob:broken' })])

    const poster = posterOf(tileFor('Shuffle drill'))
    if (!poster) throw new Error('expected a poster to fail')

    fireEvent.error(poster)

    expect(posterOf(tileFor('Shuffle drill'))).toBeNull()
  })

  /* The stored date is a calendar day, not an instant. Formatting it in the
     viewer's zone slides it backwards anywhere west of UTC, so a clip added on
     the 12th reads as the 11th in New York. */
  it('dates a clip by the day it was added wherever it is read', () => {
    renderScreen([getClip({ name: 'Shuffle drill', added: '2026-01-01' })])

    expect(within(tileFor('Shuffle drill')).getByText('1 Jan')).toBeInTheDocument()
  })
})

const chips = () =>
  within(screen.getByRole('toolbar', { name: 'Order clips' })).getAllByRole(
    'button',
  )

/* Which chips the accessibility tree reports as active — so "exactly one" is a
   property of the list, not of a class attribute nobody but a stylesheet reads. */
const pressedChips = () =>
  within(screen.getByRole('toolbar', { name: 'Order clips' }))
    .getAllByRole('button', { pressed: true })
    .map((chip) => chip.textContent)

/* The grid as it is drawn, named by clip. A tile's route is the only thing on it
   guaranteed unique to the clip — two clips may share a name, a date or a length. */
const gridOrder = () =>
  screen
    .getAllByRole('link')
    .map((link) => link.getAttribute('href')?.replace('/clip/', ''))

describe('the ordering chips', () => {
  it('offers the four orderings, in the order the dancer reads them', () => {
    renderScreen([])

    expect(chips().map((chip) => chip.textContent)).toEqual([
      'Recent',
      'Name',
      'Most looped',
      'Last opened',
    ])
  })

  it('starts on Recent, before the dancer has chosen anything', () => {
    renderScreen([])

    expect(pressedChips()).toEqual(['Recent'])
  })

  it('moves the active state to whichever chip is chosen', async () => {
    renderScreen([])

    await userEvent.click(screen.getByRole('button', { name: 'Name' }))

    expect(pressedChips()).toEqual(['Name'])
  })

  it('draws the newest clip first, before the dancer has chosen anything', () => {
    renderScreen([
      getClip({ id: 'middle', added: '2026-08-14' }),
      getClip({ id: 'oldest', added: '2026-07-30' }),
      getClip({ id: 'newest', added: '2026-08-28' }),
    ])

    expect(gridOrder()).toEqual(['newest', 'middle', 'oldest'])
  })

  it('draws the clips alphabetically when Name is chosen', async () => {
    renderScreen([
      getClip({ id: 'wave', name: 'Wave practice' }),
      getClip({ id: 'footwork', name: 'Footwork 8-count' }),
      getClip({ id: 'shuffle', name: 'Shuffle drill' }),
    ])

    await userEvent.click(screen.getByRole('button', { name: 'Name' }))

    expect(gridOrder()).toEqual(['footwork', 'shuffle', 'wave'])
  })

  it('draws the most-looped clip first when Most looped is chosen', async () => {
    renderScreen([
      getClip({ id: 'some', loops: 3 }),
      getClip({ id: 'none', loops: 0 }),
      getClip({ id: 'many', loops: 12 }),
    ])

    await userEvent.click(screen.getByRole('button', { name: 'Most looped' }))

    expect(gridOrder()).toEqual(['many', 'some', 'none'])
  })

  /* Ties are ordinary here, not edge cases: `added` is a calendar day, so a
     session's worth of clips ties under Recent, and a real library is mostly
     clips not yet worked on, so the whole zero tail ties under Most looped.

     The names and dates below run counter to arrival order on purpose. A
     secondary sort key — the thing this story decided against — would reorder
     these and fail. */
  it('leaves clips added on the same day in the order they arrived', () => {
    renderScreen([
      getClip({ id: 'first', added: '2026-08-28', name: 'Camel walk' }),
      getClip({ id: 'second', added: '2026-08-28', name: 'Body roll' }),
      getClip({ id: 'third', added: '2026-08-28', name: 'Arm wave' }),
    ])

    expect(gridOrder()).toEqual(['first', 'second', 'third'])
  })

  it('leaves clips with the same loop count in the order they arrived', async () => {
    renderScreen([
      getClip({ id: 'first', loops: 0, added: '2026-07-30' }),
      getClip({ id: 'second', loops: 0, added: '2026-08-14' }),
      getClip({ id: 'third', loops: 0, added: '2026-08-28' }),
    ])

    await userEvent.click(screen.getByRole('button', { name: 'Most looped' }))

    expect(gridOrder()).toEqual(['first', 'second', 'third'])
  })

  /* #12. **Recent** is the day a clip was uploaded and never changes again, so
     a clip added in July and drilled last night sorts below six that were added
     and never opened. This is the chip that answers "what am I working on". */
  it('draws the most recently opened clip first when Last opened is chosen', async () => {
    renderScreen([
      getClip({ id: 'yesterday', opened: '2026-09-05T20:00:00.000Z' }),
      getClip({ id: 'just-now', opened: '2026-09-06T18:04:11.000Z' }),
      getClip({ id: 'last-week', opened: '2026-08-30T09:15:00.000Z' }),
    ])

    await userEvent.click(screen.getByRole('button', { name: 'Last opened' }))

    expect(gridOrder()).toEqual(['just-now', 'yesterday', 'last-week'])
  })

  /* Most of a real library, and both halves of this matter. They sort last,
     because never opened is not opened at the beginning of time. And they
     are still drawn — a clip that fell out of the grid under one chip would
     read as a clip that had been deleted. */
  it('sorts the never-opened below every clip that has been, and draws them all', async () => {
    renderScreen([
      getClip({ id: 'never' }),
      getClip({ id: 'worked-on', opened: '2026-08-30T09:15:00.000Z' }),
      getClip({ id: 'never-either' }),
    ])

    await userEvent.click(screen.getByRole('button', { name: 'Last opened' }))

    expect(gridOrder()).toEqual(['worked-on', 'never', 'never-either'])
  })

  it('leaves clips opened at the same moment in the order they arrived', async () => {
    const at = '2026-09-06T18:04:11.000Z'

    renderScreen([
      getClip({ id: 'first', opened: at, name: 'Camel walk' }),
      getClip({ id: 'second', opened: at, name: 'Body roll' }),
      getClip({ id: 'third', opened: at, name: 'Arm wave' }),
    ])

    await userEvent.click(screen.getByRole('button', { name: 'Last opened' }))

    expect(gridOrder()).toEqual(['first', 'second', 'third'])
  })
})

const searchBox = () => screen.getByRole('searchbox', { name: 'Search clips' })

describe('the search box', () => {
  it('offers a search box the dancer can find by name', () => {
    renderScreen([])

    expect(searchBox()).toBeInTheDocument()
  })

  it('starts empty, so the whole library is showing', () => {
    renderScreen([getClip({ id: 'one' }), getClip({ id: 'two' })])

    expect(searchBox()).toHaveValue('')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('shows only the clips whose name contains what was typed', async () => {
    renderScreen([
      getClip({ id: 'shuffle', name: 'Shuffle drill' }),
      getClip({ id: 'wave', name: 'Wave practice' }),
      getClip({ id: 'body', name: 'Body roll' }),
    ])

    await userEvent.type(searchBox(), 'wave')

    expect(gridOrder()).toEqual(['wave'])
  })

  /* No form around it and no button to press: the grid answers the keystroke.
     A submit would also reload the page, which on a static site means fetching
     the whole library again to answer a question already in memory. */
  it('narrows the grid as the text is typed, with nothing to submit', async () => {
    renderScreen([
      getClip({ id: 'wave', name: 'Wave practice' }),
      getClip({ id: 'warm', name: 'Warm up' }),
    ])

    await userEvent.type(searchBox(), 'wa')

    expect(gridOrder()).toEqual(['wave', 'warm'])

    await userEvent.type(searchBox(), 've')

    expect(gridOrder()).toEqual(['wave'])
    expect(screen.queryByRole('button', { name: /search/i })).not.toBeInTheDocument()
  })

  it('matches whatever case the text was typed in', async () => {
    renderScreen([getClip({ id: 'shuffle', name: 'Shuffle drill' })])

    await userEvent.type(searchBox(), 'SHUFFLE')

    expect(gridOrder()).toEqual(['shuffle'])
  })

  /* The space a phone keyboard adds after a finished word must not be the
     difference between finding a clip and being told there is none. */
  it('is not defeated by whitespace around the text', async () => {
    renderScreen([getClip({ id: 'shuffle', name: 'Shuffle drill' })])

    await userEvent.type(searchBox(), '  shuffle  ')

    expect(gridOrder()).toEqual(['shuffle'])
  })

  it('brings every clip back when the box is cleared', async () => {
    renderScreen([
      getClip({ id: 'shuffle', name: 'Shuffle drill' }),
      getClip({ id: 'wave', name: 'Wave practice' }),
    ])

    await userEvent.type(searchBox(), 'wave')
    await userEvent.clear(searchBox())

    expect(gridOrder()).toEqual(['shuffle', 'wave'])
  })

  /* The two controls compose in one direction: search narrows the set, the chosen
     chip orders what is left. If searching re-ordered as well, the chip the dancer
     pressed would quietly stop meaning anything. */
  it('leaves the chosen ordering in charge of what is still showing', async () => {
    renderScreen([
      getClip({ id: 'wave-practice', name: 'Wave practice', added: '2026-08-28' }),
      getClip({ id: 'arm-wave', name: 'Arm wave', added: '2026-08-14' }),
      getClip({ id: 'body-roll', name: 'Body roll', added: '2026-08-12' }),
    ])

    await userEvent.click(screen.getByRole('button', { name: 'Name' }))
    await userEvent.type(searchBox(), 'wave')

    expect(gridOrder()).toEqual(['arm-wave', 'wave-practice'])
  })

  /* An empty grid is only honest about a library that is empty. Under a search it
     would be saying "you have no clips" when the truth is "none of yours are
     called that" — the same conflation the loading and failed states already
     refuse to make (US-01-14 criterion 8). */
  it('says nothing matches, rather than showing a bare empty grid', async () => {
    renderScreen([getClip({ name: 'Shuffle drill' })])

    await userEvent.type(searchBox(), 'salsa')

    expect(screen.getByRole('list', { name: 'Clips' })).toBeEmptyDOMElement()
    expect(
      screen.getByRole('status', { name: 'Search clips' }),
    ).toHaveTextContent(/no clips match/i)
  })

  it('does not claim the library is empty, which would be a lie', async () => {
    renderScreen([getClip({ name: 'Shuffle drill' })])

    await userEvent.type(searchBox(), 'salsa')

    expect(
      screen.getByRole('status', { name: 'Search clips' }),
    ).not.toHaveTextContent(/no clips yet|you have no clips|add a clip/i)
  })

  it('says nothing of the kind while the box is empty', () => {
    renderScreen([getClip({ name: 'Shuffle drill' })])

    expect(
      screen.queryByRole('status', { name: 'Search clips' }),
    ).not.toBeInTheDocument()
  })

  /* A library with nothing in it is not a search that found nothing, and the
     footer note already explains that case. */
  it('says nothing of the kind for an empty library nobody searched', () => {
    renderScreen([])

    expect(
      screen.queryByRole('status', { name: 'Search clips' }),
    ).not.toBeInTheDocument()
  })

  /* `loading` and `failed` both hand the screen a library with no clips, for a
     reason that has nothing to do with what was typed. "No clips match" there is
     the same lie the bare empty grid was not allowed to tell, one state along:
     the library has not been read yet, or could not be read at all, and the
     screen already has an honest sentence for each. */
  it('says nothing matches only once the library has actually been read', async () => {
    renderScreenWith(LOADING)

    await userEvent.type(searchBox(), 'wave')

    expect(
      screen.queryByRole('status', { name: 'Search clips' }),
    ).not.toBeInTheDocument()
  })

  it('does not blame the search when the library could not be read', async () => {
    renderScreenWith(failed(LOADING))

    await userEvent.type(searchBox(), 'wave')

    expect(
      screen.queryByRole('status', { name: 'Search clips' }),
    ).not.toBeInTheDocument()
  })

  it('takes the line away again once the search matches something', async () => {
    renderScreen([getClip({ id: 'shuffle', name: 'Shuffle drill' })])

    await userEvent.type(searchBox(), 'salsa')
    await userEvent.clear(searchBox())
    await userEvent.type(searchBox(), 'shuffle')

    expect(
      screen.queryByRole('status', { name: 'Search clips' }),
    ).not.toBeInTheDocument()
    expect(gridOrder()).toEqual(['shuffle'])
  })

  it('keeps ordering what is left when the ordering changes mid-search', async () => {
    renderScreen([
      getClip({ id: 'wave-practice', name: 'Wave practice', added: '2026-08-28' }),
      getClip({ id: 'arm-wave', name: 'Arm wave', added: '2026-08-14' }),
    ])

    await userEvent.type(searchBox(), 'wave')
    await userEvent.click(screen.getByRole('button', { name: 'Name' }))

    expect(gridOrder()).toEqual(['arm-wave', 'wave-practice'])
  })
})

/* A file input carries no ARIA role, so there is nothing to ask the tree for —
   the same reason `posterOf` above reaches for the medium instead. */
const fileChooser = () =>
  document.querySelector<HTMLInputElement>('input[type="file"]')

describe('adding a clip', () => {
  /* What restricts the chooser is a contract with the platform, not an
     implementation detail: it is why a phone offers the camera roll rather than
     every document on it. The chooser *opening* is 👁 — no test observes an OS
     dialog. */
  it('asks for video files rather than any file at all', () => {
    renderScreen([])

    expect(fileChooser()).toHaveAttribute('accept', 'video/*')
  })
})

/* The grid holds many tiles and each asks its own question, so the thing worth
   pinning here rather than on the tile is that the answer arrives naming the
   clip whose tile was asked (UC-01 Q-08). */
describe('deleting a clip', () => {
  const deleteFrom = async (tile: HTMLElement, named: string) => {
    await userEvent.click(
      within(tile).getByRole('button', { name: `Delete ${named}` }),
    )
    await userEvent.click(
      within(within(tile).getByRole('group', { name: `Delete ${named}?` }))
        .getByRole('button', { name: 'Delete' }),
    )
  }

  it('carries the confirmed delete out, naming the clip whose tile asked', async () => {
    const onDelete = vi.fn()
    renderScreen(
      [
        getClip({ id: 'shuffle-drill', name: 'Shuffle drill' }),
        getClip({ id: 'pivot-turn', name: 'Pivot turn' }),
      ],
      onDelete,
    )

    await deleteFrom(tileFor('Pivot turn'), 'Pivot turn')

    expect(onDelete).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'pivot-turn' }),
    )
  })

  /* One tile asking is not the grid asking. The question is the tile's own
     state, so a second tile must be untouched by the first one being open. */
  it('asks on the tile that was asked, and nowhere else', async () => {
    renderScreen([
      getClip({ id: 'shuffle-drill', name: 'Shuffle drill' }),
      getClip({ id: 'pivot-turn', name: 'Pivot turn' }),
    ])

    await userEvent.click(
      within(tileFor('Pivot turn')).getByRole('button', { name: 'Delete Pivot turn' }),
    )

    expect(screen.getAllByRole('group', { name: /^Delete/ })).toHaveLength(1)
  })
})
