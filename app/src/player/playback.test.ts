import { describe, expect, it } from 'vitest'

import { decoded, undecodable } from './playback'

const A_TWELVE_SECOND_CLIP = 12

describe('the state a clip opens in', () => {
  it('spans the whole clip and is already looping, so play does the thing straight away', () => {
    expect(decoded(A_TWELVE_SECOND_CLIP)).toEqual({
      kind: 'ready',
      duration: A_TWELVE_SECOND_CLIP,
      loop: { a: 0, b: A_TWELVE_SECOND_CLIP },
      looping: true,
    })
  })

  /* Metadata arriving is not the same as the clip being playable: a broken file
     reports NaN, a live stream Infinity, and an empty one zero. None of the three
     can carry a loop, so each is the failure the dancer gets told about rather
     than a length to park B on. */
  it('cannot play a clip whose metadata arrived without a length to loop over', () => {
    expect(decoded(Number.NaN)).toEqual(undecodable)
    expect(decoded(Number.POSITIVE_INFINITY)).toEqual(undecodable)
    expect(decoded(0)).toEqual(undecodable)
  })
})
