import { describe, expect, it } from 'vitest'

import { getLoop } from './loop.factory'
import {
  countOf,
  laterOf,
  loopsFor,
  openedAt,
  withLoop,
  withLoopReplaced,
  withOpens,
  withoutLoop,
} from './loopsChange'
import { NO_LOOPS } from './loopsFile'

const A_CLIP = 'shuffle-drill'
const ANOTHER_CLIP = 'pivot-turn'

/* When the change being made happened. Every one of these functions takes it
   rather than reading a clock, so the merge below is testable as arithmetic. */
const AT = '2026-09-06T18:04:11.000Z'
const EARLIER = '2026-09-06T09:00:00.000Z'
const LATER = '2026-09-06T21:30:00.000Z'

const holding = (
  clips: Record<string, ReturnType<typeof getLoop>[]>,
  touched: Record<string, string> = {},
) => ({ ...NO_LOOPS, clips, touched })

/* These three are the whole of what a device ever does to `loops.json`, and that
   is the point: because the only changes are "append this one", "drop this id"
   and "this id now reads like so", replaying one onto whatever Drive currently
   holds is a complete merge. No tombstones, and no deleted loop coming back to
   life (UC-01 Q-05). */
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

/* #30. The third change, and the one that keeps the list the size the dancer
   thinks it is: correcting a loop that starts half a second late has to write
   over the loop rather than beside it. */
describe('replacing a loop', () => {
  it('takes the new values under the same id', () => {
    const before = getLoop({ id: 'the-hard-bit', a: 3, b: 7, speed: 1 })
    const after = { ...before, a: 2.5, b: 7.5, speed: 0.75 }

    expect(
      withLoopReplaced(holding({ [A_CLIP]: [before] }), A_CLIP, after),
    ).toEqual(holding({ [A_CLIP]: [after] }))
  })

  it('renames it, because the name is saved with the rest', () => {
    const before = getLoop({ id: 'the-hard-bit', name: 'Loop 1' })

    expect(
      withLoopReplaced(holding({ [A_CLIP]: [before] }), A_CLIP, {
        ...before,
        name: 'the hard bit',
      }).clips[A_CLIP],
    ).toEqual([{ ...before, name: 'the hard bit' }])
  })

  /* The panel lists them in the order they were saved and nothing reorders it,
     so an entry that jumped to the end on every correction would be a second
     thing happening that nobody asked for. */
  it('leaves it where it was in the list', () => {
    const first = getLoop({ id: 'first' })
    const middle = getLoop({ id: 'middle', a: 3 })
    const last = getLoop({ id: 'last' })

    expect(
      withLoopReplaced(
        holding({ [A_CLIP]: [first, middle, last] }),
        A_CLIP,
        { ...middle, a: 9 },
      ).clips[A_CLIP],
    ).toEqual([first, { ...middle, a: 9 }, last])
  })

  it('leaves every other clip exactly as it was', () => {
    const mine = getLoop({ id: 'mine' })
    const theirs = getLoop({ id: 'theirs' })

    expect(
      withLoopReplaced(
        holding({ [A_CLIP]: [mine], [ANOTHER_CLIP]: [theirs] }),
        A_CLIP,
        { ...mine, a: 9 },
      ).clips,
    ).toEqual({ [A_CLIP]: [{ ...mine, a: 9 }], [ANOTHER_CLIP]: [theirs] })
  })

  /* The half of Q-05 this change had to answer before it could exist. A
     replacement replays onto whatever Drive holds *now*, and by then the other
     device may have removed the loop being corrected — so it adds nothing and
     the removal stands. Appending instead would resurrect a deleted loop, which
     is the one thing the merge has always refused to do. */
  it('is a no-op for an id the file no longer has', () => {
    const held = holding({ [A_CLIP]: [getLoop({ id: 'still-here' })] })

    expect(
      withLoopReplaced(held, A_CLIP, getLoop({ id: 'removed-elsewhere' })),
    ).toEqual(held)
  })

  it('is a no-op for a clip that is not there', () => {
    expect(withLoopReplaced(NO_LOOPS, 'no-such-clip', getLoop())).toEqual(
      NO_LOOPS,
    )
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

  it('says when it was last opened', () => {
    expect(openedAt(holding({}, { [A_CLIP]: AT }), A_CLIP)).toBe(AT)
  })

  /* Undefined rather than a fallback date. "Never opened" is not "opened
     at the beginning of time" — the chip has to sort it below every clip that
     has been, and a real date would let it tie with one. */
  it('says nothing for a clip that has never been opened', () => {
    expect(openedAt(NO_LOOPS, 'no-such-clip')).toBeUndefined()
  })
})

/* #16 — the opens this device recorded, carried into `loops.json` by the write a
   loop save or removal was already making. There is no write of their own: the
   whole point of keeping them on the device is that opening a clip costs Drive
   nothing. */
describe('carrying this device\u2019s opens into the file', () => {
  it('adds a stamp for a clip the file had never heard of', () => {
    expect(withOpens(NO_LOOPS, { [A_CLIP]: AT }).touched).toEqual({
      [A_CLIP]: AT,
    })
  })

  it('carries every clip it is given, and leaves the loops alone', () => {
    const held = holding({ [A_CLIP]: [getLoop()] })

    const carried = withOpens(held, { [A_CLIP]: AT, [ANOTHER_CLIP]: LATER })

    expect(carried.clips).toEqual(held.clips)
    expect(carried.touched).toEqual({ [A_CLIP]: AT, [ANOTHER_CLIP]: LATER })
  })

  it('moves a stamp on when this device opened the clip more recently', () => {
    expect(
      withOpens(holding({}, { [A_CLIP]: EARLIER }), { [A_CLIP]: LATER }).touched,
    ).toEqual({ [A_CLIP]: LATER })
  })

  /* The merge rule, and why this is `max` rather than an assignment.
     `applyToLoops` replays the change onto whatever Drive holds *now*, so a
     laptop that has been shut for a week must not drag a clip's recency
     backwards over what the phone wrote while it was away. */
  it('leaves a later stamp standing when this device is behind', () => {
    expect(
      withOpens(holding({}, { [A_CLIP]: LATER }), { [A_CLIP]: EARLIER }).touched,
    ).toEqual({ [A_CLIP]: LATER })
  })

  it('leaves a clip this device has not opened exactly as it was', () => {
    expect(
      withOpens(holding({}, { [ANOTHER_CLIP]: EARLIER }), { [A_CLIP]: AT })
        .touched,
    ).toEqual({ [ANOTHER_CLIP]: EARLIER, [A_CLIP]: AT })
  })

  it('is a no-op when this device has opened nothing', () => {
    const held = holding({ [A_CLIP]: [getLoop()] }, { [A_CLIP]: AT })

    expect(withOpens(held, {})).toEqual(held)
  })
})

/* The same rule the grid reads with: this device's own record and Drive's may
   each be ahead of the other, and the honest answer is the later one. */
describe('the later of two stamps', () => {
  it('takes whichever is later', () => {
    expect(laterOf(EARLIER, LATER)).toBe(LATER)
    expect(laterOf(LATER, EARLIER)).toBe(LATER)
  })

  it('takes the one that exists when only one does', () => {
    expect(laterOf(undefined, AT)).toBe(AT)
    expect(laterOf(AT, undefined)).toBe(AT)
  })

  it('is undefined when neither does', () => {
    expect(laterOf(undefined, undefined)).toBeUndefined()
  })
})
