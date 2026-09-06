import { describe, expect, it } from 'vitest'

import { getClip } from './clip.factory'
import { matching } from './search'

const named = (...names: readonly string[]) =>
  names.map((name) => getClip({ id: name, name }))

const namesOf = (clips: readonly { readonly name: string }[]) =>
  clips.map((clip) => clip.name)

describe('searching the clips by name', () => {
  it('keeps a clip whose name contains the text', () => {
    const clips = named('Shuffle drill', 'Wave practice')

    expect(namesOf(matching(clips, 'wave'))).toEqual(['Wave practice'])
  })

  it('drops the clips that do not contain it', () => {
    const clips = named('Shuffle drill', 'Wave practice', 'Body roll')

    expect(namesOf(matching(clips, 'roll'))).toEqual(['Body roll'])
  })

  /* A dancer types in whatever case the keyboard offers, and a filename carries
     whatever case the phone gave it. Neither is a statement about what they mean. */
  it('ignores case on both sides of the comparison', () => {
    const clips = named('Shuffle Drill')

    expect(namesOf(matching(clips, 'SHUFFLE'))).toEqual(['Shuffle Drill'])
  })

  it('matches part of a word, not only a whole one', () => {
    const clips = named('Footwork 8-count')

    expect(namesOf(matching(clips, 'otwor'))).toEqual(['Footwork 8-count'])
  })

  /* A phone keyboard adds a trailing space readily — autocorrect after a finished
     word, and the space bar sitting where a thumb rests. Untrimmed, that turns a
     match into "nothing matches", which reads as a broken feature. */
  it('is not defeated by whitespace around the text', () => {
    const clips = named('Shuffle drill')

    expect(namesOf(matching(clips, '  shuffle  '))).toEqual(['Shuffle drill'])
  })

  /* An empty box is not a search for nothing — it is no search at all. */
  it('keeps every clip when there is no text', () => {
    const clips = named('Shuffle drill', 'Wave practice')

    expect(namesOf(matching(clips, ''))).toEqual(['Shuffle drill', 'Wave practice'])
  })

  it('keeps every clip when the text is only whitespace', () => {
    const clips = named('Shuffle drill', 'Wave practice')

    expect(namesOf(matching(clips, '   '))).toEqual(['Shuffle drill', 'Wave practice'])
  })

  it('keeps nothing when no name contains the text', () => {
    const clips = named('Shuffle drill', 'Wave practice')

    expect(matching(clips, 'salsa')).toEqual([])
  })

  /* The chosen chip orders the grid, and it runs over whatever this leaves. If the
     filter reordered as well, the two controls would fight over the same result. */
  it('leaves the clips it keeps in the order they arrived', () => {
    const clips = named('Wave practice', 'Arm wave', 'Body roll')

    expect(namesOf(matching(clips, 'wave'))).toEqual(['Wave practice', 'Arm wave'])
  })

  it('hands back the clips themselves, not a summary of them', () => {
    const clip = getClip({ name: 'Shuffle drill', seconds: 26 })

    expect(matching([clip], 'shuffle')).toEqual([clip])
  })
})
