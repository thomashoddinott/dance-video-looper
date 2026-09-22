import { describe, expect, it } from 'vitest'

import type { SavedLoop } from '../loops/loop'
import { getLoop } from '../loops/loop.factory'
import { chainedSpan, inStartOrder } from './chain'

const named = (
  ...loops: readonly Partial<SavedLoop>[]
): readonly SavedLoop[] =>
  loops.map((loop, index) => getLoop({ id: `loop-${index}`, ...loop }))

const names = (loops: readonly SavedLoop[]) => loops.map((loop) => loop.name)

/* #28. The ordering the chain rests on: ticked loops have to read down the list
   as one run, and they only can if the list runs the way the clip does. */
describe('the order the loops are listed in', () => {
  it('runs the way the clip does, not the way they were saved', () => {
    const saved = named(
      { name: 'the ending', a: 18, b: 24 },
      { name: 'the opening', a: 4, b: 11 },
    )

    expect(names(inStartOrder(saved))).toEqual(['the opening', 'the ending'])
  })

  /* The case that sends a dancer back to a screen they have already learned:
     a section framed after the others, but belonging in the middle of them. */
  it('slots a loop saved last into the place it belongs', () => {
    const saved = named(
      { name: 'first', a: 0, b: 5 },
      { name: 'third', a: 12, b: 18 },
      { name: 'second', a: 5, b: 12 },
    )

    expect(names(inStartOrder(saved))).toEqual(['first', 'second', 'third'])
  })

  /* Two takes on the same section, one fast and one slow. Neither start can
     come first on the clock, so the tie falls back to what the dancer did. */
  it('leaves loops that start together in the order they were saved', () => {
    const saved = named(
      { name: 'up to speed', a: 4, b: 11 },
      { name: 'slowly', a: 4, b: 11 },
    )

    expect(names(inStartOrder(saved))).toEqual(['up to speed', 'slowly'])
  })

  /* `sort` orders in place, and what it would be ordering is the list the whole
     app reads — including `loops.json` on its way to Drive. */
  it('leaves the list it was given alone', () => {
    const saved = named({ name: 'later', a: 18 }, { name: 'earlier', a: 4 })

    inStartOrder(saved)

    expect(names(saved)).toEqual(['later', 'earlier'])
  })
})

/* #28: the whole point of ticking. Two sections drilled apart, run together
   without saving a third loop that duplicates them. */
describe('the loop a set of ticked loops plays as', () => {
  const saved = named(
    { id: 'first', name: 'first', a: 4, b: 11, speed: 0.8 },
    { id: 'second', name: 'second', a: 11, b: 18, speed: 1 },
    { id: 'third', name: 'third', a: 18, b: 24, speed: 0.5 },
  )

  it('is nothing at all when nothing is ticked', () => {
    expect(chainedSpan({ saved, chain: [] })).toBeNull()
  })

  it('is the loop itself when one is ticked', () => {
    expect(chainedSpan({ saved, chain: ['second'] })).toEqual({
      loop: { a: 11, b: 18 },
      speed: 1,
    })
  })

  it('runs from the first start to the last end when two are ticked', () => {
    expect(chainedSpan({ saved, chain: ['first', 'second'] })).toEqual({
      loop: { a: 4, b: 18 },
      speed: 0.8,
    })
  })

  it('takes in the third as well', () => {
    expect(chainedSpan({ saved, chain: ['first', 'second', 'third'] })).toEqual({
      loop: { a: 4, b: 24 },
      speed: 0.8,
    })
  })

  /* Which box was reached for first is not a fact about the clip. */
  it('does not care which order they were ticked in', () => {
    expect(chainedSpan({ saved, chain: ['third', 'first'] })).toEqual({
      loop: { a: 4, b: 24 },
      speed: 0.8,
    })
  })

  /* BR-09 says the tempo is part of the loop. A chain is one loop, so it can
     only carry one tempo, and the one to carry is where the run begins. */
  it('runs at the tempo of the loop it starts from', () => {
    expect(chainedSpan({ saved, chain: ['third', 'second'] })).toEqual({
      loop: { a: 11, b: 24 },
      speed: 1,
    })
  })

  /* Deliberately allowed. Sections framed by hand never meet exactly, and a
     tolerance deciding whether the box works at all would be a rule the dancer
     can feel but not see — so an outright gap is played through rather than
     refused. */
  it('plays straight through a gap between two ticked loops', () => {
    expect(chainedSpan({ saved, chain: ['first', 'third'] })).toEqual({
      loop: { a: 4, b: 24 },
      speed: 0.8,
    })
  })

  /* A whole phrase and a hard bar inside it are both worth keeping, so one loop
     sitting inside another is ordinary. Taking the last row's end would hand
     back a B before its own A — a loop that can never come round. */
  it('ends at the furthest end, not the last one ticked', () => {
    const nested = named(
      { id: 'phrase', name: 'the phrase', a: 4, b: 24 },
      { id: 'bar', name: 'the hard bar', a: 9, b: 13 },
    )

    expect(chainedSpan({ saved: nested, chain: ['phrase', 'bar'] })).toEqual({
      loop: { a: 4, b: 24 },
      speed: 1,
    })
  })

  /* The other device removed it while this one had it ticked. A tick with no
     loop behind it is not a loop, and it must not take the run down with it. */
  it('ignores a tick left over from a loop that is gone', () => {
    expect(chainedSpan({ saved, chain: ['first', 'deleted-elsewhere'] })).toEqual(
      { loop: { a: 4, b: 11 }, speed: 0.8 },
    )
  })

  it('is nothing at all when every tick is left over', () => {
    expect(chainedSpan({ saved, chain: ['deleted-elsewhere'] })).toBeNull()
  })
})
