# US-01-10: Keyboard shortcuts and the hint line

**Status:** APPROVED
**Use Case:** UC-01 — Loop a section of a clip
**Actor:** Dancer
**Priority:** TBD

## Story

As a dancer at a laptop, I want to set the loop points with the keyboard while
watching, so that I can mark the section as it goes past instead of stopping to
aim at a handle.

## Acceptance Criteria

- [ ] Given the player, when **space** is pressed, then the **next loop point is set at the current time** — A first, then B, then A again, alternating
- [ ] Given **space** sets A, when it takes effect, then **B parks at the end of the clip**, so what is on screen remains a valid, playable loop (BR-02), and **A lands exactly on the playhead** even if that leaves less than the minimum loop length before the parked B (BR-18 exception, settled at this story's gate)
- [ ] Given **space** sets B, when it takes effect, then B is never allowed closer to A than the minimum loop length
- [ ] Given **space** is pressed, when it takes effect, then the page does **not** scroll and any focused button is **not** activated
- [ ] Given the loop is half-set, when the dancer moves the **B handle** instead of pressing space again — by dragging it or with its arrow keys — then the loop is complete and space is re-armed to set **A** next (UC-01 alternate flow 11a)
- [ ] Given the player, when **f** is pressed, then zen mode toggles (US-01-12); when **Escape** is pressed, zen mode is left
- [ ] Given the caret is in a text field, when **space** or **f** is typed, then the character is typed and **no shortcut fires** (BR-05) — one gate at the top of the handler, so it already covers **s** when US-01-11 binds it
- [ ] Given a key is held down, when it auto-repeats, then the action fires **once**, not once per repeat
- [ ] Given a viewport wide enough to imply a keyboard, when the player renders, then a hint line names the shortcuts and **which point space will set next**; on a narrow viewport the hint is hidden
- [ ] Given a clip that has not decoded — or has not decoded **yet** — when any shortcut key is pressed, then nothing fires: there is no time to set and nothing to isolate

## Notes

- **Mockup:** `mockup/src/Player.jsx:334–389` (the key handler), `544–556` (the hint line), `406–410` (drag-to-complete), `257–263` (`Key`)
- **References:** UC-01 Basic Flow steps 9–10 and 17–18, alternate flows 11a and *a, BR-02, BR-03, BR-04, BR-05, BR-18
- **Not in this story:** the Save button and the saved list (US-01-11), zen mode's appearance (US-01-12), and dragging the handles generally (US-01-08).
- **Not in this story, moved at the approval gate (2026-09-03):** **saving by keyboard** — the `s` shortcut, its half-set refusal (BR-04), and the hint line's `s` segment — all now sit in **US-01-11**, which is where the save it would call is built. This story and US-01-11 block each other: `s` has nothing to save until the panel exists, and the panel's disabled-Save state has no half-set loop to render until space can make one. Building the half-set state here and the `s` key there leaves every criterion verifiable in the story that carries it, and means no hint line ever advertises a key that does nothing. The shared guard BR-04 demands is the `nextPoint` state introduced here, read by both.
- **Settled at the approval gate (2026-09-03):**
  - **BR-03 confirmed against real use, 🔍 cleared.** Space sets the loop points and is deliberately not play/pause. The bet on overriding the habit was tested by framing loops in the mockup for real, and it holds — play stays on the button and on the video itself
  - **BR-02 confirmed, 🔍 cleared.** B parks at the end of the clip when A is set
  - **BR-18 gains an exception here.** The mockup sets A straight onto the playhead with no floor, so a space pressed within 0.2 s of the end leaves a loop shorter than the minimum — and pressed on a clip that has run out, A and B coincide outright. Kept as mocked: the floor exists so the *handles* cannot cross, and honouring where the dancer actually pressed matters more than the length that leaves. The degenerate case is recoverable — touching either handle routes through `movedTo`, which floors it — and the next space press sets B through the same floor, so nothing crosses
  - **BR-04 and BR-05 confirmed as mocked, 🔍 cleared.** Half a loop is not a loop, refused in the button and the shortcut alike; shortcuts yield to typing
  - **The handler is gated on a ready clip**, as the mockup's `Number.isFinite(video.duration)` gates it. A clip that will not decode has no time to set and nothing to isolate
  - **Arrow-keying the B handle re-arms space as a drag does.** Both route through the slider's `onLoopChange`, and BR-03 makes the two ways of setting the points one state rather than two
- **Open questions:**
  - **None of this exists on a phone**, which is the device the tool is chiefly for. The hint line is hidden below `sm` and every shortcut needs its pointer equivalent to carry the whole job there — see UC-01, *The keyboard, and what it means on a phone*
- **Dependencies:** US-01-06 (a loaded clip), US-01-08 (the points it sets)
