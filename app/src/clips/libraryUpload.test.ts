import { describe, expect, it } from 'vitest'

import { getClip } from './clip.factory'
import {
  abandoned,
  adding,
  LOADING,
  loaded,
  progressed,
  stored,
  uploadOf,
} from './library'

const aLibraryOf = (...clips: readonly ReturnType<typeof getClip>[]) =>
  loaded(LOADING, clips)

const JUST_ADDED = getClip({
  id: 'added-shuffle',
  name: 'Shuffle drill',
  src: 'blob:shuffle',
})

describe('a clip that is being uploaded', () => {
  /* US-01-04 put it first in the grid and #60 merged that. The upload runs
     behind the tile rather than in front of it, so nothing here may move it. */
  it('is in the grid the moment it is added, before any byte has gone', () => {
    const library = adding(aLibraryOf(getClip({ id: 'older' })), JUST_ADDED)

    expect(library.clips.map(({ id }) => id)).toEqual([
      'added-shuffle',
      'older',
    ])
  })

  it('is uploading, and has got nowhere yet', () => {
    const library = adding(aLibraryOf(), JUST_ADDED)

    expect(uploadOf(library, 'added-shuffle')).toBe(0)
  })

  it('shows how far along it is as the bytes go', () => {
    const library = progressed(
      adding(aLibraryOf(), JUST_ADDED),
      'added-shuffle',
      4_892_022,
      9_784_045,
    )

    expect(uploadOf(library, 'added-shuffle')).toBeCloseTo(0.5)
  })

  it('is not uploading at all once it is stored', () => {
    const library = stored(
      adding(aLibraryOf(), JUST_ADDED),
      'added-shuffle',
      'drive-file-id',
    )

    expect(uploadOf(library, 'added-shuffle')).toBeUndefined()
  })

  it('carries the Drive file it was stored as, which is what a download needs', () => {
    const library = stored(
      adding(aLibraryOf(), JUST_ADDED),
      'added-shuffle',
      'drive-file-id',
    )

    expect(library.clips[0]?.driveId).toBe('drive-file-id')
  })

  /* Criterion 3. The bytes are already here — discarding the url to re-fetch
     what was just sent would be strictly worse, and is not what US-01-16 means
     by caching. */
  it('still plays from the file it was added from, with nothing re-downloaded', () => {
    const library = stored(
      adding(aLibraryOf(), JUST_ADDED),
      'added-shuffle',
      'drive-file-id',
    )

    expect(library.clips[0]?.src).toBe('blob:shuffle')
  })

  it('never counts as uploading when it came from Drive in the first place', () => {
    expect(uploadOf(aLibraryOf(getClip()), 'shuffle-drill')).toBeUndefined()
  })
})

describe('a clip whose upload failed', () => {
  /* Criterion 4, and the cost of putting the tile first that the approval gate
     took knowingly: a failure has to retract something already on screen. */
  it('leaves the library exactly as it was before the add', () => {
    const before = aLibraryOf(getClip({ id: 'older' }))

    const after = abandoned(adding(before, JUST_ADDED), 'added-shuffle')

    expect(after).toEqual(before)
  })

  it('is no longer uploading, since there is no longer a clip', () => {
    const library = abandoned(adding(aLibraryOf(), JUST_ADDED), 'added-shuffle')

    expect(uploadOf(library, 'added-shuffle')).toBeUndefined()
  })

  /* Progress and failure race: the bytes report one last time as the connection
     drops. Re-admitting a clip that has already been retracted would leave a
     tile nothing can remove. */
  it('stays gone when a late progress report arrives for it', () => {
    const library = progressed(
      abandoned(adding(aLibraryOf(), JUST_ADDED), 'added-shuffle'),
      'added-shuffle',
      9_784_045,
      9_784_045,
    )

    expect(library.clips).toEqual([])
    expect(uploadOf(library, 'added-shuffle')).toBeUndefined()
  })

  it('stays gone when a late success arrives for it', () => {
    const library = stored(
      abandoned(adding(aLibraryOf(), JUST_ADDED), 'added-shuffle'),
      'added-shuffle',
      'drive-file-id',
    )

    expect(library.clips).toEqual([])
  })
})
