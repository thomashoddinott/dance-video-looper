import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { KeyMap } from './KeyMap'

/* #115. Every key the player answers to, in one place: the hint line says what
   the next key does, and this is the whole map. */
describe('the key map', () => {
  const opened = async () => {
    render(<KeyMap />)
    await userEvent.click(screen.getByText('Keys'))
  }

  const group = (name: string) => screen.getByRole('region', { name })

  /* Each row as its keys and what they do, without the timings under it. */
  const rows = (name: string) =>
    within(group(name))
      .getAllByRole('term')
      .map((term) => [
        [...term.querySelectorAll('kbd')].map((key) => key.textContent).join(' '),
        term.nextElementSibling?.firstChild?.textContent,
      ])

  it('is closed until it is clicked', async () => {
    render(<KeyMap />)
    const map = screen.getByRole('group', { name: 'Keys' })

    expect(map).not.toHaveAttribute('open')

    await userEvent.click(screen.getByText('Keys'))

    expect(map).toHaveAttribute('open')
  })

  it('groups the keys under Play, Arrows and Loop', async () => {
    await opened()

    expect(
      screen.getAllByRole('heading').map((heading) => heading.textContent),
    ).toEqual(['Play', 'Arrows', 'Loop'])
  })

  it('lists the keys that play the clip', async () => {
    await opened()

    expect(rows('Play')).toEqual([
      ['space', 'plays and pauses'],
      ['f', 'zen mode'],
      ['esc', 'leaves zen mode'],
    ])
  })

  it('lists the arrows, for speed and for scrubbing', async () => {
    await opened()

    expect(rows('Arrows')).toEqual([
      ['↑ ↓', 'speed ±0.05, 0.1x to 2x'],
      ['← →', 'scrub 0.1s, inside the loop'],
    ])
  })

  /* The values the keys run on (`keys.ts`), so the map cannot say one thing
     while the keys do another. */
  it('says how a held arrow repeats, and when a scrub plays on', async () => {
    await opened()
    const arrows = within(group('Arrows'))

    expect(arrows.getByText('held: after 400ms, a step every 120ms')).toBeVisible()
    expect(
      arrows.getByText('held: after 300ms, a step every 50ms (YouTube 250ms)'),
    ).toBeVisible()
    expect(
      arrows.getByText('while playing: pauses, plays on 3s after the last step'),
    ).toBeVisible()
  })

  it('lists the keys that frame and keep a loop', async () => {
    await opened()

    expect(rows('Loop')).toEqual([
      ['enter', 'sets A, then B'],
      ['s', 'saves the loop, or updates the open one'],
      ['⇧s', 'saves it as a new one'],
      ['enter', 'in the name field: saves'],
      ['← →', 'on a focused A or B handle: moves it 1s'],
      ['home end', 'on a focused handle: to the start or end'],
    ])
  })
})
