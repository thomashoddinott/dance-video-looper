import { describe, expect, it } from 'vitest'

import { MIN_LOOP } from './loopRange'
import type { Loop } from './playback'
import { isTyping, spaceSets } from './shortcuts'

const aLoop = ({ a = 0, b = 12 }: Partial<Loop> = {}): Loop => ({ a, b })

/* BR-02 and BR-03. Space marks the section while it goes past, so a press is read
   against the clip's own position — and it answers two things at once: where the
   loop ends up, and which boundary the next press will land on. They come back
   together because they are one decision; worked out apart, a screen could set A
   and then arm A again. */
describe('setting a loop point with space', () => {
  it('puts A where the clip has got to', () => {
    expect(
      spaceSets({ loop: aLoop(), handle: 'a', seconds: 6, duration: 12 }).loop,
    ).toEqual({ a: 6, b: 12 })
  })

  /* BR-02: setting A alone would leave B behind the playhead and the loop
     invalid, so B goes to the end and what is on screen stays playable. */
  it('parks B at the end of the clip when A is set', () => {
    expect(
      spaceSets({
        loop: aLoop({ a: 1, b: 5 }),
        handle: 'a',
        seconds: 9,
        duration: 12,
      }).loop,
    ).toEqual({ a: 9, b: 12 })
  })

  /* BR-18's one exception, settled at this story's approval gate. Every other
     route to a boundary is floored; this one is not, because honouring the moment
     the dancer pressed matters more than the length it leaves — and the press that
     sets B goes through the floor anyway, so the two still cannot cross. */
  it('leaves A on the playhead even within the minimum loop of the end', () => {
    expect(
      spaceSets({ loop: aLoop(), handle: 'a', seconds: 11.95, duration: 12 }).loop,
    ).toEqual({ a: 11.95, b: 12 })
  })

  it('arms the next press for B once A is set', () => {
    expect(
      spaceSets({ loop: aLoop(), handle: 'a', seconds: 6, duration: 12 }).next,
    ).toBe('b')
  })

  it('puts B where the clip has got to, leaving A where it was', () => {
    expect(
      spaceSets({
        loop: aLoop({ a: 2, b: 12 }),
        handle: 'b',
        seconds: 8,
        duration: 12,
      }).loop,
    ).toEqual({ a: 2, b: 8 })
  })

  /* BR-18 proper. Unlike A above, B is floored — through the same `movedTo` the
     drag and the arrow keys use, so the rule keeps one home. */
  it('keeps B off A by the minimum loop', () => {
    expect(
      spaceSets({
        loop: aLoop({ a: 6, b: 12 }),
        handle: 'b',
        seconds: 6.05,
        duration: 12,
      }).loop,
    ).toEqual({ a: 6, b: 6 + MIN_LOOP })
  })

  it('comes round to A once B is set', () => {
    expect(
      spaceSets({ loop: aLoop(), handle: 'b', seconds: 8, duration: 12 }).next,
    ).toBe('a')
  })
})

/* BR-05. Every shortcut here is a single printing character or space, so a caret
   in a text field turns each of them into something the dancer meant to type —
   otherwise a loop could not be named "space fix" without reframing the clip. */
describe('deciding whether the dancer is typing', () => {
  const typedInto = (element: HTMLElement) => {
    document.body.append(element)

    return element
  }

  it('is typing when the caret is in a text field', () => {
    expect(isTyping(typedInto(document.createElement('input')))).toBe(true)
  })

  it('is typing when the caret is in a multi-line field', () => {
    expect(isTyping(typedInto(document.createElement('textarea')))).toBe(true)
  })

  it('is not typing when the key landed on an ordinary element', () => {
    expect(isTyping(typedInto(document.createElement('div')))).toBe(false)
  })

  /* A key pressed with nothing focused reports the document as its target, and a
     shortcut that stood down for it would never fire at all. */
  it('is not typing when the key landed on nothing at all', () => {
    expect(isTyping(null)).toBe(false)
  })
})
