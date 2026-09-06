import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import type { Clip } from './clip'
import { getClip } from './clip.factory'
import { ClipTile } from './ClipTile'

const renderTile = (
  uploading?: number,
  onDelete: (clip: Clip) => void = () => {},
) =>
  render(
    <MemoryRouter>
      <ClipTile
        clip={getClip({ id: 'shuffle-drill', name: 'Shuffle drill' })}
        uploading={uploading}
        onDelete={onDelete}
      />
    </MemoryRouter>,
  )

const A_STILL = 'blob:a-stored-still'

const renderTileShowing = ({
  thumbnail,
  src,
}: {
  readonly thumbnail?: string
  readonly src?: string
}) =>
  render(
    <MemoryRouter>
      <ClipTile
        clip={getClip({ id: 'shuffle-drill', name: 'Shuffle drill', src })}
        thumbnail={thumbnail}
        onDelete={() => {}}
      />
    </MemoryRouter>,
  )

/* The frame is decoration: the tile is already a link named for its clip, so a
   still with a name of its own would make a screen reader read the clip twice.
   Queried by tag for that reason — there is no role to ask for, and that is
   correct rather than an oversight. */
const theStill = () => document.querySelector('img')
const thePoster = () => document.querySelector('video')

const theUpload = () => screen.queryByRole('progressbar')

const theDeleteControl = () =>
  screen.queryByRole('button', { name: 'Delete Shuffle drill' })

const theQuestion = () =>
  screen.queryByRole('group', { name: 'Delete Shuffle drill?' })

describe('a tile whose clip is still going up', () => {
  it('says that it is uploading, and names the clip it means', () => {
    renderTile(0.38)

    expect(theUpload()).toHaveAccessibleName('Uploading Shuffle drill')
  })

  it('reports roughly how far along, which is all the dancer asked for', () => {
    renderTile(0.38)

    expect(theUpload()).toHaveAttribute('aria-valuenow', '38')
  })

  it('rounds rather than inventing precision nobody can act on', () => {
    renderTile(0.386_66)

    expect(theUpload()).toHaveAttribute('aria-valuenow', '39')
  })

  it('reads as a proportion, so a screen reader can say it as one', () => {
    renderTile(0.38)

    expect(theUpload()).toHaveAttribute('aria-valuemin', '0')
    expect(theUpload()).toHaveAttribute('aria-valuemax', '100')
  })

  /* The tile is playable while the bytes go up — that is the whole point of
     putting it in the grid first — so nothing about the upload may hide what
     the tile is for. */
  it('is still the clip’s tile, name and length and all', () => {
    renderTile(0.38)

    expect(screen.getByText('Shuffle drill')).toBeInTheDocument()
    expect(screen.getByText('0:26')).toBeInTheDocument()
  })

  it('is still a link into the player', () => {
    renderTile(0.38)

    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/clip/shuffle-drill',
    )
  })
})

/* UC-01 Q-08. The affordance the ticket asked for is a hover reveal, and a
   hover is the one thing half this app's devices do not have — so what these
   cases pin is the half that survives without one. Whether it fades in on
   hover is CSS, which jsdom cannot see and the smoke test can. */
