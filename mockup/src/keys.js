/* #116 mockup gate: the timings the keys run on, tunable from the Keys panel
   while they are tried. Held keys repeat on these, not on the keyboard's own
   repeat, which would run 1x to 2x in about half a second. */
export const KEY_DEFAULTS = {
  speedHoldDelay: 400,
  speedRepeatEvery: 120,
  scrubStep: 0.1,
  scrubHoldDelay: 300,
  scrubRepeatEvery: 50,
  scrubRepeatEveryYouTube: 250,
  youTubeResumeAfter: 0,
}
