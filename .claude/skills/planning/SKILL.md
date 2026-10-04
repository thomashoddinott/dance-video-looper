---
name: planning
description: Planning work in small, known-good increments. Use when starting significant work or breaking down complex tasks.
---

# Planning in Small Increments

**Worktree context:** When this skill is loaded for a GitLab ticket, you should already be inside a Claude Code worktree with a feature branch (per Dev Cycle Flow in CLAUDE.md). If not, create one before proceeding. Planning documents (PLAN.md, WIP.md, LEARNINGS.md) live inside the worktree and are deleted with it after the MR.

**All work must be done in small, known-good increments.** Each increment leaves the codebase in a working state where all tests pass.

**CRITICAL — TDD IS MANDATORY FOR EVERY STEP.** Before implementing the first step, load the `tdd` skill. Every step follows RED-GREEN-REFACTOR: write a failing test FIRST, then write the minimum code to pass it. No production code without a failing test — ever. If you find yourself writing implementation code without having written a failing test first, STOP immediately and write the test. This is non-negotiable and applies to every single step in the plan, no exceptions.

**Document Management**: Use the `progress-guardian` agent to create and maintain planning documents (PLAN.md, WIP.md, LEARNINGS.md).

## Definition of Done Gate

**Applies to every pulled ticket.** No ticket proceeds to planning without a checkable Definition of Done — the criteria `/pr-reviewer` will later verify the MR against. What "done" looks like depends on the ticket's KIND; the `/ticket` skill (`.claude/skills/ticket/SKILL.md`) defines the per-kind shapes. Which route below applies is decided by whether the ticket is a formal user story.

### Route A — formal user stories (`US-XX-YY`)

Applies to tickets whose code follows the `US-XX-YY` nomenclature and therefore have a matching markdown spec at `<redacted>`. These go through the full, hard spec-file gate below. Every other kind takes Route B instead.

For a `US-XX-YY` ticket, locate its spec file by the code, then read the `**Status:**` header at the top:

- **`APPROVED`** → proceed to planning.
- **`DRAFT`** → stop. User story specs are LLM-drafted under time pressure and have not been reviewed. Walk the user through the story statement and every acceptance criterion, cross-checking against the UC (`<redacted>`) and the mockup. Triage discrepancies one at a time and edit the spec file until the user explicitly approves. Then:
  1. Flip the header to `**Status:** APPROVED`.
  2. **Sync the GitLab issue body to match the updated spec** — read the spec file, strip the H1 title (the first heading line and any blank line beneath it), and push the remainder as the issue description: `glab issue update <issue-num> --description "$(tail -n +3 path/to/spec.md)"` (or equivalent). The spec is the source of truth, but the issue is what the team and the pr-reviewer agent read at MR time — the two must not diverge.
  3. Commit the spec edit as the **first commit on the feature branch** — no PLAN.md, no tests, no production code until that commit lands.

  Do the GitLab sync **before** the commit, not after. If the spec was already `APPROVED` before you touched it, skip the sync (no flip = nothing to push). This whole sequence is a hard gate.

- **No spec file found for a `US-XX-YY` ticket** → flag this to the user rather than silently skipping; a missing spec is a process gap, not a pass.

### Route B — every other kind (`feat`, `bug`, `spike`, `perf`, `chore`, `process`)

There is no spec file. The Definition of Done lives in the GitLab issue body. Fetch it with `glab issue view <number>` and check it carries criteria in the shape its kind requires (acceptance criteria for `feat`; reproduction → expected + a regression-test criterion for `bug`; the question + "done-when" outcomes for `spike`; a measurable target for `perf`; a done-when checklist for `chore`/`process` — see the `/ticket` skill).

