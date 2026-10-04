---
name: ticket
description: Create a GitLab ticket with a checkable Definition of Done. Use EVERY time a ticket/issue is created — whether derived from a use case or scribbled down ad-hoc ("make a ticket for that"). Ensures every ticket has acceptance criteria so it is reviewable by the planning gate and /pr-reviewer.
---

Create a GitLab ticket that an agent could pull and implement without asking what "done" means.

## The one rule

**No ticket ships without a checkable Definition of Done** — a short list of criteria a reviewer (human or `/pr-reviewer`) can tick off from the diff alone. This applies to _every_ ticket, no exceptions by default. The user can override on the rare ticket where criteria genuinely don't apply, but you must surface that, not assume it.

Two things are easy to conflate — keep them separate:

- **User-story narrative** (`As a <actor>, I want <goal>, so that <benefit>`) — include it **only** when motivation or scope needs negotiating. It is noise on a bug or a chore.
- **Acceptance criteria** — the Definition of Done. Include on **almost every** ticket, reshaped per kind.

**User story when necessary; acceptance criteria always.**

## Classify the KIND first

One KIND per ticket (`feat · bug · spike · perf · chore · process · use-case-story`). It decides what the Definition of Done looks like.

| KIND                | Narrative?       | Definition of Done is…                                                                              |
| ------------------- | ---------------- | --------------------------------------------------------------------------------------------------- |
| `use-case-story`    | Yes, formal      | Given/When/Then ACs — **routes through the formal pipeline, see below**                             |
| `feat`              | Yes, lightweight | Given/When/Then acceptance criteria                                                                 |
| `bug`               | No               | Reproduction → expected behaviour, **plus** "a regression test covers it"                           |
| `spike`             | No               | The question + "done-when" outcomes (research written up, recommendation made, follow-ups ticketed) |
| `perf`              | No               | Measurable target (p95 < Xms, N fewer queries) + how it's verified                                  |
| `chore` / `process` | No               | A verifiable done-when checklist                                                                    |

Classification rules:

- `use-case-story` is reserved for tickets with a real `US-XX-YY` number from one of the use cases. A story-shaped _body_ with no US-number is a `feat`, not a `use-case-story`.
- Genuine investigation / audit / "verify X" work is a `spike`. Committed build work is never a spike.

## Two routes

**A — `use-case-story` (formal):** do not hand-write it here. Follow `<redacted>` (template, decomposition, milestone, DRAFT status). These get the full approval gate at pull time.

**B — everything else (ad-hoc):**

1. Classify the KIND.
2. Write the Definition of Done in the shape that kind requires (table above). **Always include it** — never a bare title.
3. Add the lightweight narrative only for `feat`.
4. Create the issue:
   - `glab issue create`
   - Title: `<kind> > <route> > <summary>` (route = free-text page/area hint).
   - Body: the narrative (if any) + the acceptance / done-when criteria.
   - Apply the KIND label. A new ticket gets a KIND and nothing else — it lands in **Open** and is found by filtering on KIND, not by a state.

## Labels: KIND vs STATE

Two label axes, kept deliberately small. **KIND** (exactly one, always) classifies the work; you filter by it. **STATE** is optional and you apply it by hand only when it earns its place:

| STATE      | Means                                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `doing`    | Manual kanban tracker — the one board lane (Open · doing · Closed). Set when you start it.                                                       |
| `deferred` | Parking lot: not-now, no milestone home, kept out of the immediate backlog.                                                                      |
| `archive`  | A findable record on a **closed** ticket you considered and chose not to do / direction changed — so the thinking isn't buried by a plain close. |

There is no `triage`/`ready` state: don't triage tickets into lanes, filter by KIND and eyeball Open. Route lives in the **title** (`<kind> > <route> > <summary>`), never as a label — that keeps multi-page tickets clean.

## Templates

**`feat`** — narrative + criteria:

```markdown
## Story

As an operator, I want to filter the dashboard by assigned reviewer, so that I can find my team's cases quickly.

## Acceptance Criteria

- [ ] Given the dashboard, when I pick a reviewer, then only their cases show.
- [ ] Given an active filter, when I clear it, then all cases return.
```

**`bug`** — no narrative; repro → expected + regression:

```markdown
## Bug

Zero-padded account codes (e.g. `0042`) are truncated to `42` on the Step 3a dropdown.

## Acceptance Criteria

- [ ] Given an account code with leading zeros, when Step 3a renders the dropdown, then the full padded code is shown.
- [ ] A regression test covers the zero-padding case.
```

**`spike`** — no narrative; question + done-when:

```markdown
## Question

Can the <redacted> feed supply the fields we need, and at what cost/latency?

## Acceptance Criteria (done-when)

- [ ] Findings written up at `<redacted>`.
- [ ] A go / no-go recommendation is stated.
- [ ] Follow-up build work captured as separate tickets.
```

## Writing good criteria

- Given/When/Then; reference business rules by ID (e.g. BR-01) where they exist.
- Describe observable behaviour, not implementation.
- Include read-only / disabled / empty states where they apply.
- A spike's criteria are still real: "the research is complete and written up" _is_ the Definition of Done.

## Downstream

This skill sets the floor at creation time. The **planning gate** re-checks it at pull time (formal stories → spec-file approval gate; other kinds → must have a criteria section, else write one with the user before coding), and **`/pr-reviewer`** verifies the MR against these criteria. A ticket with a clear Definition of Done reviews itself; one without forces every reader to reverse-engineer the intent.
