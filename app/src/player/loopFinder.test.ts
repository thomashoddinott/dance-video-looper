import { describe, expect, it } from 'vitest'

import {
  barsFrom,
  bpmOf,
  countsReached,
  groupsOf,
  pressed,
  spreadOf,
} from './loopFinder'

/* #121. The Loop Finder cuts a clip into bars from one 8 count found by hand:
   where its first 1 is, and how long it lasts. */
describe('the bars of a clip', () => {
  it('lays whole bars end to end from the first 1', () => {
    expect(barsFrom({ one: 1, length: 3.5 }, 12)).toEqual([
      { start: 1, end: 4.5 },
      { start: 4.5, end: 8 },
      { start: 8, end: 11.5 },
    ])
  })

  /* Whatever comes before the first 1, an intro or a walk-on, is not a bar. */
  it('lays none before the first 1, even where one would fit', () => {
    expect(barsFrom({ one: 5, length: 2 }, 9)[0]).toEqual({ start: 5, end: 7 })
  })

  it('leaves out a bar the clip ends part of the way through', () => {
    expect(barsFrom({ one: 0, length: 4 }, 10)).toHaveLength(2)
  })

  it('keeps a last bar that ends right on the end of the clip', () => {
    expect(barsFrom({ one: 0.5, length: 3.5 }, 7.5)).toHaveLength(2)
  })
})

describe('the bars as loops', () => {
  const bars = barsFrom({ one: 1, length: 4 }, 20)
  const groups = (joins: readonly number[], wiggle = 50) =>
    groupsOf({ bars, joins, length: 4, wiggle, duration: 20 })

  it('makes each bar a loop of its own, named by it', () => {
    expect(groups([]).map((group) => group.name)).toEqual([
      'Bar 1',
      'Bar 2',
      'Bar 3',
      'Bar 4',
    ])
  })

  /* Half the wiggle a lead-in before the bar's 1, half a run-on past the next:
     at 50%, a quarter of a bar each way, which is two counts. */
  it('reaches past each bar by the wiggle, half each way', () => {
    expect(groups([])[1]).toMatchObject({ start: 5, end: 9, a: 4, b: 10 })
  })

  it('reaches nowhere at no wiggle', () => {
    expect(groups([], 0)[1]).toMatchObject({ a: 5, b: 9 })
  })

  it('stops the reach at the ends of the clip', () => {
    expect(groups([], 200)[0]?.a).toBe(0)
    expect(groups([], 200)[3]?.b).toBe(20)
  })

  /* `joins` holds k for the line between bar k and bar k + 1, counting from 0. */
  it('makes bars joined across a line one loop, reaching past both ends', () => {
    expect(groups([1])).toHaveLength(3)
    expect(groups([1])[1]).toMatchObject({
      first: 1,
      last: 2,
      start: 5,
      end: 13,
      a: 4,
      b: 14,
      name: 'Bars 2–3',
      label: '2–3',
    })
  })

  it('joins a run of bars across several lines', () => {
    expect(groups([0, 1, 2]).map((group) => group.name)).toEqual(['Bars 1–4'])
  })
})

describe('what the wiggle reaches', () => {
  it('names the counts a whole reach takes in, either side', () => {
    expect(countsReached(50)).toEqual({ before: '7 8', after: '1 2' })
    expect(countsReached(25)).toEqual({ before: '8', after: '1' })
  })

  it('says how many counts a part-count reach is', () => {
    expect(countsReached(30)).toEqual({ before: '1.2 counts', after: '1.2 counts' })
  })

  it('says none at no wiggle', () => {
    expect(countsReached(0)).toEqual({ before: '–', after: '–' })
  })
})

describe('the tempo of an 8 count', () => {
  it('reads eight beats in its length', () => {
    expect(bpmOf(3.5)).toBe(137)
  })
})

/* Enter while the finder counts: the first press is the 1 the bars start
   from, and each after it ends an 8 count, until `over` of them are in. */
describe('a press while counting', () => {
  it('starts the count on the first press', () => {
    expect(pressed({ marks: [], over: 3, at: 2 })).toEqual([2])
  })

  it('adds each press after it', () => {
    expect(pressed({ marks: [2, 5.5], over: 3, at: 9 })).toEqual([2, 5.5, 9])
  })

  it('starts again on a press once the count is in', () => {
    expect(pressed({ marks: [2, 5.5], over: 1, at: 9 })).toEqual([9])
  })
})

describe('how far the presses strayed', () => {
  it('is the furthest any 8 count was from their average', () => {
    expect(spreadOf([1, 4.48, 8.05, 11.5], 3.5)).toBeCloseTo(0.07)
  })

  it('is nothing to say over a single 8 count', () => {
    expect(spreadOf([1, 4.5], 3.5)).toBeNull()
  })
})