- **Criteria present** → restate them to the user in one line, then proceed to planning. This is a lightweight confirmation, not the hard spec-file gate.
- **Criteria missing or thin** → stop. Draft the Definition of Done with the user (use the `/ticket` skill's templates), update the issue body to match (`glab issue update <number> --description ...`), then proceed. Don't write production code against a ticket whose "done" is undefined.

The user may override and proceed without criteria on the rare ticket where they genuinely don't apply — but surface that choice rather than assuming it. The aim is that ~90% of pulled work passes through this gate.

## Three-Document Model

For significant work, maintain three documents:

| Document         | Purpose            | Lifecycle                               |
| ---------------- | ------------------ | --------------------------------------- |
| **PLAN.md**      | What we're doing   | Created at start, changes need approval |
| **WIP.md**       | Where we are now   | Updated constantly, always accurate     |
| **LEARNINGS.md** | What we discovered | Temporary, merged at end then deleted   |

### Document Relationships

```
PLAN.md (static)          WIP.md (living)           LEARNINGS.md (temporary)
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ Goal            │       │ Current step    │       │ Gotchas         │
│ Acceptance      │  ──►  │ Status          │  ──►  │ Patterns        │
│ Steps 1-N       │       │ Blockers        │       │ Decisions       │
│ (approved)      │       │ Next action     │       │ Edge cases      │
└─────────────────┘       └─────────────────┘       └─────────────────┘
        │                         │                         │
        │                         │                         │
        └─────────────────────────┴─────────────────────────┘
                                  │
                                  ▼
                         END OF FEATURE
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
              DELETE all              Merge LEARNINGS into:
              three docs              - CLAUDE.md (gotchas, patterns)
                                      - ADRs (architectural decisions)
```

## What Makes a "Known-Good Increment"

Each step MUST:

- Leave all tests passing (verified by affected test file; full suite at push time)
- Be independently deployable
- Have clear done criteria
- Fit in a single commit
- Be describable in one sentence

**If you can't describe a step in one sentence, break it down further.**

## Step Size Heuristics

**Too big if:**

- Takes more than one session
- Requires multiple commits to complete
- Has multiple "and"s in description
- You're unsure how to test it
- Involves more than 3 files

**Right size if:**

- One clear test case
- One logical change
- Can explain to someone in 30 seconds
- Obvious when done
- Single responsibility

## TDD Integration

**Every step follows RED-GREEN-REFACTOR.** See `testing` skill for factory patterns.

```
FOR EACH STEP:
    │
    ├─► RED: Write failing test FIRST
    │   - Test describes expected behavior
    │   - Test fails for the right reason
    │
    ├─► GREEN: Write MINIMUM code to pass
    │   - No extra features
    │   - No premature optimization
    │   - Just make the test pass
    │
    ├─► REFACTOR: Assess improvements
    │   - See `refactoring` skill
    │   - Only if it adds value
    │   - All tests still pass
    │
    └─► COMMIT: One commit per step, then straight into the next step
```

**No exceptions. No "I'll add tests later."**

## Commit Discipline

**NEVER stop to ask for commit approval.** Approval is given once, when the user green-lights the plan, and the diff is reviewed once, at the MR. There is no gate in between.

After completing a step (RED-GREEN-REFACTOR):

1. Verify affected tests pass (full suite at push time)
2. Verify static analysis passes
3. Update WIP.md with progress
4. Capture any learnings in LEARNINGS.md
5. **Commit the step** via the `/commit` skill, then begin the next step immediately

Once implementation is green-lit ("yes, let's get coding", "continue until you've got an MR up"), run every remaining step to completion and open the MR. Stop only for a genuine blocker or a plan change that needs a decision.

### Why Not Stop Between Steps?

- The two gates that matter are plan approval at the start and the MR diff at the end
- Pausing mid-plan interrupts the user's flow and leaves the run idle while they are away
- One logical commit per plan step keeps the history reviewable without a prompt
- Every step boundary is green, so each commit is already a safe stopping point

## PLAN.md Structure

```markdown
# Plan: [Feature Name]

## Goal

[One sentence describing the outcome]

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Steps

### Step 1: [One sentence description]

**Test (RED — write this FIRST)**: What failing test will we write?
**Implementation (GREEN — minimum to pass)**: What code will we write?
**Done when**: How do we know it's complete?

### Step 2: [One sentence description]

**Test (RED — write this FIRST)**: ...
**Implementation (GREEN — minimum to pass)**: ...
**Done when**: ...
```

### Plan Changes Require Approval

If the plan needs to change:

1. Explain what changed and why
2. Propose updated steps
3. **Wait for approval** before proceeding

Plans are not immutable, but changes must be explicit and approved.

## WIP.md Structure

```markdown
# WIP: [Feature Name]

## Current Step

Step N of M: [Description]

## Status

🔴 RED - Writing failing test
🟢 GREEN - Making test pass
🔵 REFACTOR - Assessing improvements
⏸️ BLOCKED - Needs a decision before the next step

## Completed

- [x] Step 1: [Description]
- [x] Step 2: [Description]
- [ ] Step 3: [Description] ← current

## Blockers

[None / List current blockers]

## Next Action

[Specific next thing to do]
```

### WIP Must Always Be Accurate

Update WIP.md:

- When starting a new step
- When status changes (RED → GREEN → REFACTOR)
- When blockers appear or resolve
- After each commit
- At end of each session

**If WIP.md doesn't reflect reality, update it immediately.**

## LEARNINGS.md Structure

```markdown
# Learnings: [Feature Name]

## Gotchas

### [Title]

- **Context**: When this occurs
- **Issue**: What goes wrong
- **Solution**: How to handle it

## Patterns That Worked

### [Title]

- **What**: Description
- **Why it works**: Rationale
- **Example**: Brief code example

## Decisions Made

### [Title]

- **Options considered**: What we evaluated
- **Decision**: What we chose
- **Rationale**: Why
- **Trade-offs**: What we gained/lost

## Edge Cases

- [Edge case 1]: How we handled it
- [Edge case 2]: How we handled it
```

### Capture Learnings As They Occur

Don't wait until the end. When you discover something:

1. Add it to LEARNINGS.md immediately
2. Continue with current work
3. At end of feature, learnings are ready to merge

## End of Feature

When all steps are complete:

### 1. Verify Completion

- All acceptance criteria met
- All tests passing
- All steps marked complete in WIP.md

### 2. Merge Learnings

Review LEARNINGS.md and determine destination:

| Learning Type           | Destination  | Method            |
| ----------------------- | ------------ | ----------------- |
| Gotchas                 | CLAUDE.md    | Use `learn` agent |
| Patterns                | CLAUDE.md    | Use `learn` agent |
| Architectural decisions | ADR          | Use `adr` agent   |
| Domain knowledge        | Project docs | Direct update     |

### 3. Delete Documents

After learnings are merged:

```bash
rm PLAN.md WIP.md LEARNINGS.md
git add -A
git commit -m "chore: complete [feature], remove planning docs"
```

**The knowledge lives on in:**

- CLAUDE.md (gotchas, patterns)
- ADRs (architectural decisions)
- Git history (what was done)
- Project docs (if applicable)

## Anti-Patterns

❌ **Pausing for commit approval between steps**

- The green light covers the whole plan; commit the step and carry on

❌ **Steps that span multiple commits**

- Break down further until one step = one commit

❌ **Writing code before tests**

- RED comes first, always

❌ **Letting WIP.md become stale**

- Update immediately when reality changes

❌ **Waiting until end to capture learnings**

- Add to LEARNINGS.md as discoveries occur

❌ **Plans that change silently**

- All plan changes require discussion and approval

❌ **Keeping planning docs after feature complete**

- Delete them; knowledge is now in permanent locations

## Quick Reference

```
START FEATURE (inside Claude Code worktree)
│
├─► User Story Approval Gate (US-XX-YY tickets only — if spec is DRAFT,
│     review ACs with user, flip to APPROVED, sync GitLab issue body via
│     `glab issue update`, then commit as first commit on branch)
├─► Create PLAN.md (get approval)
├─► Create WIP.md
├─► Create LEARNINGS.md
│
│   Load `tdd` skill if not already loaded
│
│   FOR EACH STEP:
│   │
│   ├─► RED: Write failing test FIRST (no code without this)
│   ├─► GREEN: Minimum code to pass
│   ├─► REFACTOR: If valuable
│   ├─► Update WIP.md
│   ├─► Capture learnings
│   └─► **COMMIT (via /commit) AND CONTINUE — never pause to ask**
│
END FEATURE
│
├─► Verify all criteria met
├─► Merge learnings (learn agent, adr agent)
├─► Create MR (via /pr)
├─► **Confirm with user**, then delete worktree
└─► Review on main repo (via the pr-reviewer agent)
```
