# UC-01 — user stories

Eighteen stories for [UC-01: Loop a section of a clip](../../use-cases/UC-01_Loop_a_section_of_a_clip.md).
All **DRAFT**. Generation 1, so the numbers below are the only ones in play.

**Thirteen are cut from the mockup** — two pages, each a skeleton plus the components
that drop into it. **Five are storage stories** with no mockup surface at all, which
the method allows as *non-component stories*: cross-cutting concerns that span the
others and are independently testable. Google Drive is the textbook case, since it
is what every one of the thirteen is quietly assuming.

Two were added later than the original sixteen. **US-01-17** on 2026-09-04, when the
spike behind UC-01 Q-07 returned GO — a storage story by the same test: no surface,
and it changes what every clip *is* on its way to Drive. **US-01-18** on 2026-09-06,
once the library grew past the size US-01-03 had judged search against — a Clips
screen component, and a **mockup gate pass**, since it is built before it is drawn.

## Clips screen — `mockup/src/Library.jsx`

| Story | Title | Mockup | Ticket |
|-------|-------|--------|--------|
| [US-01-01](US-01-01_Clips_screen_skeleton.md) | Clips screen skeleton | `Library.jsx:131–182` | #17 |
| [US-01-02](US-01-02_Clip_tile.md) | Clip tile | `Library.jsx:22–66` | #18 |
| [US-01-03](US-01-03_Ordering_chips.md) | Ordering chips | `Library.jsx:152–167` | #19 |
| [US-01-04](US-01-04_Add_a_clip.md) | Add a clip | `Library.jsx:108–129` | #20 |
| [US-01-18](US-01-18_Search_the_clips.md) | Search the clips | `Library.jsx:350–361` — retrofitted | #13 |

## Player — `mockup/src/Player.jsx`

| Story | Title | Mockup | Ticket |
|-------|-------|--------|--------|
| [US-01-05](US-01-05_Player_skeleton.md) | Player skeleton | `Player.jsx:457–520` | #21 |
| [US-01-06](US-01-06_Video_surface_and_playback.md) | Video surface and playback | `Player.jsx:497–510` | #22 |
| [US-01-07](US-01-07_Transport_controls_and_loop_enforcement.md) | Transport controls and loop enforcement | `Player.jsx:558–572`, `312–328` | #23 |
| [US-01-08](US-01-08_Loop_slider.md) | Loop slider | `Player.jsx:151–255` | #24 |
| [US-01-09](US-01-09_Speed_stepper.md) | Speed stepper | `Player.jsx:119–149` | #25 |
| [US-01-10](US-01-10_Keyboard_shortcuts.md) | Keyboard shortcuts and the hint line | `Player.jsx:334–389` | #26 |
| [US-01-11](US-01-11_Saved_loops_panel.md) | Saved loops panel | `Player.jsx:574–644` | #27 |
| [US-01-12](US-01-12_Zen_mode.md) | Zen mode | `Player.jsx:481–523` | #28 |

## Storage — no mockup surface

Non-component stories. The mockup has no Drive in it: it holds a local object URL for
an added clip and keeps saved loops in memory, where they die with the screen. These
four are what make the twelve above true rather than a demonstration.

| Story | Title | Makes real | Ticket |
|-------|-------|-----------|--------|
| [US-01-13](US-01-13_Google_sign_in_and_the_Drive_session.md) | Google sign-in and the Drive session | the other three | #42 |
| [US-01-14](US-01-14_Clips_in_Drive.md) | Clips in Drive | US-01-01, US-01-02, US-01-04 | #43 |
| [US-01-15](US-01-15_Loops_in_Drive.md) | Loops in Drive | **US-01-11** | #44 |
| [US-01-16](US-01-16_Cache_first_playback.md) | Cache-first playback | every clip open | #45 |
| [US-01-17](US-01-17_Compress_before_upload.md) | Compress before upload | the 15 GB quota | #73 |

**Order matters here.** US-01-13 comes first because the other three need its session.
US-01-16 comes last because it caches what the middle two fetch — and shipping it late
means the intervening stories will feel slow, at seven seconds per clip open, which is
expected rather than a defect.

