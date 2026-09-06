import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { inDocumentOrder } from '../test/documentOrder'
import { SpeedStepper } from './SpeedStepper'

const aStepperAt = (speed: number) => {
  const changes = vi.fn()

  render(<SpeedStepper speed={speed} onChange={changes} />)

  return changes
}

/* What the dancer reads off the middle of the row. Asked for by the name the
   control carries rather than by looking for a number, so the test says which
   element is supposed to be showing it. */
const rateOnDisplay = () => screen.getByLabelText('Playback speed').textContent

describe('the speed stepper', () => {
  /* Five, and in this order: the two decreases sit left of the rate and the two
     increases right of it, so pressing further from the middle moves further. A
     row that rendered them in any other order would still be five controls. */
  it('puts the rate between the controls that lower it and the ones that raise it', () => {
    aStepperAt(1)

    expect(
      inDocumentOrder({
        muchSlower: screen.getByRole('button', { name: 'Much slower' }),
        slower: screen.getByRole('button', { name: 'Slower' }),
        rate: screen.getByLabelText('Playback speed'),
        faster: screen.getByRole('button', { name: 'Faster' }),
        muchFaster: screen.getByRole('button', { name: 'Much faster' }),
      }),
    ).toEqual(['muchSlower', 'slower', 'rate', 'faster', 'muchFaster'])
  })

  /* The criterion is about what a screen reader announces: two controls both
     called "minus" are two controls the dancer cannot tell apart, and the row
     has two of each. Naming them by how far they move settles it. */
  it('names all four controls distinguishably', () => {
    aStepperAt(1)

    expect(
      screen.getAllByRole('button').map((control) => control.ariaLabel),
    ).toEqual(['Much slower', 'Slower', 'Faster', 'Much faster'])
  })

  it('reads the rate as a plain number, without trailing zeros', () => {
    aStepperAt(1)

    expect(rateOnDisplay()).toBe('1')
  })

  it('reads a fractional rate the same way', () => {
    aStepperAt(0.75)

    expect(rateOnDisplay()).toBe('0.75')
  })

  it('offers a slower rate when the small decrease is pressed', async () => {
    const changes = aStepperAt(1)

    await userEvent.click(screen.getByRole('button', { name: 'Slower' }))

    expect(changes).toHaveBeenCalledWith(0.95)
  })

  it('offers a faster rate when the small increase is pressed', async () => {
    const changes = aStepperAt(1)

    await userEvent.click(screen.getByRole('button', { name: 'Faster' }))

    expect(changes).toHaveBeenCalledWith(1.05)
  })

  it('moves twice as far on the large controls', async () => {
    const changes = aStepperAt(1)

    await userEvent.click(screen.getByRole('button', { name: 'Much slower' }))
    await userEvent.click(screen.getByRole('button', { name: 'Much faster' }))

    expect(changes.mock.calls).toEqual([[0.9], [1.1]])
  })

  /* The stepper is told the rate rather than keeping one, so the bounds it
     reports are the model's. Pressed at the floor it offers the floor back —
     which is what stops a held-down control walking the rate to zero. */
  it('offers no rate below the slowest one', async () => {
    const changes = aStepperAt(0.1)

    await userEvent.click(screen.getByRole('button', { name: 'Much slower' }))

    expect(changes).toHaveBeenCalledWith(0.1)
  })
})
