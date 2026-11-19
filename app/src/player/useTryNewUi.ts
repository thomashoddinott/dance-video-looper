import { useState } from 'react'

/* #86, on trial: the player's **Try new UI** toggle. On to begin with since
   #100, once the new layout had won out in use; turned off, it stays off for
   the rest of the browser session — from one clip to the next and through a
   reload — because it is a choice for a practice session, not for one clip. A
   new session starts on again.

   `sessionStorage`, wrapped, because a private window or locked-down storage
   throws on the first touch. Losing it costs a tap, never a loop. */
const TRY_NEW_UI = 'looper.tryNewUi'

const stored = () => {
  try {
    return sessionStorage.getItem(TRY_NEW_UI) !== 'off'
  } catch {
    return true
  }
}

const store = (on: boolean) => {
  try {
    if (on) sessionStorage.removeItem(TRY_NEW_UI)
    else sessionStorage.setItem(TRY_NEW_UI, 'off')
  } catch {
    /* the next clip opens with it on */
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
