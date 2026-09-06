# US-01-06: Video surface and playback

**Status:** APPROVED
**Use Case:** UC-01 — Loop a section of a clip
**Actor:** Dancer
**Priority:** TBD

## Story

As a dancer, I want the clip to play and pause with the least possible ceremony,
so that starting and stopping never interrupts what I am trying to watch.

## Acceptance Criteria

- [ ] Given a clip is opened, when its metadata loads, then the loop is set to span the **whole decoded clip** — A at 0 and B at the clip's **own** duration, rather than the length the tile carried in (BR-01)
- [ ] Given a clip is opened, when its metadata loads, then **looping is already on** — the player opens ready to loop, with nothing to arm first (BR-01)
- [ ] Given the clip is playing, when the dancer taps the video, then it pauses; when they tap again, it plays
- [ ] Given playback starts or stops **by any route**, when the state changes, then the player's idea of whether it is playing follows the video's **own play and pause events** — so a control added later (US-01-07) cannot disagree with what is on screen
- [ ] 👁 Given a clip on a phone, when it plays, then it plays **inline** and does not take over the screen in the native full-screen player
- [ ] Given a clip the browser **cannot decode**, when the error surfaces, then the clip surface is replaced by a plain statement that it could not be played, and the header's **Clips** link stays as the way back (UC-01 exception 6a)

## Notes

- **Mockup:** `mockup/src/Player.jsx:497–510` (the video element and its sizing), `391–396` (metadata, and the initial loop), `412–416` (play/pause)
- **References:** UC-01 Basic Flow steps 7–8, exception 6a, BR-01
- **Not in this story:** the transport buttons (US-01-07), loop enforcement (US-01-07), and the speed applied to playback (US-01-09).
- **Dependencies:** US-01-05 (the surface it renders into)

### Settled at the approval gate (2026-09-01)

- **The decode failure gets a message, and the header is the way back.** The mockup
  fails silently — duration stays `00:00`, the handles sit on top of each other, Save
  offers `00:00 – 00:00` — which UC-01 recorded as exception 6a because it was reached
  by accident during derivation, not because anyone chose it. The Drive download path
  makes a failed or partial fetch likelier in the product than a local file suggests,
  so silence is the wrong default. **A departure from the mockup, deliberately:** the
  mockup is the visual reference and it does not cover this state, so no fidelity
  finding follows from the difference. UC-01 exception 6a and **Q-02** are rewritten to
  match; a bounce back to the grid was rejected as indistinguishable from a mis-tap,
  and a second Back control as redundant beside the header's.
- **Audio has no in-app control, and that is the decision.** The device's own volume is
  the control — hardware keys on the phone, the system slider on a laptop — and a mute
  toggle would be new surface with no mockup behind it. Playback stays unmuted; every
  play here is user-initiated, so no autoplay policy applies. The spec's open question
  about muting is closed, not deferred.
- **Two criteria stopped naming controls that do not exist yet.** The first and fourth
  previously read "every control that depends on it becomes live" and "every control
  that reflects it agrees — the transport button included". Neither names anything this
  story ships: checked against the mockup, **duration renders nowhere on the player** —
  it feeds `LoopSlider`'s `aria-valuemax` and handle positions (US-01-08) and the loop's
  B, which the Save summary shows (US-01-11). Both are now written against what this
  story actually pins, with the downstream controls named here in Notes instead. The
  behaviour is unchanged; only the claim is.
- **The playback rules were confirmed by eye at this gate.** UC-01's preamble is
  explicit that live playback was never watched during derivation — the clip never
  decoded in the automated tab, which is the same failure exception 6a describes. Every
  rule this story rests on was therefore read off the mockup's code, so the whole story
  is 🔍-class even though the BR table marks none of it. Confirmed here per Q-01.

### 👁 — criteria verified by eye, not by test

One criterion is a real-device observation. jsdom implements no media stack, so
`playsInline` is only ever an attribute to it — the attribute *is* asserted, but whether
iOS then declines to hijack the screen is a thing to watch on a phone, not in a test.
It is marked 👁 and confirmed in a real browser, per the precedent set in US-01-01 and
US-01-05. **A missing test against a 👁 criterion is not a TDD gap.**

The other five are testable, including tap-to-play. jsdom leaves `play()` and `pause()`
unimplemented, so the tests stand up a media element that behaves as a browser's does —
`paused` flips, `loadedmetadata` and `error` fire — and then assert on the outcome
(*the video is playing*) rather than on the call. That keeps the assertions behavioural
where a spy on `play` would have pinned the implementation.
