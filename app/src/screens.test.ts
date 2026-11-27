import { describe, expect, it } from 'vitest'

import css from './index.css?raw'
import { DESKTOP, TABLET } from './screens'

/* Every component's source, as text, to read its class names */
const sources = import.meta.glob<string>(['./**/*.tsx', '!./**/*.test.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
})

const widthIn = (name: string) =>
  new RegExp(`--breakpoint-${name}:\\s*([^;]+);`).exec(css)?.[1]?.trim()

/* #125. The app has two screen sizes past a phone's, named once in
   `index.css` for the classes and once in `screens.ts` for the script. These
   hold the two to one width each. */
describe('the screen widths', () => {
  it('are the same width in the CSS as in the script', () => {
    expect(widthIn('tablet')).toBe(TABLET)
    expect(widthIn('desktop')).toBe(DESKTOP)
  })

  /* Tailwind's own breakpoints are reset, so only the app's exist. One of
     theirs left in a class would do nothing, silently, and the layout would
     quietly lose that rule. */
  it('are the only ones the classes use', () => {
    const stray = Object.entries(sources).flatMap(([file, text]) =>
      [...text.matchAll(/(?<![\w-])(?:max-)?(?:sm|md|lg|xl|2xl):/g)].map(
        ([found]) => `${file}: ${found}`,
      ),
    )

    expect(stray).toEqual([])
  })

  it('reset Tailwind\'s own', () => {
    expect(css).toMatch(/--breakpoint-\*:\s*initial;/)
  })
})