describe('deleting a clip from its tile', () => {
  it('carries a delete control that says which clip it means', () => {
    renderTile()

    expect(theDeleteControl()).toBeInTheDocument()
  })

  /* Not hover-only, which is the criterion. A real button in the document is
     what a phone can tap and a keyboard can reach; a control that only exists
     under the pointer is neither. Two tabs: the tile's link, then this. */
  it('is reachable by keyboard, without a pointer going anywhere near it', async () => {
    renderTile()

    await userEvent.tab()
    await userEvent.tab()

    expect(theDeleteControl()).toHaveFocus()
  })

  it('asks before anything goes', async () => {
    const onDelete = vi.fn()
    renderTile(undefined, onDelete)

    await userEvent.click(theDeleteControl() as HTMLElement)

    expect(theQuestion()).toBeInTheDocument()
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('keeps the clip when the question is answered no', async () => {
    const onDelete = vi.fn()
    renderTile(undefined, onDelete)

    await userEvent.click(theDeleteControl() as HTMLElement)
    await userEvent.click(
      within(theQuestion() as HTMLElement).getByRole('button', { name: 'Cancel' }),
    )

    expect(theQuestion()).not.toBeInTheDocument()
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('deletes the clip when the question is answered yes', async () => {
    const onDelete = vi.fn()
    renderTile(undefined, onDelete)

    await userEvent.click(theDeleteControl() as HTMLElement)
    await userEvent.click(
      within(theQuestion() as HTMLElement).getByRole('button', { name: 'Delete' }),
    )

    expect(onDelete).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'shuffle-drill' }),
    )
  })

  /* The tile is one tap target and stays one — the rule US-01-04 established
     and `ClipsScreen` still tests. A button inside the anchor would be invalid
     markup and the router would swallow the click besides. */
  it('does not take the tile’s place as the way into the player', async () => {
    renderTile()

    await userEvent.click(theDeleteControl() as HTMLElement)

    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  /* Nothing to trash: the bytes are still going up and there is no Drive file
     yet. Cancelling an upload is a feature that does not exist, and `abandoned`
     already covers the only way this clip can currently leave. */
  it('says nothing about deleting while the clip is still going up', () => {
    renderTile(0.38)

    expect(theDeleteControl()).not.toBeInTheDocument()
  })
})

describe('a tile whose clip is stored', () => {
  /* Alive rather than an assertion about nothing: `uploading` being undefined
     is the branch this defends, and it is the state every clip listed from
     Drive arrives in. */
  it('says nothing about uploading, because it is not', () => {
    renderTile(undefined)

    expect(theUpload()).not.toBeInTheDocument()
  })

  /* All the bytes are gone but Drive has not answered yet, so the clip is not
     stored — `stored` is what clears the entry, not the last progress report.
     Hiding the bar here would show a settled tile for a clip that can still
     fail and be retracted. */
  it('still says so at a hundred percent, which is sent but not yet stored', () => {
    renderTile(1)

    expect(theUpload()).toBeInTheDocument()
  })
})

describe('the frame a tile shows', () => {
  /* #77. Before it, a tile could only show a frame in the session that
     uploaded the clip — `clip.src` is a url over the local file — so every
     reload, and every other device, painted grey. */
  it('shows the still stored for the clip', () => {
    renderTileShowing({ thumbnail: A_STILL })

    expect(theStill()).toHaveAttribute('src', A_STILL)
  })

  /* Criterion 3: nine megabytes a tile is what a grid of these would cost, and
     the whole ticket exists to not pay it. */
  it('does not reach for the clip itself to paint one', () => {
    renderTileShowing({ thumbnail: A_STILL, src: 'blob:the-whole-clip' })

    expect(thePoster()).toBeNull()
  })

  /* The seconds between an add and its still reaching Drive. The local file is
     already in hand and costs nothing, so the tile is never blank while a
     dancer watches the clip they just added. */
  it('falls back to the local file while a just-added clip has no still yet', () => {
    renderTileShowing({ src: 'blob:the-whole-clip' })

    expect(thePoster()).toHaveAttribute('src', 'blob:the-whole-clip#t=3')
  })

  /* One source failing must not take the other down with it. A still is a
     blob url over bytes this device holds, so this is close to unreachable —
     but the fallback existing is the difference between a tile that degrades
     and a tile that goes blank next to a clip it could have shown. */
  it('falls back to the local file when a stored still will not render', () => {
    renderTileShowing({ thumbnail: A_STILL, src: 'blob:the-whole-clip' })

    fireEvent.error(theStill() as HTMLElement)

    expect(thePoster()).toHaveAttribute('src', 'blob:the-whole-clip#t=3')
  })

  it('is a plain placeholder when there is neither', () => {
    renderTileShowing({})

    expect(theStill()).toBeNull()
    expect(thePoster()).toBeNull()
  })
})
