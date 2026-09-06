import { describe, expect, it } from 'vitest'

import { getClip } from './clip.factory'
import { adding, deleted, failed, LOADING, loaded, withLoopCounts } from './library'

describe('what the library knows before it knows anything', () => {
  /* An empty grid would otherwise mean two different things — "you have no
     clips" and "we have not looked yet" — and the screen has to say a different
     sentence for each (criterion 8). */
  it('starts out having not looked yet, which is not the same as empty', () => {
    expect(LOADING.state).toBe('loading')
  })

  it('holds no clips before it has looked', () => {
    expect(LOADING.clips).toEqual([])
  })

  it('is ready once Drive has answered, even with nothing in it', () => {
    const library = loaded(LOADING, [])

    expect(library.state).toBe('ready')
    expect(library.clips).toEqual([])
  })

  it('holds what Drive answered with', () => {
    const shuffle = getClip({ id: 'shuffle' })

    expect(loaded(LOADING, [shuffle]).clips).toEqual([shuffle])
  })

  /* The third thing an empty grid must not be allowed to mean. A library that
     could not be fetched is not a library with nothing in it, and telling the
     dancer they have no clips when their clips are simply unreachable is the
     app losing their work on their behalf. */
  it('is not ready when the fetch failed — that is not an empty library', () => {
    const library = failed(LOADING)

    expect(library.state).toBe('failed')
    expect(library.clips).toEqual([])
  })

  it('can be looked at again after a failure', () => {
    const library = loaded(failed(LOADING), [getClip()])

    expect(library.state).toBe('ready')
    expect(library.clips).toHaveLength(1)
  })
})

/* The other way a clip leaves, and the one the dancer asks for (UC-01 Q-08).
   Mechanically it is `abandoned`, but it means something else entirely: that
   one is the app retracting a tile whose upload failed, this one is a clip
   being got rid of on purpose. */
describe('a clip the dancer deleted', () => {
  const twoClips = loaded(LOADING, [
    getClip({ id: 'shuffle-drill' }),
    getClip({ id: 'pivot-turn' }),
  ])

  it('leaves the library', () => {
    expect(deleted(twoClips, 'shuffle-drill').clips.map(({ id }) => id)).toEqual([
      'pivot-turn',
    ])
  })

  it('takes nothing else with it', () => {
    const left = deleted(twoClips, 'shuffle-drill')

    expect(left.state).toBe('ready')
    expect(left.clips).toHaveLength(1)
  })

  /* A clip is only deletable once it is stored, so in practice there is no
     progress entry to drop — but leaving one behind would be a fraction
     reported against a clip that is no longer in the grid, and `uploadOf` is
     keyed on an id nothing else would ever clear. */
  it('does not leave its upload behind it', () => {
    const midUpload = adding(twoClips, getClip({ id: 'half-sent' }))

    expect(deleted(midUpload, 'half-sent').uploading).toEqual({})
  })
})

/* US-01-15. `driveClips` reads every clip out of Drive with `loops: 0`, because
   a Drive file genuinely knows nothing about loops — the count comes from
   `loops.json`, which is read separately and arrives separately. This is where
   the two are put together. */
describe('the count of loops saved against each clip', () => {
  const twoClips = loaded(LOADING, [
    getClip({ id: 'shuffle-drill' }),
    getClip({ id: 'pivot-turn' }),
  ])

  it('gives each clip the number saved against it', () => {
    const counted = withLoopCounts(twoClips, (clipId) =>
      clipId === 'shuffle-drill' ? 3 : 1,
    )

    expect(counted.clips.map(({ id, loops }) => [id, loops])).toEqual([
      ['shuffle-drill', 3],
      ['pivot-turn', 1],
    ])
  })

  it('leaves everything else about the clip alone', () => {
    const clip = getClip({ id: 'shuffle-drill', name: 'Shuffle drill' })

    expect(withLoopCounts(loaded(LOADING, [clip]), () => 2).clips[0]).toEqual({
      ...clip,
      loops: 2,
    })
  })

  /* Before `loops.json` has arrived — and for a dancer who has never saved
     one — every count is zero, which is what the tile already suppresses. */
  it('counts a clip with nothing saved against it as none', () => {
    expect(withLoopCounts(twoClips, () => 0).clips.map(({ loops }) => loops)).toEqual([
      0, 0,
    ])
  })

  it('keeps the rest of the library as it found it', () => {
    const counted = withLoopCounts(twoClips, () => 1)

    expect(counted.state).toBe('ready')
    expect(counted.uploading).toEqual(twoClips.uploading)
  })
})
