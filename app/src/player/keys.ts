/* #116. The timings the keys run on, in milliseconds, as picked at the mockup
   gate and frozen there. A held arrow repeats on these rather than on the
   keyboard's own repeat, which would run the speed from 1x to 2x in about half
   a second.

   YouTube's scrub repeats slower than a clip's: each step is a seek it takes
   its time to show, and stepping faster than it can only queues them up. */
export const KEY_TIMINGS = {
  speedHoldDelay: 400,
  speedRepeatEvery: 120,
  scrubHoldDelay: 300,
  scrubRepeatEvery: 50,
  scrubRepeatEveryYouTube: 250,
  /* A scrub begun while the clip played: how long after the last step it
     plays on by itself. */
  resumeAfter: 3000,
} as const

/* How long what the last key did stays over the clip. */
export const READOUT_FOR = 900

/* One step as soon as the key goes down, then after `wait` one every `every`,
   until the stop it hands back is called. */
export const repeatWhileHeld = (
  step: () => void,
  { wait, every }: { readonly wait: number; readonly every: number },
) => {
  let repeating: ReturnType<typeof setInterval> | undefined

  step()

  const waiting = setTimeout(() => {
    repeating = setInterval(step, every)
  }, wait)

  return () => {
    clearTimeout(waiting)
    clearInterval(repeating)
  }
}
