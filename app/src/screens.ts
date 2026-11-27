import { useSyncExternalStore } from 'react'

/* #125. The app's screen sizes past a phone's, named for what they mean here.
   The same widths are `--breakpoint-tablet` and `--breakpoint-desktop` in
   `index.css`, which gives the classes their `tablet:` and `desktop:`
   prefixes; a test holds the two to one width each.

   A phone is everything under `TABLET`: no hover, no keyboard to speak of,
   and a thumb for a pointer. */

/* 640px: room for three clips abreast, and a pointer that hovers */
export const TABLET = '40rem'

/* 1024px: a laptop or a desktop. Wide enough for the saved loops to sit in a
   column beside the player (#81), and where the experiments are offered
   first. */
export const DESKTOP = '64rem'

const DESKTOP_QUERY = `(min-width: ${DESKTOP})`

const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(DESKTOP_QUERY)

  query.addEventListener('change', onChange)

  return () => query.removeEventListener('change', onChange)
}

const isDesktop = () => window.matchMedia(DESKTOP_QUERY).matches

/* The switch, for what a class cannot do: a class can restyle an element but
   not move it to another place in the page, or decide whether a phone's share
   sheet or a download is the way out. Follows the window as it is resized. */
export const useDesktop = () => useSyncExternalStore(subscribe, isDesktop)
