import { vi } from 'vitest'

/* jsdom has no `matchMedia` at all, and the player asks it whether the screen is
   wide enough for the saved loops to have a column of their own (#81). Every
   test starts on a narrow one (`setup.ts`), which is the layout every test
   written before #81 assumed; a test about the wide one says so.

   One answer for any query, because the player asks only the one. It can change
   under a test the way it does when a window is dragged across the breakpoint,
   and whatever is listening is told — which is what lets a test ask whether the
   clip survives the move. */
export const aWindow = ({ wide }: { readonly wide: boolean }) => {
  let matches = wide
  const listeners = new Set<() => void>()

  vi.stubGlobal('matchMedia', (media: string) => ({
    media,
    get matches() {
      return matches
    },
    addEventListener: (_type: 'change', listener: () => void) => {
      listeners.add(listener)
    },
    removeEventListener: (_type: 'change', listener: () => void) => {
      listeners.delete(listener)
    },
  }))

  return {
    resize: ({ wide: now }: { readonly wide: boolean }) => {
      matches = now
      listeners.forEach((listener) => listener())
    },
  }
}
