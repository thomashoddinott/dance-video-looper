# US-01-05: Player skeleton

**Status:** APPROVED
**Use Case:** UC-01 — Loop a section of a clip
**Actor:** Dancer
**Priority:** TBD

## Story

As a dancer, I want opening a clip to take me to a screen built around that clip,
so that everything I need to work on it is in one place and nothing else is.

## Acceptance Criteria

- [ ] Given a clip is opened from the grid, when the player renders, then it shows a header carrying a **back control whose visible label is Clips** and the **clip's name** beside it
- [ ] 👁 Given a clip whose name is longer than the header, when it renders, then the name is **truncated rather than wrapped**, so the header stays one row
- [ ] Given the player, when the back control is used, then the Clips screen returns
- [ ] 👁 Given the player, when it renders, then the clip sits in a card that **hugs the clip's own shape** — a portrait clip gets a narrow card, a landscape one a wide card
- [ ] Given the player, when it renders, then it lays out — in this document order — the clip card, the region for the seek and speed row (US-01-08, US-01-09), the loop slider (US-01-08), the keyboard hint (US-01-10), the transport buttons (US-01-07) and the saved-loops panel (US-01-11)
- [ ] 👁 Given a clip that is taller than the viewport, when the card renders, then the clip is **shrunk to fit and never upscaled or stretched** (BR-16)
- [ ] 👁 Given the player on a laptop, when it renders, then the clip is allowed more height than on a phone (50vh / 80vh), so a portrait clip is not needlessly small on a large screen

## Notes

- **Mockup:** `mockup/src/Player.jsx:457–474` (header), `476–520` (the card and the video's sizing rules), `286–298` (the state the screen is built around)
- **References:** UC-01 Basic Flow steps 6–7 and 23, BR-16
- **Not in this story:** every control that drops into the reserved regions — they are placeholders here. Playback itself is US-01-06.
- **Open questions:** leaving the player **discards an unsaved loop without warning** (UC-01 Q-04). Since the loops are the asset, that may be wrong, but the mockup does not treat it as an error and this story does not change it. It cannot bite in this story, which holds no loop state at all
- **Dependencies:** US-01-02 (the tile that opens it) — **currently blocking, see below**

### 👁 — criteria verified by eye, not by test

Four criteria are pure layout. jsdom has no layout engine, so truncation, a card that
hugs its content, a max-height cap and a breakpoint are all just strings to it, and the
only unit test available asserts the class attribute — which pins the implementation
rather than the behaviour. They are marked 👁 and verified in a real browser at phone
and laptop widths instead, per the precedent set in US-01-01. **A missing test against a
👁 criterion is not a TDD gap.**

This story is mostly layout, so the 👁 share is high — four of seven. That is inherent
to a skeleton whose whole job is shape, not a shortfall in the story.

#### What was observed, 2026-09-01

| Criterion | Measured |
|---|---|
| Name truncates rather than wraps | `nowrap` / `hidden` / `ellipsis`; at 390px the name overflows its box (375px of text in 289px) and the header stays one row at 52px |
| Card hugs the clip's shape | One rule, three shapes: a 720×1280 clip gives a **385px** card, a 1280×720 clip **1113px**, a 200×200 clip **248px** |
| Never upscaled or stretched (BR-16) | The 200×200 clip renders at exactly 200×200 rather than filling the card, and the rendered aspect ratio matches the intrinsic one in every case |
| More height on a laptop than a phone | The cap resolves to `374.5px` at base and `599.2px` from `lg` on a 749px-tall viewport — 50vh and 80vh exactly |

**The real `<video>` never decoded**, so the shape figures were measured with an image
proxy carrying the video element's exact class list. Chrome will not decode video in a
background tab (`visibilityState: hidden`, `readyState: 0`), which is a known limit of
the automation, hit twice before and a third time here. The
proxy answers the layout question faithfully — `max-h`, `max-w` and `w-fit` do not care
what kind of element they size — but **the clip itself has not been watched on screen**.
That belongs to the review's smoke test.

### Blocked on US-01-02 — resolved

The gate was run on 2026-09-01 and **stopped**: US-01-02 had a branch with no commits,
so `main` had no clip tile, no clip model and no route. AC 1 says *"given a clip is
opened from the grid"* and there was no grid to open from. A stub clip fixture behind an
invented `/clips/:clipId` was considered and rejected — it would have put the URL shape
in the hands of the skeleton rather than the story that owns clips.

US-01-02 landed the same day (`b36c3e2`, !51) and settled all three: the `Clip` type,
the `sampleClips` fixture, and the route. **Unblocked, and the rejection was vindicated
— US-01-02 chose `/clip/:clipId`, not the `/clips/:clipId` the stub would have
established.**

### Decisions taken at the planning gate

- **BR-16 confirmed**, and with it the mockup's 50vh phone / 80vh laptop caps. The rule
  drops its 🔍 in UC-01. Never upscaled, never stretched, nothing assuming 9:16.
- **The four layout criteria are 👁**, verified by eye rather than by unit test.
  Playwright was offered and declined for now — it stays the thing that would retire the
  👁 marks if it is ever set up.
- **The back control keeps the mockup's markup** — `aria-label="Back to clips"` over the
  visible text `Clips` (`mockup/src/Player.jsx:465–471`). AC 1 previously said the
  control was *"labelled Clips"*, which reads as the accessible name and would send a
  test looking for the wrong string; it now says *visible* label.
- **The reserved regions are asserted by document order**, not by their emptiness — a
  region that renders nothing is unobservable. Each needs an accessible name, and
  `inDocumentOrder` (`app/src/App.test.tsx:10`) already does the assertion.
- **AC 1 was split in two.** The testable half (the header carries the control and the
  name) is now separate from the 👁 half (the name truncates). The old single criterion
  repeated the defect caught in review on US-01-01's AC 2, where a layout claim
  buried inside a structural one turned out to be unverifiable as written.

### Decisions taken at the second gate, once US-01-02 had landed

- **The route is `/clip/:clipId`**, taken from `ClipTile.tsx:10` rather than chosen.
  US-01-02 already ships tiles that link there, so the path is settled and this story
  puts a screen behind a link that currently resolves to nothing.
- **The `<video>` element belongs to this story, not US-01-06.** Three of the criteria
  are about how the clip is sized, so the thing being sized has to exist. US-01-06 owns
  making it *play* — loading, metadata, duration, the transport — and this story renders
  it inert.
- **An unknown `:clipId` returns to the Clips screen.** Neither the story nor UC-01
  covers a path that matches no clip, but a route parameter is user-editable and
  `/clip/nonsense` has to do something. Redirecting is the smallest defensible answer
  and needs no screen that the mockup has never drawn. Recorded rather than assumed —
  overturn it here if a not-found screen is wanted.
- **The committed fixture stays `src`-less**, as US-01-02 left it, so the player renders
  a video with no source in a fresh clone. The 👁 pass needs a real portrait clip *and* a
  real landscape one: `app/public/*.mp4` is gitignored (added by US-01-02 for exactly
  this), so the files are dropped in locally and a `src` is pointed at them by hand for
  the browser check. **This means the 👁 criteria are verified against local files that
  CI-less verification cannot reproduce** — which is the honest position, not a gap to
  paper over.
