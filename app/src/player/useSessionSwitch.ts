import { useState } from 'react'

/* The player's experimental switches (#86 **Try new UI**, #105 **Countdown**):
   on to begin with, and once turned off, off for the rest of the browser
   session — from one clip to the next and through a reload — because each is a
   choice for a practice session, not for one clip. A new session starts on
   again, which is the point of a trial: the thing tried is what the player is
   until it is decided.

   `sessionStorage`, wrapped, because a private window or locked-down storage
   throws on the first touch. Losing it costs a tap, never a loop. */
export const TRY_NEW_UI = 'looper.tryNewUi'
export const COUNTDOWN = 'looper.countdown'

const storedOn = (key: string) => {
  try {
    return sessionStorage.getItem(key) !== 'off'
  } catch {
    return true
  }
}

const store = (key: string, on: boolean) => {
  try {
    if (on) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, 'off')
  } catch {
    /* the next clip opens with it on */
  }
}

export const useSessionSwitch = (key: string) => {
  const [on, setOn] = useState(() => storedOn(key))

  const set = (next: boolean) => {
    setOn(next)
    store(key, next)
  }

  return [on, set] as const
}
