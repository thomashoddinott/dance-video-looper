import { describe, expect, it } from 'vitest'

import type { Track } from './loopRange'
import type { Loop } from './playback'
import { EDGE, ratioOf, secondsAt, type Span, spanned } from './scrubSpan'

const aLoop = ({ a = 0, b = 12 }: Partial<Loop> = {}): Loop => ({ a, b })

const aSpan = ({ from = 0, to = 12 }: Partial<Span> = {}): Span => ({ from, to })

/* The two numbers of a `DOMRect` the arithmetic reads, for `loopRange`'s reason:
   jsdom lays nothing out, so a real element answers 0 to every field and could
   never be asked where a pointer landed. */
const aTrack = ({ left = 0, width = 200 }: Partial<Track> = {}): Track => ({
  left,
  width,
})

/* The rescale, and the whole reason this bar is not the loop slider. Six seconds
   of a 2:28 clip is 4% of the width; spanning the loop instead makes the full
   width buy you the loop, so a tighter loop scrubs finer rather than coarser. */
describe('what the scrub bar spans', () => {
  it('spans A to B when a loop is armed over part of the clip', () => {
    expect(
      spanned({ loop: aLoop({ a: 3, b: 9 }), looping: true, duration: 12 }),
    ).toEqual({ from: 3, to: 9, rescaled: true })
  })

  /* The case that makes the rest of the clip reachable at all. With looping off
     there is nothing penning the playhead in, so the bar has no reason to. */
  it('spans the whole clip when looping is off', () => {
    expect(
      spanned({ loop: aLoop({ a: 3, b: 9 }), looping: false, duration: 12 }),
    ).toEqual({ from: 0, to: 12, rescaled: false })
  })

  it('spans the whole clip when the loop already is the whole clip', () => {
    expect(spanned({ loop: aLoop(), looping: true, duration: 12 })).toEqual({
      from: 0,
      to: 12,
      rescaled: false,
    })
  })

  /* Not fussiness. A and B arrive from a drag across real geometry, so B lands a
     rounding error short of the duration about half the time — and an exact
     comparison would leave the bar zoomed to 99.9% of the clip, which looks like
     a bug and scrubs like one. */
  it('counts a B a rounding error short of the end as the end', () => {
    expect(
      spanned({ loop: aLoop({ b: 12 - EDGE / 2 }), looping: true, duration: 12 }),
    ).toEqual({ from: 0, to: 12, rescaled: false })
  })

  it('counts an A a rounding error past the start as the start', () => {
    expect(
      spanned({ loop: aLoop({ a: EDGE / 2 }), looping: true, duration: 12 }),
    ).toEqual({ from: 0, to: 12, rescaled: false })
  })

  /* One end being meaningfully inside is enough to be penned in, so a loop that
     runs from the middle to the very end still rescales. Asserted because the
     natural reading — "both ends must be inside" — leaves the commonest loop of
     all, the one trimmed only at the front, unscaled. */
  it('spans a loop that reaches the end but starts well inside', () => {
    expect(
      spanned({ loop: aLoop({ a: 5, b: 12 }), looping: true, duration: 12 }),
    ).toEqual({ from: 5, to: 12, rescaled: true })
  })

  /* Before metadata there is no clip to span. Answering 0..0 rather than
     dividing by it is what keeps every ratio downstream finite. */
  it('spans nothing while the clip has no length', () => {
    expect(spanned({ loop: aLoop(), looping: true, duration: 0 })).toEqual({
      from: 0,
      to: 0,
      rescaled: false,
    })
  })

  /* A loop cannot be inverted through the slider — `movedTo` keeps B above A by
     MIN_LOOP — but `spanned` is handed a loop rather than deriving one, and a
     zero or negative span would put every ratio at infinity. */
  it('spans the whole clip rather than an inverted loop', () => {
    expect(
      spanned({ loop: aLoop({ a: 9, b: 3 }), looping: true, duration: 12 }),
    ).toEqual({ from: 0, to: 12, rescaled: false })
  })
})

/* Where the fill and the thumb are drawn. A fraction of the span rather than of
   the clip, which is what makes a rescaled bar draw the playhead in the right
   place — at A the bar is empty and at B it is full, whatever the clip's length. */
describe('where a moment sits along the bar', () => {
  it('puts the start of the span at the left end', () => {
    expect(ratioOf(3, aSpan({ from: 3, to: 9 }))).toBe(0)
  })

  it('puts the end of the span at the right end', () => {
    expect(ratioOf(9, aSpan({ from: 3, to: 9 }))).toBe(1)
  })

  it('puts the middle of the span halfway along', () => {
    expect(ratioOf(6, aSpan({ from: 3, to: 9 }))).toBe(0.5)
  })

  /* The playhead can be outside the span for a moment — the loop was just moved,
     or looping was turned on while the clip was elsewhere. It parks at the end it
     went past rather than being drawn off the bar. */
  it('holds at the left end for a moment before the span', () => {
    expect(ratioOf(1, aSpan({ from: 3, to: 9 }))).toBe(0)
  })

  it('holds at the right end for a moment after the span', () => {
    expect(ratioOf(11, aSpan({ from: 3, to: 9 }))).toBe(1)
  })

  it('sits at the left end while the span has no width', () => {
    expect(ratioOf(4, aSpan({ from: 0, to: 0 }))).toBe(0)
  })
})

/* The same mapping read the other way: a pointer on the bar is a moment in the
   span. Both directions live together because they are one relationship, and
   splitting them is how they come to disagree. */
describe('where a pointer on the bar lands in the clip', () => {
  it('reads halfway along the bar as the middle of the span', () => {
    expect(secondsAt({ clientX: 100, track: aTrack(), span: aSpan({ from: 3, to: 9 }) })).toBe(6)
  })

  /* The rescale, stated as arithmetic: the same pixel is a different moment
     depending on what the bar spans. Halfway along a bar spanning a 6-second loop
     inside a 2:28 clip is 25s of clip, not 74s. */
  it('reads the same pixel differently once the bar spans a loop', () => {
    expect(secondsAt({ clientX: 100, track: aTrack(), span: aSpan({ to: 148 }) })).toBe(74)
    expect(
      secondsAt({ clientX: 100, track: aTrack(), span: aSpan({ from: 22, to: 28 }) }),
    ).toBe(25)
  })

  /* The bar is inside a video, inside a card, inside a padded main. A reading
     that ignored the offset would land later in the clip than the dancer touched. */
  it('measures from the bar rather than from the edge of the window', () => {
    expect(
      secondsAt({ clientX: 340, track: aTrack({ left: 240 }), span: aSpan({ from: 3, to: 9 }) }),
    ).toBe(6)
  })

  it('holds at the start of the span when the drag goes off the left end', () => {
    expect(
      secondsAt({ clientX: -80, track: aTrack(), span: aSpan({ from: 3, to: 9 }) }),
    ).toBe(3)
  })

  /* Criterion four, as arithmetic: dragging end to end travels exactly the loop
     and no further. There is nothing to clamp against — a ratio cannot leave
     0..1, so the span's own ends are the only places a drag can reach. */
  it('holds at the end of the span when the drag goes off the right end', () => {
    expect(
      secondsAt({ clientX: 900, track: aTrack(), span: aSpan({ from: 3, to: 9 }) }),
    ).toBe(9)
  })

  it('reads as the start of the span while the bar has no width', () => {
    expect(
      secondsAt({ clientX: 100, track: aTrack({ width: 0 }), span: aSpan({ from: 3, to: 9 }) }),
    ).toBe(3)
  })
})