**One gate sits in front of all four:** whether OAuth works on a phone is the single
question the spike could not answer, and it needs a deployed HTTPS origin to settle
(US-01-13, UC-01 Q-10). If it fails, this section is redesigned.

## Buckets, and what can actually run in parallel

The sixteen carry a bucket label on GitHub: **`bucket-1-clips`** (US-01-01…04),
**`bucket-2-player`** (US-01-05…12), **`bucket-3-storage`** (US-01-13…16). The
grouping matches the cut — two pages and the storage layer beneath them.

They are **not** three independent lanes, and the dependency lines in each spec say
why:

```
scaffolding (inside US-01-01)
   ├── bucket 1 ──┐
   ├── bucket 2 ──┼──► US-01-14, US-01-15 ──► US-01-16
   └── US-01-13 ──┘
```

- **Bucket 3 is mostly downstream.** US-01-14 needs US-01-01 and US-01-04, US-01-15
  needs US-01-11, and US-01-16 needs both of those.
- **US-01-13 is the exception and should start first.** It depends on nothing, and it
  carries the mobile-OAuth gate — the one question the spike could not answer. If that
  fails, the storage design changes, so finding out early is worth more than finishing
  a page.
- **Buckets 1 and 2 touch once:** US-01-05 depends on US-01-02, the tile that opens the
  player. That edge is soft — make the player reachable without the real tile and the
  two pages are genuinely parallel.
- **Nothing starts until the app exists.** The repo has a mockup and no product code,
  no TypeScript and no test runner, while CLAUDE.md makes TDD non-negotiable. That
  scaffolding is **absorbed into US-01-01** — decided at its planning gate. It
  deliberately carries **no acceptance criterion of its own**: the story's criteria
  stay about the Clips screen, and the scaffolding is judged on whether the choices
  are sound, with a green build as its floor. The cost is that the first story of the
  set is not reviewable purely as a piece of UI; the alternative was a chore ticket
  blocking all sixteen, which is worse. Every story after it starts on a working app.

## Reading the two halves together

The mockup stories describe what the dancer sees; the storage stories describe what
makes it true. Two places where that seam is sharp, and worth knowing before picking
either up:

- **US-01-11 (#27) carries two persistence criteria it cannot satisfy alone.** They
  are written against the product deliberately, because they are the point of the
  feature — but they are delivered by **US-01-15**. Anyone building the panel should
  expect to leave those two unticked and should not go hunting for the bug in their
  own work.
- **US-01-14 will feel slow until US-01-16 lands** — around seven seconds per clip
  open, measured, not guessed. Expected, not a defect.

**The spike is reference, not a gap.** `spike-google-drive-storage/` proved this works
from a static page and returned GO. Its code is a legitimate thing to read and borrow
from; it is uncommitted because the hosted app writes its own version, not because the
code is bad. Four of its findings shape the storage stories directly — `drive.file`
scope, cache-first, renewal on user action, and last-write-wins clobbering — and the
fifth is the mobile-OAuth gate above.

**One absence is a decision, not a gap.** Renaming or deleting a clip does not exist
anywhere in the mockup (UC-01 Q-08). Search was the second such absence and is no
longer one: the library outgrew the judgement US-01-03 made about it, and US-01-18
takes a mockup gate pass rather than waiting for a drawing that was never made.

## Where the 🔍 rules get settled

Ten of UC-01's sixteen business rules are marked 🔍 — read off the mockup's code
rather than watched on screen. The upfront walkthrough that would have settled them
is **not happening, by decision** (UC-01 Q-01, resolved): each story is reviewed and
editable before it is accepted for implementation, so a 🔍 rule is confirmed or
overturned then, when the story resting on it is accepted.

**What that means when accepting a story:** its open questions are the worklist. The
cut itself does not depend on those rules — a component is a component whatever the
rule behind it turns out to be — but several acceptance criteria do, and those are
the ones to read properly before approving. Both this set and UC-01 can be edited at
that point; the use case is not frozen by having been merged.
