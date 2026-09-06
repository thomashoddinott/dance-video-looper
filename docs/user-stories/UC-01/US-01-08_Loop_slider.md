# US-01-08: Loop slider

**Status:** APPROVED
**Use Case:** UC-01 — Loop a section of a clip
**Actor:** Dancer
**Priority:** TBD

## Story

As a dancer, I want to see and drag the start and end of my loop against the
clip's timeline, so that I can frame exactly the seconds I am trying to learn.

## Acceptance Criteria

- [ ] Given the player, when the slider renders, then it shows a track spanning the whole clip, with the **looped span highlighted** between A and B
- [ ] Given the slider, when the clip is playing, then a **playhead marker** shows the current position, sampled **per animation frame** rather than at the ~4 Hz of the video's own progress events, and it keeps moving whether or not looping is on (See BR-07)
- [ ] Given the slider, when it renders, then the **A handle sits above the track and the B handle below it**, each with its time beneath and above respectively, so the two labels never collide when the loop is short
- [ ] Given a handle, when the dancer drags it, then the video **seeks as they drag**, so the boundary is chosen by what is seen rather than by arithmetic
- [ ] Given the A handle, when dragged, then it cannot come within **0.2 seconds** of B; given the B handle, when dragged, then it cannot come within 0.2 seconds of A — the minimum loop length is always preserved (See BR-18)
- [ ] Given the track, when the dancer taps or clicks anywhere on it, then playback seeks to that point without moving A or B
- [ ] Given the player, when the seek controls render, then **back one second** and **forward one second** are offered, each clamped to the clip's bounds
- [ ] Given a handle, when it is dragged on a touch screen, then the page does not scroll and the drag continues even if the finger leaves the handle
- [ ] Given each handle, when reached by assistive technology, then it reports itself as a slider carrying its minimum, its maximum, and its current time **as a spoken time rather than a raw number of seconds**
- [ ] Given a focused handle, when the dancer presses **←** or **→**, then it moves one second and the video seeks with it, clamped exactly as a drag is; **Home** and **End** take it as far as those same limits allow
- [ ] Given a loop that is running, when the dancer moves a boundary by drag or by key, then the clip shows **that boundary** rather than jumping back to A, and the loop is enforced again as soon as they let go (See BR-19)

## Notes

- **Mockup:** `mockup/src/Player.jsx:151–255` (`LoopSlider`), `536–542` (its use), `106–117` and `524–532` (the ±1 s seek controls), `398–404` (seeking and nudging)
- **References:** UC-01 Basic Flow step 11, alternate flow 11a, BR-07, BR-16, BR-18
- **Not in this story:** setting A and B **by keyboard** (US-01-10), and the loop being enforced (US-01-07, landed). Dragging B to complete a half-set loop is specified in US-01-10, because the half-set state is created there.
- **Dependencies:** US-01-05 (the region), US-01-06 (a known duration to lay out against) — both landed.

### Settled at the approval gate, 2026-09-03

- **The playhead needed a source, and the mockup's is the one BR-07 already rejected.**
  Nothing in the app has ever tracked `currentTime`; the mockup reads it from
  `onTimeUpdate` (`Player.jsx:322`), the ~4 Hz event BR-07 calls *"far too coarse"*.
  The rAF loop US-01-07 landed could not simply be reused either — BR-07 as settled
  runs it only while **playing *and* looping**, so releasing the loop would freeze the
  playhead mid-clip. The slider gets its own rAF, gated on playing alone. BR-07 carries
  the decision.
- **The minimum loop length is 0.2 s**, taken from the mockup's `MIN_LOOP` and written
  into the UC as BR-18. It was previously unnamed here, which made the criterion
  unreviewable.
- **The ±1 s step stays fixed**, and the open question that asked whether it should
  scale with loop length is closed. The question was mis-framed: the nudge moves the
  **playhead**, not the loop bounds, so its relation to loop length is weaker than
  "for a two-second loop that is half the loop" implies. It is a scrubbing-precision
  control, and one second is the right coarseness for finding a beat.
- **A focusable slider that ignores every key is an accessibility half-measure.** The
  mockup gives each handle `role="slider"` and `tabIndex={0}` and implements no
  keyboard operation at all, and US-01-10 does not cover it — that story is about
  space/s/f setting A and B, never about adjusting a *focused* handle. No story owned
  the gap, so this one takes it: the last criterion above.
- **Time is formatted with the app's own `formatDuration`** (`0:12`), not the mockup's
  `formatTime` (`00:12`). The app made that choice on the clip tiles and the player
  should not disagree with the grid it was opened from. A deliberate divergence, so
  review reads it as a decision rather than a fidelity miss.
- **The touch criterion is a smoke-test criterion.** jsdom implements `PointerEvent`
  but not `setPointerCapture`, and `getBoundingClientRect()` returns a width of 0, so
  neither *the page does not scroll* nor *the drag survives the finger leaving the
  handle* can fail in a unit test. Both are verified in a real browser. The consequence
  for the code is that the pixel→time mapping lives in a pure module and is tested
  there, which is where this codebase puts that kind of arithmetic anyway.

### Found at review, 2026-09-03 — BR-19

The drag criterion above held only for a loop that was **not running**, which is not
the state the player opens in. With looping on and the clip playing, the drag's seek
put the playhead on B and BR-07's enforcement read that as the loop having reached
its end, sending the clip to A on the next frame: the dancer dragged B and watched
the first two hundredths of the clip, over and over. The keyed route had it too, by
the same path through `movedTo`.

It is a rule rather than a bug fix, so it is written as one — **BR-19: enforcement
stands down while a boundary is under the dancer's hand.** The criterion added above
is what makes it reviewable, and the window's three closing edges (pointer-up,
key-up, blur) each have a test.

Worth recording that this **was** reachable in a unit test, unlike the touch pair
above. Nothing was missing from jsdom; the suite simply never combined *playing*,
*looping* and *a boundary being moved* in one test, and each of the three on its own
looks fully covered.
