# US-01-11: Saved loops panel

**Status:** APPROVED
**Use Case:** UC-01 — Loop a section of a clip
**Actor:** Dancer
**Priority:** TBD

## Story

As a dancer, I want to keep the loops worth returning to, so that tomorrow I can
pick up exactly where I left off instead of framing the same four seconds again.

## Acceptance Criteria

- [ ] Given a decoded clip, when the panel renders, then it shows a **SAVED LOOPS** heading, a name field, a **Save** action, and the list of loops saved against this clip
- [ ] Given a clip that will not decode, when the panel renders, then the heading stands alone — no field, no Save, no summary line — because there is no loop to save. Settled at this story's approval gate: the transport, the slider and the stepper are all gated on a ready clip already, and a Save button over a clip that cannot be played is the dead control US-01-07 refused to draw
- [ ] Given the name field is empty, when it renders, then it offers a default name of the form **Loop N**, where N is the **lowest number not already taken by a saved loop**, and saving with the field empty or whitespace-only accepts that default (BR-10)
- [ ] Given a complete loop, when **Save** is used, then the loop is appended to the list storing its **name, A, B and speed** (BR-09)
- [ ] Given the current loop, when the panel renders, then a line beneath the field states exactly what would be saved — the A and B times and the speed — reading `saves 0:03 - 0:07 · 1x`
- [ ] Given a **half-set** loop, when the panel renders, then **Save is disabled** and the line reads that B must be set to finish the loop (BR-04)
- [ ] Given the player, when **s** is pressed, then the current loop is saved under whatever name the field is showing — and is **refused on a half-set loop**, exactly as the Save button is, through the same guard (BR-04)
- [ ] Given the caret is in the name field, when **Enter** is pressed, then the loop is saved without the caret having to leave the field — and is refused on a half-set loop through that same guard
- [ ] Given the loop is half-set, when the hint line renders, then the **s** shortcut is shown as unavailable and the line explains that B must be set first
- [ ] Given a loop is saved, when the list re-renders, then the name field is **cleared** and ready for the next one
- [ ] Given each saved loop, when it renders, then it shows its name on one line and its `A – B · Nx` summary beneath, formatted as the summary line is
- [ ] Given the loop currently loaded, when the list renders, then **that entry is marked**, so the dancer can see where they are among several — an entry is current when its A, B **and** speed all match the player's, so reframing the loop drops the mark
- [ ] Given a saved loop, when it is tapped, then **A, B and the speed are all restored**, looping is turned on, and playback seeks to A (BR-09)
- [ ] Given a saved loop, when its remove control is used, then it leaves the list and the others are unaffected
- [ ] Given no loops are saved yet, when the panel renders, then it says what to do rather than showing an empty box
- [ ] Given a saved loop, when it is removed, then the removal cannot be triggered by accidentally tapping the loop itself — the two targets are distinct

## Acceptance Criteria — verified in the browser

- [ ] Given a loop name longer than the entry is wide, when the entry renders, then the name is **truncated on one line rather than wrapped**

## Acceptance Criteria — persistence (deferred to US-01-15, #44)

- [ ] Given a loop is saved, when the dancer leaves the clip and returns, then **the loop is still there** — **US-01-15**
- [ ] Given a loop is saved on one device, when the other device opens the same clip, then the loop is there too (BR-12) — **US-01-15**

## Notes

