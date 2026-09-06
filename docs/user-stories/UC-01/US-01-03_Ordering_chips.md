# US-01-03: Ordering chips

**Status:** APPROVED
**Use Case:** UC-01 — Loop a section of a clip
**Actor:** Dancer
**Priority:** TBD

## Story

As a dancer, I want to re-order the grid, so that I can reach the clip I want by
whichever fact about it I happen to remember.

## Acceptance Criteria

- [ ] Given the Clips screen, when it renders, then three chips are offered, in this order: **Recent**, **Name** and **Most looped**
- [ ] Given the screen has just loaded, when no chip has been chosen, then **Recent** is active — newest first
- [ ] Given **Name** is chosen, when the grid re-orders, then clips are sorted alphabetically, ascending
- [ ] Given **Most looped** is chosen, when the grid re-orders, then clips are sorted by saved-loop count, highest first
- [ ] Given any ordering, when two clips tie under it, then they keep the order they arrived in — the sort is **stable**
- [ ] Given any chip is chosen, when it becomes active, then **exactly one chip is pressed at a time**
- [ ] 👁 Given the active chip, when it renders, then it is **visually distinct** from the inactive ones
- [ ] 👁 Given the chips, when they render on a narrow viewport, then they **wrap within the ordering region rather than scrolling or overflowing** — the region already wraps (US-01-01); the chips must not defeat it

## Notes

- **Mockup:** `mockup/src/Library.jsx:216–231` (the chip row), `3–7` (the three orderings and their comparators)
- **References:** UC-01 Basic Flow step 4
- **Not in this story:** what a tile looks like (US-01-02), and the automatic switch to **Recent** after adding a clip, which belongs to that flow (US-01-04). Search and filtering are not in this set at all — the mockup has neither, and a personal library of this size has not yet earned them.
- **Open questions:** whether **Most looped** should mean *most saved* or *most practised* is a real product question the mockup does not answer — promoted to **UC-01 Q-13**, since it outlives this story. It does not block: the saved-loop count is the only signal the app keeps, so that is what is built against.
- **Dependencies:** US-01-01 (the region the chips sit in — `ClipsScreen.tsx`, the `role="toolbar"` element, already present and empty)

### Ties, and why the sort is stable

The mockup's comparators tie more often than they look like they do, and both cases
are ordinary rather than edge:

- `added` is a **calendar day**, not an instant, so every clip added in the same
  session ties under **Recent**
- a real library is mostly clips not yet worked on, so the whole zero-loop tail ties
  under **Most looped**

`Array.prototype.sort` is stable, so a tie falls back to the order the clips arrived
in. That is the mockup's actual behaviour; the criterion above writes it down rather
than leaving it to be rediscovered. It also gives **US-01-04** something to rely on:
UC-01 flow 4a puts a newly added clip at the top of the grid, which under a stable
sort means prepending it, not trusting the comparator to lift it.

**No secondary sort key is added** — not name under Recent, not recency under Most
looped. The mockup has neither, and inventing a second ordering dimension at the
approval gate is the silent-rewrite failure this method exists to prevent. If the
zero-loop tail grates in real use, that is a ticket with evidence behind it.

### How "active" is expressed

The mockup signals the active chip **only** through classes
(`mockup/src/Library.jsx:222–226`). Production adds `aria-pressed` to each chip,
inside the `role="toolbar"` US-01-01 already put there.

This is production being *more* than the mockup, which the mockup being a **visual**
reference permits. Two reasons it is not gold-plating: asserting on `className` pins
the implementation rather than the behaviour, so "exactly one chip is active" — the
most valuable rule in this story — would otherwise be untestable; and without it a
screen reader announces the active chip identically to the inactive ones.

### 👁 — criteria verified by eye, not by test

Two criteria are pure CSS. jsdom has no layout engine, so a wrap and a background
swap are strings to it, and the only unit test available asserts the class attribute
— which pins the implementation rather than the behaviour. They are marked 👁 and
verified in a real browser instead, per the convention US-01-01 set. **A missing test
against a 👁 criterion is not a TDD gap.**

Note the second one is largely inherited: `flex flex-wrap gap-1.5` shipped on the
ordering region under US-01-01. This story has to avoid defeating it — chips as plain
children of that element, no nested wrapper — rather than implement it.

### Prior art

**None.** The Google Drive spike never touched the grid; a search of its `src/` for
sort, comparator and chip terms returns nothing, so no decision is being carried
across and none is being declined. No 🔍 business rule underpins this story either —
every 🔍 in UC-01 governs the player.
