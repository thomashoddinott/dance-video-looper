import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { DriveSessionProvider } from '../drive/DriveSessionProvider'
import type { TokenSource } from '../drive/gisTokenSource'
import type { TokenStore } from '../drive/tokenStore'
import { getClip } from './clip.factory'
import type { ClipProbe } from './clipProbe'
import { ClipsScreen } from './ClipsScreen'
import type { Library } from './library'
import { adding, failed, LOADING, loaded } from './library'

const anUnconfiguredDrive: TokenSource = async () => ({
  ok: false,
  because: 'drive-not-configured',
})

const anEmptyTokenStore: TokenStore = {
  read: () => null,
  write: () => {},
  clear: () => {},
}

const noClipIsAdded = () => {}
const noFileIsProbed: ClipProbe = async () => ({ ok: false })
const noClipIsDeleted = () => {}

const renderLibrary = (library: Library) =>
  render(
    <DriveSessionProvider
      tokenSource={anUnconfiguredDrive}
      tokenStore={anEmptyTokenStore}
    >
      <MemoryRouter>
        <ClipsScreen
          library={library}
          onAdd={noClipIsAdded}
          onDelete={noClipIsDeleted}
          probe={noFileIsProbed}
        />
      </MemoryRouter>
    </DriveSessionProvider>,
  )

const theGrid = () => screen.getByRole('list', { name: 'Clips' })
const tiles = () => screen.queryAllByRole('listitem')
const theLoadingNotice = () => screen.queryByRole('status', { name: 'Clips' })

describe('a library that has not arrived yet', () => {
  /* Criterion 8. Without this the empty grid says "you have no clips" to a
     dancer whose clips are three seconds away, which reads as the app having
     lost them. */
  it('says it is still looking, rather than showing an empty grid', () => {
    renderLibrary(LOADING)

    expect(theLoadingNotice()).toBeInTheDocument()
  })

  it('marks the grid busy while it looks', () => {
    renderLibrary(LOADING)

    expect(theGrid()).toHaveAttribute('aria-busy', 'true')
  })

  it('offers Add clip regardless, since that needs no library', () => {
    renderLibrary(LOADING)

    expect(screen.getByRole('button', { name: 'Add clip' })).toBeEnabled()
  })
})

describe('a library with nothing in it', () => {
  /* UC-01 alternate flow 2a, which is also what "not connected" looks like:
     nothing has been uploaded, so there is nothing to list. */
  it('shows an empty grid rather than a pretence of one', () => {
    renderLibrary(loaded(LOADING, []))

    expect(tiles()).toHaveLength(0)
  })

  it('no longer says it is looking, because it has looked', () => {
    renderLibrary(loaded(LOADING, []))

    expect(theLoadingNotice()).not.toBeInTheDocument()
  })

  it('still carries the standing note about why the grid can only fill this way', () => {
    renderLibrary(loaded(LOADING, []))

    expect(
      screen.getByText(/only sees files it uploaded itself/i),
    ).toBeInTheDocument()
  })
})

describe('a library that could not be read', () => {
  /* The third thing an empty grid must not be allowed to mean. Telling a dancer
     their clips are gone when Drive merely did not answer is the app losing
     their work on their behalf. */
  it('says so, rather than reporting an empty library', () => {
    renderLibrary(failed(LOADING))

    expect(screen.getByRole('alert')).toHaveTextContent(/could not be loaded/i)
  })

  it('does not claim to still be looking', () => {
    renderLibrary(failed(LOADING))

    expect(theLoadingNotice()).not.toBeInTheDocument()
  })
})

describe('a library holding clips', () => {
  it('draws a tile for each', () => {
    renderLibrary(
      loaded(LOADING, [getClip({ id: 'one' }), getClip({ id: 'two' })]),
    )

    expect(tiles()).toHaveLength(2)
  })

  it('shows the upload running behind a clip that has just been added', () => {
    const library = adding(loaded(LOADING, []), getClip({ name: 'Shuffle drill' }))

    renderLibrary(library)

    expect(
      screen.getByRole('progressbar', { name: 'Uploading Shuffle drill' }),
    ).toBeInTheDocument()
  })

  it('shows no upload against a clip that came from Drive', () => {
    renderLibrary(loaded(LOADING, [getClip()]))

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
})
