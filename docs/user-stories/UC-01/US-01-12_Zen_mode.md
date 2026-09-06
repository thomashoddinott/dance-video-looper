# US-01-12: Zen mode

**Status:** APPROVED
**Use Case:** UC-01 — Loop a section of a clip
**Actor:** Dancer
**Priority:** TBD

## Story

As a dancer, I want to put the clip alone on the screen while it loops, so that
once the section is framed there is nothing left to look at but the movement.

## Acceptance Criteria

- [ ] Given the player, when the **expand control on the video** is used, then the clip fills the screen on a black background and **every control is hidden**, including the header — the close control excepted, which the sixth criterion requires
- [ ] Given zen mode, when it renders, then the clip is shown **as large as the viewport allows without being upscaled or cropped** — the whole frame stays visible
- [ ] Given zen mode, when it is entered or left, then **the clip does not reload and playback does not restart** — the position being watched is preserved across the toggle
- [ ] Given zen mode is entered or left, when the tree re-renders, then the controls are **hidden rather than unmounted** and the clip is the **same element** throughout — the appearance changes, the tree does not (BR-08)
- [ ] Given zen mode, when the loop is running, then **it keeps running**, unchanged
- [ ] Given zen mode, when the **close control on the video** is used, then the controls return in the state they were left
- [ ] Given zen mode, when it renders, then a control to leave it is **visible on the video itself**, so a dancer who does not know the shortcut is not trapped
- [ ] Given zen mode is entered while the clip is playing, when it renders, then playback continues uninterrupted

## Notes

- **Mockup:** `mockup/src/Player.jsx:481–523` (the two appearances of one tree), `76–90` (the expand and close glyphs), `355–366` (the `f` and `Escape` handling)
- **References:** UC-01 Basic Flow step 16, alternate flow 16a, BR-08
- **Not in this story:** the shortcut keys themselves, which are specified together in
  US-01-10 — including `f` and `Escape`. This story owns the appearance, the
  expand/close control, and the guarantee that the clip survives the toggle; US-01-10
  wires the keys to the toggle this story exposes. Settled at this gate, 2026-09-03:
  the criteria here previously fired on `f`/`Escape` while these notes disclaimed them,
  **and US-01-10's own criteria claimed the same two keys** — the two specs agreed in
  prose and contradicted each other in criteria. One story owns the keyboard, so the
  typing guard (BR-05) and the auto-repeat guard are written once. The consequence is
  accepted: until #26 lands, zen mode is reachable by the control only.
- **The load-bearing criterion is the fourth**, and it constrains the implementation more
  than it looks: the mockup restyles one element rather than rendering a second tree, on
  the grounds that moving the video in the page would remount it and lose the position.
  A future refactor that "simplifies" this into two branches would silently break the
  story. Confirmed as BR-08 at this gate, and given a criterion of its own so a reviewer
  can check it rather than infer it.
- **Built out of order**, 2026-09-03: US-01-07 through US-01-11 were all open when this
  was cut, so the controls this story hides did not exist yet. It was buildable anyway —
  the player renders its five control regions as named empty elements, so *hidden rather
  than unmounted* was testable from the start, and the later stories fill regions zen
  mode already hides rather than needing rework.
  **Borne out at review**: US-01-07 (#23) landed on `main` while !63 was being reviewed,
  filling the Transport region with three live controls. Zen mode needed no rework to
  hide them — the wrapper it already put around all five took them out unchanged. The
  prediction in this note is the one that made the out-of-order build defensible, so it
  is worth recording that it held.
- **Open questions:**
  - Zen mode is **not the browser's native full-screen**, so on a phone the browser
    chrome may still be present and the screen may still sleep. Parked at this gate as
    UC-01 **Q-14** rather than answered here: on iOS the only full-screen route for a
    clip is the native player, which takes the loop UI with it and so contradicts BR-08.
    That makes it a design decision of its own, not an addition to this story.
    Ticketed as #62
- **Dependencies:** US-01-05 (the player), US-01-06 (the clip that keeps playing)
