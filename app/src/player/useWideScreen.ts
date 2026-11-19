import { useSyncExternalStore } from 'react'

/* #81. Tailwind's `lg`, the breakpoint picked at the mockup gate: 1024px and up
   is a laptop or a desktop, and has the width for the saved loops to sit in a
   column of their own beside the player.

   Asked in script rather than left to a class, because the loops move to
   another place in the page there, and a class can restyle an element but not
   move it. */
const WIDE_SCREEN = '(min-width: 64rem)'

const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(WIDE_SCREEN)

  query.addEventListener('change', onChange)

  return () => query.removeEventListener('change', onChange)
}

const isWide = () => window.matchMedia(WIDE_SCREEN).matches

export const useWideScreen = () => useSyncExternalStore(subscribe, isWide)
