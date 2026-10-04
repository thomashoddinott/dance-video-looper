---
name: pr
description: Create a merge request following standards
---

Create a merge request for the current branch using `glab mr create`.

## Ticket reference (load-bearing — ALWAYS when a ticket was pulled down)

The Dev Cycle Flow in CLAUDE.md starts every ticketed task with `glab issue view <number>`, so any branch produced by that flow has a known ticket. For every such MR, the ticket number **MUST** appear as the first token of the title. This is non-negotiable — downstream agents (reviewers, triage, other automation) rely on it to recover the originating context from the title alone.

### Title — required format

- **`#<number> <description>`** — e.g. `#NNN add <redacted> section`, `#NNN <redacted> pricing + UI signalling`.
- **`#<number> <US-code> <description>`** when the ticket is a user story — e.g. `#NNN US-XX-YY approve <redacted> flow (stubbed PDF + signing)`.
- **`[US-XX-YY] <description>`** only when the ticket's primary identifier is a US code with no numeric issue (rare).

The ticket token must be the literal first token. No leading verb, no leading `feat:` / `fix:` prefix before the `#`.

### Description

- Start the body with a `**Ticket:** #<number>` line on its own, above the Summary. GitLab auto-links `#<number>`.

### Pre-flight check (must run before `glab mr create`)

Run these steps in order. If step 1 detects a ticket, step 2 is mandatory.

1. **Detect the ticket** from the current branch name. Standard patterns:
   - `feat/NNN-<redacted>` → `#NNN`
   - `feat/NNN-<redacted>-pricing` → `#NNN`
   - `NNN-assignment-wiring` → `#NNN`
   - `NNN_US-XX-YY` → `[US-XX-YY]` (plus issue number if known)
2. **Enforce the prefix.** If step 1 identified a ticket but the candidate title does not start with the `#<number>` token (or `[US-XX-XX]` for pure user-story branches), STOP and fix the title before running `glab mr create`. Do not submit.
3. If the branch name does not encode a ticket, check the conversation context for a ticket reference. If still ambiguous, ask the user before proceeding.
4. Do not invent a ticket reference. If no ticket is genuinely associated with the work, omit the reference — but flag this to the user, because the Dev Cycle Flow should produce a ticket for every branch.

## Target branch

- If the current branch was cut from a parent feature branch (check `git log` or the ticket's Parent issue), target the MR at that parent branch.
- Otherwise, target `main`.

## Command shape

Use `glab mr create` via Bash. Pass the description via HEREDOC to preserve formatting:

```
glab mr create --title "#NNN add <redacted> section" --target-branch main --description "$(cat <<'EOF'
**Ticket:** #NNN

## Summary
- <1-3 bullets>

## Test plan
- [ ] <checks>
EOF
)"
```

## Before creating

- Verify the branch is pushed to origin.
- Verify commits are present (run `git log main..HEAD --oneline` or equivalent).
- Do NOT use MCP GitLab tools — always use `glab` per CLAUDE.md.
- Do NOT use composite commands; stay in the current directory.

## After creating

- Return the MR URL to the user.
