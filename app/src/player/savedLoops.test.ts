import { describe, expect, it } from 'vitest'

import type { SavedLoop } from '../loops/loop'
import { getLoop } from '../loops/loop.factory'
import { nextLoopName, summarise } from './savedLoops'

const named = (...names: readonly string[]): readonly SavedLoop[] =>
  names.map((name, index) => getLoop({ id: `loop-${index}`, name }))

describe('the name a loop is offered', () => {
  it('starts at one, on a clip with nothing saved yet', () => {
    expect(nextLoopName([])).toBe('Loop 1')
  })

  it('counts past the loops already saved', () => {
    expect(nextLoopName(named('Loop 1', 'Loop 2', 'Loop 3'))).toBe('Loop 4')
  })

  /* BR-10 as settled at US-01-11's approval gate. The mockup offers
     `saved.length + 1`, which after this removal would offer `Loop 3` — a name
     already on the list. */
  it('takes back a number freed by a removal, rather than colliding', () => {
    expect(nextLoopName(named('Loop 2', 'Loop 3'))).toBe('Loop 1')
  })

  it('fills a gap in the middle before counting past the end', () => {
    expect(nextLoopName(named('Loop 1', 'Loop 3'))).toBe('Loop 2')
  })

  /* Insertion order stops matching the numbers as soon as a freed one is taken
     back: delete `Loop 1`, save again, and the list reads Loop 2 then Loop 1. */
  it('counts past numbers saved out of order', () => {
    expect(nextLoopName(named('Loop 2', 'Loop 1'))).toBe('Loop 3')
  })

  /* A dancer who names their loops has not used any number, so the count starts
     where it would on an empty clip. */
  it('ignores loops the dancer named themselves', () => {
    expect(nextLoopName(named('chasse', 'the turn'))).toBe('Loop 1')
  })

  it('is not fooled by a name that merely starts with one', () => {
    expect(nextLoopName(named('Loop 1 slow', 'Loop 12'))).toBe('Loop 1')
  })
})

describe('what a loop says about itself', () => {
  it('gives its boundaries and the tempo it was learned at', () => {
    expect(summarise({ a: 3, b: 7, speed: 1 })).toBe('0:03 - 0:07 · 1x')
  })

  it('carries the speed even where it is not the ordinary one', () => {
    expect(summarise({ a: 3, b: 7, speed: 0.5 })).toBe('0:03 - 0:07 · 0.5x')
  })

  /* The same formatter the clip tiles print and the slider announces through
     `aria-valuetext`, so a minute reads the same way wherever it is met. */
  it('writes a long clip in minutes, as the rest of the app does', () => {
    expect(summarise({ a: 62, b: 185, speed: 1 })).toBe('1:02 - 3:05 · 1x')
  })
})
