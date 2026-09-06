# US-01-07: Transport controls and loop enforcement

**Status:** APPROVED
**Use Case:** UC-01 — Loop a section of a clip
**Actor:** Dancer
**Priority:** TBD

## Story

As a dancer, I want the section to repeat on its own and to be able to restart it
instantly, so that I can keep dancing instead of operating the app.

## Acceptance Criteria

- [ ] Given the player, when it renders, then the **Transport** toolbar offers exactly three controls, side by side and in this order: **START**, **LOOPING**, **PLAY / PAUSE**
- [ ] 👁 Given the transport renders, when it is looked at, then each control is at least **64 px on its shortest side** — big enough to hit without looking (the mockup's `h-16 w-24`)
- [ ] Given a clip whose metadata has arrived, when the player opens, then **looping is already on and the region spans the whole clip** — A at 0, B at the clip's duration — so pressing play immediately does the thing the app is for (BR-01)
- [ ] Given looping is on and B is after A, when playback reaches **B**, then it returns to **A** and continues, indefinitely
- [ ] Given looping is on and the clip is playing, when the return is enforced, then it is driven **per animation frame**, not by the video's own `timeupdate` events (~4 Hz), which are far too coarse for a short loop (BR-07)
- [ ] 👁 Given a loop of a few seconds, when it returns, then the return does not read as a stutter at the loop point
- [ ] Given the clip is paused, **or** looping is off, when time passes, then **no enforcement is scheduled at all** — the callback is not running (BR-07)
- [ ] Given **LOOPING** is active, when it renders, then it is visually distinct from the other two and its label reads **LOOPING**; when inactive it reads **START LOOP**
- [ ] Given looping is turned off, when playback reaches B, then it continues past it to the end of the clip
- [ ] Given **START** is pressed, when it takes effect, then playback jumps to **A** without changing whether the clip is playing and without turning looping off
- [ ] Given the clip is playing, when the transport renders, then its third control reads **PAUSE**; when paused, **PLAY** — driven by the element's own `play` and `pause` events, so the label stays right when playback stops for a reason the app never triggered
- [ ] Given a ready region can only be constructed by `decoded()`, when it is ready, then **B is always after A** — so no invalid loop can reach the enforcement at all, and there is deliberately no runtime guard against one

## Notes

- **Mockup:** `mockup/src/Player.jsx:558–572` (the three controls), `265–284` (`BigButton`), `312–328` (the enforcement itself), `391–395` (the region seeded to the whole clip on metadata)
- **References:** UC-01 Basic Flow steps 14–15, BR-01, BR-07
- **Not in this story:** setting A and B **by hand**, by any means (US-01-08 by dragging, US-01-10 by keyboard), nor building the region at all — US-01-06 already seeds it. This story consumes it, and draws nothing in the `Loop range` group, which stays empty for US-01-08.
- **Dependencies:** US-01-05 (the player skeleton, and the empty `Transport` toolbar this fills), US-01-06 (the video surface to enforce against)

### Criteria settled at the approval gate

The draft carried eight criteria; twelve came out. What changed, and why:

- **The draft said this story "loops between whatever points it is given", and left who
  gives them unanswered.** Taken literally, four of the eight criteria had no way to be
  shown working, because US-01-08 and US-01-10 — the two stories that let the dancer set
  A and B — both come later. The answer was already written down twice and the draft
  cited neither: **BR-01 is not 🔍 and settles it** — *"The player opens ready to loop.
  Looping is on, and A/B span the whole clip"* — and **US-01-06 has already built it**.
  `playback.ts` carries a `Loop` type and a `ready` state holding `loop` and `looping`,
  and `decoded()` seeds `{ a: 0, b: duration }` with `looping: true`, citing BR-01 by
  name and pinned by `playback.test.ts`. The mockup agrees (`Player.jsx:394`). So the
  region is not built here at all: this story **consumes** it, toggles it, and enforces
  it, and US-01-08 later replaces the seeding with dragging.
- **"Each big enough to hit without looking" was not verifiable.** jsdom computes no
  layout, so no unit test can measure a rendered control. It split into the half a test
  can hold — the toolbar offers exactly these three, in this order — and a 👁 half with a
  number attached (64 px, the mockup's `h-16`), which a driven smoke test can measure
  with `boundingBox()` even though jsdom cannot.
- **"Tight enough not to be seen" was a judgement, not a criterion.** It split the same
  way: the mechanism is testable and is now stated as BR-07 settles it, and the
  smoothness itself is 👁.
- **The idle case became its own criterion.** BR-07's own open question was battery, and
  "enforced per animation frame" says nothing about when the frames stop. It is now
  written down as an outcome — paused or not looping means nothing is scheduled — rather
  than left as an implementation detail nobody would notice regressing.
- **The PLAY/PAUSE label names its source.** See below.

### BR-07 — settled (🔍 cleared)

Enforcement is **per animation frame, and only while playing and looping**.

The per-frame half is the mockup's technique (`Player.jsx:312–328`) and the only one
known to meet the criterion: `timeupdate` fires at roughly 4 Hz, and the spike measured
**86 ms worst-case overshoot** on a tight 2 s loop, which is visible.

The change from the mockup is the gate. The mockup subscribes once with `[]` and never
unsubscribes, so the callback runs for as long as the player is open whatever the clip is
doing — which is the battery cost the UC flagged and nobody measured. Gating on
`playing && looping` costs nothing in tightness, because a paused clip has no overshoot to
correct, and it answers the open question by removing the cost rather than measuring it.

`requestVideoFrameCallback` was considered and declined: it is the better instrument —
per decoded frame, naturally idle when paused — but Firefox does not implement it, so it
needs an rAF fallback, and the fallback would be the path no one exercises.

### The PLAY/PAUSE label, and what US-01-06 already decided

US-01-06 deliberately keeps **no** `playing` flag: `PlayerScreen.tsx:7–10` reads the
element on every toggle, because *"playback stops for reasons the app never hears about —
the clip ends, the phone takes a call — and a second copy of the answer would be wrong by
then."*

This story needs the screen to know, in order to label the button. That is not a reversal
of the above, and must not be implemented as one: the label is driven by the element's own
`play` and `pause` **events**, so it is still the element that is the source of truth and
the flag cannot drift from it. A flag set by the click handler would be exactly the second
copy US-01-06 refused, and would read `PAUSE` on a clip that had already ended.

The rAF gate reads the same state, which is why it is honest to keep: it stops when
playback stops for any reason, not only when the dancer pressed pause.

### Decisions taken at the planning gate

- **The transport needs a ref to the video element.** US-01-06 toggles playback from the
  video's own `onClick`, so it never needed one. A button outside the element cannot do
  that, and neither can the enforcement loop, which has to read and write `currentTime`.
- **The enforcement is not extracted into a pure function.** `clipProbe` and `fileClip`
  were pulled out because jsdom could not reach them; here a screen test with fake timers
  drives the whole thing, so a `returnPoint()` module would exist to satisfy a pattern
  rather than a need. The condition stays in the effect, which is where the only real
  complexity — when to subscribe and when to stop — lives anyway.
- **No `b > a` guard in the loop.** `ready` is only constructible through `decoded()`,
  which always yields `b > a`, so a guard would be unreachable and any test for it dead.
  US-01-08 is the story that first makes the invalid region reachable, by letting B be
  dragged behind A, and the guard belongs with the code that can violate the invariant.

### 👁 — criteria verified by eye, not by test

Two, both split out of criteria that were unverifiable as drafted: the controls' rendered
size, and whether the return reads as a stutter. Both are measurable in a **driven** smoke
test even though jsdom cannot reach them — the control's `boundingBox()`, and the
overshoot past B sampled off a real `currentTime`. **A missing unit test against a 👁
criterion is not a TDD gap.**
