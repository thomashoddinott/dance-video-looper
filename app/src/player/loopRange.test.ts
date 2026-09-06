import { describe, expect, it } from 'vitest'

import type { Loop } from './playback'
import { MIN_LOOP, movedTo, timeAt, type Track } from './loopRange'

const aLoop = ({ a = 0, b = 12 }: Partial<Loop> = {}): Loop => ({ a, b })

/* The slice of a `DOMRect` the arithmetic actually needs. Taking the two numbers
   rather than the whole rect is what lets this be exercised at all: jsdom lays
   nothing out, so `getBoundingClientRect()` on a real track answers 0 for every
   field and the component could never be asked where a pointer landed. */
const aTrack = ({ left = 0, width = 200 }: Partial<Track> = {}): Track => ({
  left,
  width,
})

describe('where a pointer lands on the track', () => {
  it('reads halfway along a track as halfway through the clip', () => {
    expect(timeAt({ clientX: 100, track: aTrack(), duration: 12 })).toBe(6)
  })

  it('reads a quarter along as a quarter of the way in', () => {
    expect(timeAt({ clientX: 50, track: aTrack(), duration: 12 })).toBe(3)
  })

  /* The track is rarely at the left edge of the window — it sits inside a card,
     inside a padded main. A reading that ignored the offset would put every
     boundary later in the clip than the dancer pointed at. */
  it('measures from the track rather than from the edge of the window', () => {
    expect(
      timeAt({ clientX: 340, track: aTrack({ left: 240 }), duration: 12 }),
    ).toBe(6)
  })

  it('holds at the start of the clip when the pointer goes off the left end', () => {
    expect(timeAt({ clientX: -80, track: aTrack(), duration: 12 })).toBe(0)
  })

  it('holds at the end of the clip when the pointer goes off the right end', () => {
    expect(timeAt({ clientX: 900, track: aTrack(), duration: 12 })).toBe(12)
  })

  /* A track that has not been laid out has no width, and dividing by it gives
     Infinity — which would then be written to `currentTime` and to the loop.
     There is no position to read yet, so the honest answer is the start. */
  it('reads as the start of the clip while the track has no width', () => {
    expect(timeAt({ clientX: 100, track: aTrack({ width: 0 }), duration: 12 })).toBe(0)
  })
})

/* BR-18. Every route that moves a boundary — the drag, the arrow keys, the Home
   and End keys — comes through here, so the floor cannot be enforced in one of
   them and forgotten in another. */
describe('moving a loop boundary', () => {
  it('puts the handle where it was asked for when there is room', () => {
    expect(
      movedTo({ loop: aLoop(), handle: 'a', seconds: 3, duration: 12 }),
    ).toEqual({ a: 3, b: 12 })
  })

  it('leaves the other boundary alone', () => {
    expect(
      movedTo({ loop: aLoop({ a: 1, b: 5 }), handle: 'b', seconds: 9, duration: 12 }),
    ).toEqual({ a: 1, b: 9 })
  })

  it('stops A short of B rather than letting it pass', () => {
    expect(
      movedTo({ loop: aLoop({ a: 1, b: 5 }), handle: 'a', seconds: 11, duration: 12 }),
    ).toEqual({ a: 5 - MIN_LOOP, b: 5 })
  })

  it('stops B short of A rather than letting it pass', () => {
    expect(
      movedTo({ loop: aLoop({ a: 2, b: 5 }), handle: 'b', seconds: 0, duration: 12 }),
    ).toEqual({ a: 2, b: 2 + MIN_LOOP })
  })

  it('keeps A inside the clip', () => {
    expect(
      movedTo({ loop: aLoop(), handle: 'a', seconds: -4, duration: 12 }),
    ).toEqual({ a: 0, b: 12 })
  })

  it('keeps B inside the clip', () => {
    expect(
      movedTo({ loop: aLoop({ a: 1, b: 5 }), handle: 'b', seconds: 40, duration: 12 }),
    ).toEqual({ a: 1, b: 12 })
  })

  /* A clip shorter than the floor cannot hold a loop at all, and the clamps
     would otherwise disagree — A pushed left by B and B pushed right by A, past
     the end of the clip. The clip's own bounds win. */
  it('gives up the floor rather than the clip on a clip shorter than the floor', () => {
    expect(
      movedTo({ loop: aLoop({ a: 0, b: 0.1 }), handle: 'b', seconds: 0, duration: 0.1 }),
    ).toEqual({ a: 0, b: 0.1 })
  })
})
