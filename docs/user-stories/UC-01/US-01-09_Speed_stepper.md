# US-01-09: Speed stepper

**Status:** APPROVED
**Use Case:** UC-01 — Loop a section of a clip
**Actor:** Dancer
**Priority:** TBD

## Story

As a dancer, I want to slow the clip down in small steps, so that a movement too
fast to read becomes something I can follow and copy.

## Acceptance Criteria

- [ ] Given the player, when the stepper renders, then it offers **five elements in a row**: a large decrease, a small decrease, the current rate, a small increase and a large increase
- [ ] Given a clip that is not ready to play, when the player renders, then the stepper is **not offered at all** — there is no rate to change
- [ ] Given the small steps, when used, then the rate changes by **0.05**; given the large steps, by **0.1**
- [ ] Given the stepper, when the rate changes, then playback speed changes **immediately and without interrupting the loop**
- [ ] Given the rate, when displayed, then it reads as a plain number with no trailing zeros — `1`, `0.5`, `0.75` — in a font where the digits do not shift width as it changes
- [ ] Given the rate is at its **minimum of 0.1**, when a decrease is pressed, then it stays at 0.1 and does not wrap or go negative
- [ ] Given the rate is at its **maximum of 2**, when an increase is pressed, then it stays at 2
- [ ] Given repeated steps, when the rate is displayed, then it never accumulates floating-point noise — `0.35`, never `0.35000000000000003`
- [ ] Given a clip is opened, when the player loads, then the rate starts at **1**
- [ ] Given each control, when reached by assistive technology, then it is distinguishable from its neighbours — the two decreases are not both "minus"

## Notes

- **Mockup:** `mockup/src/Player.jsx:119–149` (`SpeedStepper`), `533` (its use), `330–332` (applying the rate), `1–8` (the step sizes and bounds)
- **References:** UC-01 Basic Flow steps 12–13, BR-06
- **Not in this story:** the speed being **saved as part of a loop** and restored when that loop is recalled (US-01-11). This story only changes the current rate.
- **A deliberate departure from the mockup:** the mockup shows the stepper
  unconditionally, so a clip that will not decode still gets a rate control with
  nothing to apply it to. US-01-07 already settled the opposite for the transport —
  it renders only once playback is ready (`PlayerScreen.tsx`) — and a dead speed
  control is the same mistake. The stepper follows the transport.
- **AC 4 is half unobservable, on purpose.** The formatting rule — no trailing
  zeros — is an ordinary unit test. The digits not shifting width is `tabular-nums`,
  a typographic property jsdom cannot see, so it is confirmed by watching the number
  change at the smoke test rather than by a test. Both halves stay in the criterion:
  the second is a real requirement, just not an automatable one.
- **Resolved questions:**
  - ~~The floor of 0.1 is well below useful~~ **Resolved — the range stands as
    mocked, 0.1x to 2x.** Settled at this story's approval gate. The bottom of the
    range is accepted as probably dead travel: nothing is lost by offering it, the
    dancer simply stops stepping where it stops helping, and the floor can be raised
    later without breaking anything. This is what confirms BR-06 and clears its 🔍.
  - ~~Whether audio should be **pitch-corrected** when slowed is unaddressed~~
    **Resolved — nothing to build.** `preservesPitch` defaults to `true`, so by not
    touching it the mockup already gets pitch-corrected audio and counting music
    stays in key. The premise of the question was wrong: browsers do not merely
    *offer* pitch correction, they apply it unless told not to.
- **Untested at the floor:** browsers are understood to drop audio entirely at very
  low rates, somewhere near 0.25x. That was not verified when the range was settled,
  and it is the thing most likely to make the bottom of the range useless rather than
  merely redundant. Worth a look during the smoke test.
- **Dependencies:** US-01-05 (the region), US-01-06 (playback to apply the rate to)
