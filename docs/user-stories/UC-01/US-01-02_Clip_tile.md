# US-01-02: Clip tile

**Status:** APPROVED
**Use Case:** UC-01 — Loop a section of a clip
**Actor:** Dancer
**Priority:** TBD

## Story

As a dancer, I want each clip drawn as a tile I can recognise at a glance, so that
I can find the one I am working on without reading a list of filenames.

## Acceptance Criteria

- [ ] Given a clip whose duration is known, when its tile renders, then its **duration** is shown as `m:ss`
- [ ] Given a clip whose duration is not known, when its tile renders, then **no duration is shown** — not `0:00`, and never `NaN:NaN` (UC-01 exception 6a)
- [ ] Given a clip, when its tile renders, then beneath the poster it shows the clip's **name** and the **date it was added** as `d MMM`
- [ ] Given a clip with saved loops, when its tile renders, then the **count** is shown after the name in parentheses
- [ ] Given a clip with no saved loops, when its tile renders, then **no count is shown** — not `(0)`
- [ ] Given a tile, when the dancer taps anywhere on it, then the app navigates to that clip's own route; what renders there is US-01-05's
- [ ] Given a clip with no poster to draw from, or one whose poster fails to load, when its tile renders, then a **neutral placeholder** stands in — and it never shows the clip's id
- [ ] 👁 Given a clip, when its tile renders, then the poster sits in a 9:16 portrait box with rounded corners on a black backing
- [ ] 👁 Given a clip whose duration is known, when its tile renders, then the duration sits in the **bottom-right corner** of the poster, legible against whatever frame is behind it
- [ ] 👁 Given a clip, when its tile renders, then the name is **truncated to one line** rather than wrapped, and the loop count is in a **lighter weight** than the name
- [ ] 👁 Given a tile, when it is hovered on a device that has hover, then the poster dims slightly to signal it is pressable
- [ ] 👁 Given a tile showing the placeholder, when it renders, then it stays the same size as any other tile, so the grid does not reflow

## Notes

- **Mockup:** `mockup/src/Library.jsx:22–66` (`Thumbnail` and `ClipTile`), `9–20` (the duration and date formatters)
- **References:** UC-01 Basic Flow step 3, exception 6a
- **Not in this story:** the order tiles appear in (US-01-03), and what the player does once opened (US-01-05). Deleting or renaming a clip is not in this story or any other — see UC-01 Q-08.
- **Dependencies:** US-01-01 (the grid it sits in)

### 👁 — criteria verified by eye, not by test

Five criteria are pure CSS. jsdom has no layout engine, so an aspect ratio, a corner
radius, a `truncate`, a font weight and a hover state are strings to it, and the only
unit test available asserts the class attribute — which pins the implementation rather
than the behaviour. They are marked 👁 and verified in a real browser instead, per the
convention US-01-01 set. **A missing test against a 👁 criterion is not a TDD gap.**

This story is unusually 👁-heavy because it is unusually visual: what is testable is the
tile's *content* (which strings appear, and which deliberately do not) and its *tap*.
How that content is arranged is not.

### Decisions taken at the planning gate

- **Tapping a tile navigates; it does not open a player.** US-01-05 (#21) is unstarted,
  so "the player opens" has nothing behind it. This story owns the tap and the route
  change to the clip's own path; what renders there is #21's. The criterion stays
  testable now rather than being deferred with the story it depends on.
- **The placeholder never shows the clip's id.** The mockup renders `clip.id` at
  `text-3xl` (`Library.jsx:35–39`), which reads well for fixtures numbered `1` and `2`
  and would put a Drive file id on screen in the product.
- **The placeholder covers two failures, not one.** The mockup branches on a *missing*
  `src` only; a clip that has one and fails to decode gets a broken `<video>` and no
  fallback — which is the case the criterion actually names. Both route to the
  placeholder.
- **An unknown duration shows nothing.** `formatDuration` (`Library.jsx:9–13`) rounds
  without a guard, so an absent length renders `NaN:NaN`. UC-01 exception 6a already
  establishes the clip whose metadata never arrives. A wrong number is worse than no
  number; the badge is omitted.
- **The poster is still derived by seeking, as the mockup does.** See the open question
  below — it is recorded, not resolved, and the decision belongs with caching.
- **The date carries no year**, matching the mockup. A clip added last August reads the
  same as one added this August. Accepted: the library is small and recent.
- **This story introduces the `Clip` type**, and renders tiles from data passed in.
  There is no data source in `app/` yet — US-01-01 landed an empty list — so a fixture
  stands in until Drive arrives (US-01-14, US-01-15).

### Open questions

- The poster is derived by seeking the video to `#t=3` (`Library.jsx:27`), which costs a
  metadata fetch per tile and lands on a black frame for a clip that opens on a dark
  shot — observed during UC-01's derivation. A stored thumbnail would avoid both, but
  the app has nowhere to put one that the `drive.file` scope can see cheaply.
  **Deferred to US-01-14 / US-01-16**, where the caching and Drive-layout decisions
  actually live. Following the mockup here does not commit the product to it.
