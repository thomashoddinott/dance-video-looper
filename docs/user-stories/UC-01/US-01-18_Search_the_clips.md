# US-01-18: Search the clips

**Status:** APPROVED
**Use Case:** UC-01 — Loop a section of a clip
**Actor:** Dancer
**Priority:** TBD

## Story

As a dancer with a library of dozens of clips, I want to type part of a filename and
see only the clips that match, so that I can get to the one I mean without scrolling
the whole grid.

## Acceptance Criteria

- [ ] Given the Clips screen, when it renders, then a **labelled search input** sits above the grid
- [ ] Given I type into it, when the text changes, then the grid shows only clips whose name **contains** that text, matched **case-insensitively** — with no submit button and no reload
- [ ] Given text that matches nothing, when the grid renders, then it says **nothing matches** — not a bare empty grid, and not the "you have no clips" reading, which would be a lie
- [ ] Given an active search and a chosen ordering chip, when the grid renders, then the clips still showing are ordered by that chip — **search filters the grid, it does not re-order it**
- [ ] Given I clear the box, when the grid renders, then **every clip comes back**
- [ ] Given leading or trailing whitespace in the box, when the grid renders, then it **does not stop an otherwise matching clip from showing**
- [ ] Given an active search, when I add a clip, then the **search is cleared** so the clip just added is visible — the same rule the ordering already follows when it flips back to **Recent** (US-01-04)
- [ ] 👁 Given the search box, when it renders on a narrow viewport, then it **fills the width available rather than overflowing** — the same constraint the chip row lives under (US-01-03)

## Notes

- **Mockup:** none as drawn. This screen was mocked up before a library big enough to
  need search existed, so US-01-18 takes a **mockup gate pass** (CLAUDE.md → Process):
  built first, then retrofitted into `mockup/src/Library.jsx` so the mockup stays a
  true reference for UC-01 rather than a stale one. The same route US-01-13 and
  US-01-14 took.
- **References:** UC-01 Basic Flow step 4 — the step the ordering chips also serve.
- **Not in this story:** searching anything but the name — not the date, not the
  duration, not the loop count. No fuzzy matching, no highlighting of the matched
  substring, and no persistence of the query in the URL or across a reload.
- **Dependencies:** US-01-01 (the screen), US-01-03 (the ordering the search must
  leave alone), US-01-04 (the add flow the clear-on-add rule hangs off).

### Why this is client-side, and why that is not a shortcut

The whole library is already in memory — `library.clips`, put there by US-01-14 and
served from cache by US-01-16. Filtering it costs nothing, needs no Drive query, and
**works on a cached library with no token at all**, which matters in a studio with bad
signal. A Drive-side search would be slower, would need a live session, and would
return the same answer.

`clip.name` is the filename with its extension stripped (`nameFromFilename`,
`app/src/clips/fileClip.ts:3`), so searching the name *is* searching the filename —
there is no second field to reconcile.

### Filter, then order

The two controls compose in one direction only: search narrows the set, the chosen
chip orders what is left. Written that way in code — `matching()` feeds the
comparator — the fourth criterion holds by construction rather than by vigilance.

The reverse would also *look* right and be wrong the moment the set changes, which is
why the direction is written down here rather than left to the implementation.

### Why the whitespace criterion is not fussiness

A phone keyboard adds a trailing space readily — autocorrect after a completed word,
and the space bar sitting where a thumb rests. An untrimmed query turns that into
"no clips match", which reads as a broken feature rather than as a stray keystroke.
Trimming both ends is the whole fix.

### Superseding US-01-03

US-01-03 recorded that search "has not yet earned" a place, on a mockup with none and
a library of a handful of clips. The library is now dozens of clips deep and the grid
is a scroll, so the condition that story named has changed. That is the ticket with
evidence behind it that US-01-03 asked for, not a reversal of its reasoning.

### 👁 — criteria verified by eye, not by test

One criterion is pure CSS. jsdom has no layout engine, so a width is a string to it
and the only unit test available asserts the class attribute — which pins the
implementation rather than the behaviour. It is verified in a real browser instead,
per the convention US-01-01 set. **A missing test against a 👁 criterion is not a TDD
gap.**

### Prior art

**None.** Nothing in the app filters a collection today: the ordering chips sort, the
saved-loops panel lists a clip's loops whole. No 🔍 business rule underpins this story
either — every 🔍 in UC-01 governs the player.
