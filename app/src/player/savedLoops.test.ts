import { describe, expect, it } from 'vitest'

import type { SavedLoop } from '../loops/loop'
import { getLoop } from '../loops/loop.factory'
import {
  beingEdited,
  nameToKeep,
  nextLoopName,
  summarise,
  unwritten,
} from './savedLoops'

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

/* #30. Which entry a save writes over, and the reversal it rests on: identity is
   the id of the loop that was opened, not the values on the sliders. Looked up
   rather than held, so a loop removed — here or on the other device — simply
   stops being the one a save would write to. */
describe('which saved loop a save writes over', () => {
  it('is the one that was opened', () => {
    const saved = named('Loop 1', 'Loop 2')

    expect(beingEdited(saved, 'loop-1')).toBe(saved[1])
  })

  it('is none before anything has been opened or saved', () => {
    expect(beingEdited(named('Loop 1'), null)).toBeNull()
  })

  it('is none once the loop that was open has gone from the list', () => {
    expect(beingEdited(named('Loop 1'), 'loop-9')).toBeNull()
  })
})

/* BR-10 extended to the second kind of write. An empty field has always meant
   "the name being offered"; what is offered now depends on whether there is a
   loop to write over — its own name, rather than a fresh number that would
   silently rename it. */
describe('the name a write would keep', () => {
  const open = getLoop({ name: 'Loop 1' })
  const saved = [open]

  it('is what the dancer typed', () => {
    expect(nameToKeep({ typed: 'the hard bit', editing: null, saved })).toBe(
      'the hard bit',
    )
  })

  it('is the next number going, when nothing is typed and nothing is open', () => {
    expect(nameToKeep({ typed: '', editing: null, saved })).toBe('Loop 2')
  })

  it('is the name the open loop already had, when nothing is typed', () => {
    expect(nameToKeep({ typed: '', editing: open, saved })).toBe('Loop 1')
  })

  it('renames the open loop when something else is typed', () => {
    expect(nameToKeep({ typed: 'the hard bit', editing: open, saved })).toBe(
      'the hard bit',
    )
  })

  it('reads a field of spaces as empty, as a save always has', () => {
    expect(nameToKeep({ typed: '   ', editing: open, saved })).toBe('Loop 1')
  })
})

/* Whether Update has anything to write. It is what the open entry says about
   itself — the dancer's way of seeing that the loop on the sliders is no longer
   the loop in Drive. */
describe('an open loop with changes not yet written', () => {
  const entry = getLoop({ a: 3, b: 7, speed: 1, name: 'chasse' })
  const asSaved = { entry, loop: { a: 3, b: 7 }, speed: 1, name: 'chasse' }

  it('has nothing unwritten the moment it is opened', () => {
    expect(unwritten(asSaved)).toBe(false)
  })

  it('has something once A moves', () => {
    expect(unwritten({ ...asSaved, loop: { a: 2.5, b: 7 } })).toBe(true)
  })

  it('has something once B moves', () => {
    expect(unwritten({ ...asSaved, loop: { a: 3, b: 7.5 } })).toBe(true)
  })

  /* BR-09: the tempo is part of the loop, so a section at a different speed is
     a change to the loop rather than a setting that happens to be on. */
  it('has something once the tempo changes', () => {
    expect(unwritten({ ...asSaved, speed: 0.75 })).toBe(true)
  })

  it('has something once it is given a different name', () => {
    expect(unwritten({ ...asSaved, name: 'the hard bit' })).toBe(true)
  })
})
