import { useState } from 'react'

/* #86, on trial: the player's **Try new UI** toggle. Off to begin with, and
   once on it stays on for the rest of the browser session — from one clip to
   the next and through a reload — because it is turned on for a practice
   session, not once per clip. A new session starts off again, which is the
   point of a trial: the old layout is what the player is until it is decided.

   `sessionStorage`, wrapped, because a private window or locked-down storage
   throws on the first touch. Losing it costs a tap, never a loop. */
const TRY_NEW_UI = 'looper.tryNewUi'

const stored = () => {
  try {
    return sessionStorage.getItem(TRY_NEW_UI) === 'on'
  } catch {
    return false
  }
}

const store = (on: boolean) => {
  try {
    if (on) sessionStorage.setItem(TRY_NEW_UI, 'on')
    else sessionStorage.removeItem(TRY_NEW_UI)
  } catch {
    /* the next clip opens without it */
  }
}

export const useTryNewUi = () => {
  const [on, setOn] = useState(stored)

  const set = (next: boolean) => {
    setOn(next)
    store(next)
  }

  return [on, set] as const
}
