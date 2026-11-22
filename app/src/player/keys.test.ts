import { afterEach, describe, expect, it, vi } from 'vitest'

import { repeatWhileHeld } from './keys'

afterEach(() => {
  vi.useRealTimers()
})

/* #116. A held arrow repeats on its own clock rather than the keyboard's, which
   would run the speed from 1x to 2x in about half a second. */
describe('a key held down', () => {
  const holding = () => {
    vi.useFakeTimers()
    const step = vi.fn()
    const letGo = repeatWhileHeld(step, { wait: 400, every: 120 })

    return { step, letGo }
  }

  it('takes one step as soon as it goes down', () => {
    const { step } = holding()

    expect(step).toHaveBeenCalledTimes(1)
  })

  it('takes no more while the wait runs', () => {
    const { step } = holding()

    vi.advanceTimersByTime(400 + 120 - 1)

    expect(step).toHaveBeenCalledTimes(1)
  })

  it('then takes one every so often', () => {
    const { step } = holding()

    vi.advanceTimersByTime(400 + 120)
    expect(step).toHaveBeenCalledTimes(2)

    vi.advanceTimersByTime(120 * 3)
    expect(step).toHaveBeenCalledTimes(5)
  })

  it('stops when it is let go', () => {
    const { step, letGo } = holding()

    vi.advanceTimersByTime(400 + 120)
    letGo()
    vi.advanceTimersByTime(120 * 10)

    expect(step).toHaveBeenCalledTimes(2)
  })

  it('stops when it is let go before the wait is out', () => {
    const { step, letGo } = holding()

    letGo()
    vi.advanceTimersByTime(400 + 120 * 10)

    expect(step).toHaveBeenCalledTimes(1)
  })
})