- **Mockup:** `mockup/src/Player.jsx:574–644` (the panel), `423–437` (saving and the half-set guard), `444–455` (recall, removal, and marking the current one), `544–556` (the hint line's `s` segment)
- **References:** UC-01 Basic Flow steps 17–22, BR-04, BR-09, BR-10, BR-12
- **Moved here at US-01-10's approval gate (2026-09-03):** saving **by keyboard** — the `s` shortcut, its half-set refusal, and the hint line's `s` segment. It was cut into US-01-10 with the other shortcuts, but `s` has nothing to call until this panel exists, and a hint advertising a dead key is worse than a hint with two rows. The guard BR-04 demands stays single: US-01-10 introduces the half-set state, and both the button and the key read it. US-01-10 builds the hint line; this story adds its third segment.
- **Not in this story:** setting the points being saved (US-01-08, US-01-10), and the other shortcuts — space, `f` and Escape — which stay in US-01-10.

### Settled at this story's approval gate (2026-09-03)

- **`Loop N` is the lowest unused number, not `saved.length + 1`.** The mockup offers `Loop ${saved.length + 1}`, which collides: save three, delete the first two, and the next default is `Loop 2` — a name already on the list. A monotonic counter avoids the collision but gaps, and resets on reload — so once US-01-15 restores loops from Drive it would start at 1 and collide anyway. Reading the lowest unused number off the names already saved is the only one of the three that is right after a removal *and* after a reload.
- **Times come from the app's existing `formatDuration` (`app/src/clips/format.ts`)**, giving `0:03 - 0:07 · 1x`. The mockup has its own `formatTime`, which floors and zero-pads the minutes (`00:03`). Reusing the app's keeps one formatter: it is already what the clip tiles print and what the loop slider announces through `aria-valuetext`, so the time a dancer reads off this panel is written the same way as the time the handle they dragged reports. Tenths were considered — whole seconds are coarse on a 2–4 s loop, where 3.4 s and 3.9 s both round into neighbouring whole seconds — and declined for now: it is a busier line and a second formatter, and nothing downstream needs the precision.
- **`Enter` saves from the name field.** This story adds the player's **first text field**, so it is the first time BR-05 costs anything: with the caret in the box, `s` types an `s`. Without Enter the naming flow is type-then-click-away-then-press, or type-then-reach-for-the-mouse. Enter is not a global shortcut, so BR-05 is untouched and no new gate is added to the key handler; it reads the same half-set guard the button and `s` do, keeping BR-04's single guard single.
- **An entry is marked by value, as mocked** — its A, B and speed all matching the player's — rather than by remembering which entry was last tapped. Value equality goes stale in the only direction that is honest: reframe the loop and the mark leaves, because the dancer is no longer on that loop. Tracking the recalled id would leave an entry claiming to be where they are after they had dragged both handles somewhere else. The cost accepted: two saved loops with identical points and speed both mark.
- **Saved loops carry a `crypto.randomUUID()` id.** The mockup uses a session counter, which is fine as a React key and wrong the moment US-01-15 writes these to Drive: the counter resets on reload and runs independently on each device, so the laptop's `1` and the phone's `1` are different loops with the same id. A UUID costs nothing now and is the id #44 would have to introduce anyway.
- **Truncation is checked in the browser, not by a test.** "Truncated rather than wrapped" is a CSS class with no behavioural surface — jsdom lays nothing out, so the only assertion available is on the class name, which tests the implementation rather than the outcome. It is listed under its own heading above so it is checked rather than quietly dropped.

### Open questions (unchanged)

- **The two persistence criteria are not met by the mockup at all**, whose list is in-memory and dies with the screen. They are delivered by **US-01-15 (Loops in Drive, #44)** — so expect to build the panel and leave those two unticked. That is this story's intended state on its own, not a defect in it. **Where and when a loop is written** remains UC-01 Q-03
- **Two devices will clobber each other**: `loops.json` is last-write-wins, and laptop-then-phone is the normal pattern here, not an edge case (UC-01 Q-05)
- **An export and restore is wanted** (UC-01 Q-06) — the loops are the asset and would otherwise exist in exactly one place
- Saved loops have **no order but insertion order**, and no rename. With a dozen on one clip that will bite

- **Dependencies:** US-01-05 (the region), US-01-08 (the loop being saved), **US-01-10** (the half-set state this story's guard reads, and the hint line it adds a segment to — added at this story's approval gate, having been implied by the note above but missing from this line)
