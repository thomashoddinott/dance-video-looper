import { describe, expect, it } from 'vitest'

import {
  SPEED_MAX,
  SPEED_MIN,
  SPEED_STEP,
  SPEED_STEP_BIG,
  stepped,
} from './speed'

/* Nobody arrives at 0.35 in one press. The rate is reached by pressing a control
   over and over, so the case worth pinning is the one only repetition reaches —
   which is also the only way the arithmetic can drift. */
const steppedRepeatedly = ({
  from,
  by,
  times,
}: {
  readonly from: number
  readonly by: number
  readonly times: number
}) =>
  Array.from({ length: times }).reduce<number>(
    (rate) => stepped({ from: rate, by }),
    from,
  )

describe('stepping the playback rate', () => {
  it('moves by a twentieth on the small steps and a tenth on the large ones', () => {
    expect(stepped({ from: 1, by: -SPEED_STEP })).toBe(0.95)
    expect(stepped({ from: 1, by: SPEED_STEP })).toBe(1.05)
    expect(stepped({ from: 1, by: -SPEED_STEP_BIG })).toBe(0.9)
    expect(stepped({ from: 1, by: SPEED_STEP_BIG })).toBe(1.1)
  })

  /* Both step sizes, because the large one overshoots the floor from a rate the
     small one only reaches — and an unclamped overshoot lands on zero, which is
     not a slow clip but a stopped one. */
  it('stays at the slowest rate rather than wrapping or running backwards', () => {
    expect(stepped({ from: SPEED_MIN, by: -SPEED_STEP })).toBe(SPEED_MIN)
    expect(stepped({ from: SPEED_MIN, by: -SPEED_STEP_BIG })).toBe(SPEED_MIN)
    expect(stepped({ from: 0.15, by: -SPEED_STEP_BIG })).toBe(SPEED_MIN)
  })

  it('stays at the fastest rate', () => {
    expect(stepped({ from: SPEED_MAX, by: SPEED_STEP })).toBe(SPEED_MAX)
    expect(stepped({ from: SPEED_MAX, by: SPEED_STEP_BIG })).toBe(SPEED_MAX)
  })

  /* Thirteen presses of the same control. Added up in plain floating point this
     is 0.34999999999999987, and the dancer reads it off the screen. */
  it('is still a round number however many times it has been stepped', () => {
    expect(steppedRepeatedly({ from: 1, by: -SPEED_STEP, times: 13 })).toBe(0.35)
  })
})
