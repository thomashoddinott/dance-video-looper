import { describe, expect, it } from 'vitest'

import type { Loop } from './playback'
import { EDGE, spanned } from './scrubSpan'

const aLoop = ({ a = 0, b = 12 }: Partial<Loop> = {}): Loop => ({ a, b })

/* The rescale, and the whole reason this bar is not the loop slider. Six seconds
   of a 2:28 clip is 4% of the width; spanning the loop instead makes the full
   width buy you the loop, so a tighter loop scrubs finer rather than coarser. */
describe('what the scrub bar spans', () => {
  it('spans A to B when a loop is armed over part of the clip', () => {
    expect(
      spanned({ loop: aLoop({ a: 3, b: 9 }), looping: true, duration: 12 }),
    ).toEqual({ from: 3, to: 9 })
  })

  /* The case that makes the rest of the clip reachable at all. With looping off
     there is nothing penning the playhead in, so the bar has no reason to. */
  it('spans the whole clip when looping is off', () => {
    expect(
      spanned({ loop: aLoop({ a: 3, b: 9 }), looping: false, duration: 12 }),
    ).toEqual({ from: 0, to: 12 })
  })

  it('spans the whole clip when the loop already is the whole clip', () => {
    expect(spanned({ loop: aLoop(), looping: true, duration: 12 })).toEqual({
      from: 0,
      to: 12,
    })
  })

  /* Not fussiness. A and B arrive from a drag across real geometry, so B lands a
     rounding error short of the duration about half the time — and an exact
     comparison would leave the bar zoomed to 99.9% of the clip, which looks like
     a bug and scrubs like one. */
  it('counts a B a rounding error short of the end as the end', () => {
    expect(
      spanned({ loop: aLoop({ b: 12 - EDGE / 2 }), looping: true, duration: 12 }),
    ).toEqual({ from: 0, to: 12 })
  })

  it('counts an A a rounding error past the start as the start', () => {
    expect(
      spanned({ loop: aLoop({ a: EDGE / 2 }), looping: true, duration: 12 }),
    ).toEqual({ from: 0, to: 12 })
  })

  /* One end being meaningfully inside is enough to be penned in, so a loop that
     runs from the middle to the very end still rescales. Asserted because the
     natural reading — "both ends must be inside" — leaves the commonest loop of
     all, the one trimmed only at the front, unscaled. */
  it('spans a loop that reaches the end but starts well inside', () => {
    expect(
      spanned({ loop: aLoop({ a: 5, b: 12 }), looping: true, duration: 12 }),
    ).toEqual({ from: 5, to: 12 })
  })

  /* Before metadata there is no clip to span. Answering 0..0 rather than
     dividing by it is what keeps every ratio downstream finite. */
  it('spans nothing while the clip has no length', () => {
    expect(spanned({ loop: aLoop(), looping: true, duration: 0 })).toEqual({
      from: 0,
      to: 0,
    })
  })

  /* A loop cannot be inverted through the slider — `movedTo` keeps B above A by
     MIN_LOOP — but `spanned` is handed a loop rather than deriving one, and a
     zero or negative span would put every ratio at infinity. */
  it('spans the whole clip rather than an inverted loop', () => {
    expect(
      spanned({ loop: aLoop({ a: 9, b: 3 }), looping: true, duration: 12 }),
    ).toEqual({ from: 0, to: 12 })
  })
})
