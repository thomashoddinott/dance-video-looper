import { describe, expect, it } from 'vitest'

import { getLoop } from './loop.factory'
import {
  countOf,
  loopsFor,
  practisedAt,
  withLoop,
  withoutLoop,
} from './loopsChange'
import { NO_LOOPS } from './loopsFile'

const A_CLIP = 'shuffle-drill'
const ANOTHER_CLIP = 'pivot-turn'

/* When the change being made happened. Every one of these functions takes it
   rather than reading a clock, so the merge below is testable as arithmetic. */
const AT = '2026-09-06T18:04:11.000Z'

const holding = (
  clips: Record<string, ReturnType<typeof getLoop>[]>,
  touched: Record<string, string> = {},
) => ({ ...NO_LOOPS, clips, touched })

/* These two are the whole of what a device ever does to `loops.json`, and that
   is the point: because the only changes are "append this one" and "drop this
   id", replaying one onto whatever Drive currently holds is a complete merge.
   No tombstones, and no deleted loop coming back to life (UC-01 Q-05). */
describe('adding a loop', () => {
  it('starts the list for a clip that had none', () => {
    const loop = getLoop()

    expect(withLoop(NO_LOOPS, A_CLIP, loop)).toEqual(
      holding({ [A_CLIP]: [loop] }),
    )
  })

  it('adds to the end, which is the order the panel lists them in', () => {
    const first = getLoop({ id: 'first' })
    const second = getLoop({ id: 'second' })

    expect(
      withLoop(holding({ [A_CLIP]: [first] }), A_CLIP, second).clips[A_CLIP],
    ).toEqual([first, second])
  })

  /* The reason a save re-reads before it writes: the other device's clip is in
     the same file, and its loops have to come through untouched. */
  it('leaves every other clip exactly as it was', () => {
    const mine = getLoop({ id: 'mine' })
    const theirs = getLoop({ id: 'theirs' })

    expect(
      withLoop(holding({ [ANOTHER_CLIP]: [theirs] }), A_CLIP, mine).clips,
    ).toEqual({ [ANOTHER_CLIP]: [theirs], [A_CLIP]: [mine] })
  })
})

describe('removing a loop', () => {
  it('takes out the one named and leaves its siblings', () => {
    const kept = getLoop({ id: 'kept' })
    const going = getLoop({ id: 'going' })

    expect(
      withoutLoop(holding({ [A_CLIP]: [kept, going] }), A_CLIP, 'going'),
    ).toEqual(holding({ [A_CLIP]: [kept] }))
  })

  /* Matches what the reader does with a clip whose every entry was malformed:
     a clip with no loops is not in the file at all, so the two cannot disagree
     about what an empty list means. */
  it('drops the clip entirely once its last loop is gone', () => {
    expect(
      withoutLoop(
        holding({ [A_CLIP]: [getLoop({ id: 'only' })] }),
        A_CLIP,
        'only'),
    ).toEqual(NO_LOOPS)
  })

  it('leaves every other clip exactly as it was', () => {
    const theirs = getLoop({ id: 'theirs' })

    expect(
      withoutLoop(
        holding({ [A_CLIP]: [getLoop({ id: 'mine' })], [ANOTHER_CLIP]: [theirs] }),
        A_CLIP,
        'mine',
      ),
    ).toEqual(holding({ [ANOTHER_CLIP]: [theirs] }))
  })

  /* Both of these happen for real: the other device removed it first, and the
     merge replays a removal onto a file that no longer has it. */
  it('is a no-op for an id that is not there', () => {
    const held = holding({ [A_CLIP]: [getLoop()] })

    expect(withoutLoop(held, A_CLIP, 'never-saved')).toEqual(held)
  })

  it('is a no-op for a clip that is not there', () => {
    expect(withoutLoop(NO_LOOPS, 'no-such-clip', 'loop-1')).toEqual(NO_LOOPS)
  })
})

describe('what a clip has', () => {
  it('lists the loops saved against it', () => {
    const loop = getLoop()

    expect(loopsFor(holding({ [A_CLIP]: [loop] }), A_CLIP)).toEqual([loop])
  })

  /* An orphan — a clip deleted from Drive by other means — is a key nothing
     asks about, and a clip with no loops is a clip the file has never heard of.
     Both have to answer "none" rather than throw, which is the whole of UC-01's
     orphan criterion. */
  it('answers none for a clip it has never heard of', () => {
    expect(loopsFor(NO_LOOPS, 'no-such-clip')).toEqual([])
    expect(countOf(NO_LOOPS, 'no-such-clip')).toBe(0)
  })

  it('counts what the tile puts in parentheses', () => {
    expect(
      countOf(
        holding({ [A_CLIP]: [getLoop({ id: 'a' }), getLoop({ id: 'b' })] }),
        A_CLIP,
      ),
    ).toBe(2)
  })

  it('says when it was last practised', () => {
    expect(practisedAt(holding({}, { [A_CLIP]: AT }), A_CLIP)).toBe(AT)
  })

  /* Undefined rather than a fallback date. "Never practised" is not "practised
     at the beginning of time" — the chip has to sort it below every clip that
     has been, and a real date would let it tie with one. */
  it('says nothing for a clip that has never been practised', () => {
    expect(practisedAt(NO_LOOPS, 'no-such-clip')).toBeUndefined()
  })
})
