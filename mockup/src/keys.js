/* #116: the timings the keys run on, as picked at the mockup gate. Held keys
   repeat on these, not on the keyboard's own repeat, which would run 1x to 2x
   in about half a second. */
export const KEY_DEFAULTS = {
  speedHoldDelay: 400,
  speedRepeatEvery: 120,
  scrubStep: 0.1,
  scrubHoldDelay: 300,
  scrubRepeatEvery: 50,
  scrubRepeatEveryYouTube: 250,
  resumeAfter: 3,
}
