---
name: user-stories
description: Decompose a use case (UC-XX) into user stories. Use whenever stories are being derived, cut, split, or re-cut from a use case or a mockup page — "break UC-XX into stories", "what stories does this page need", "split this story", "is this story too big". Stories here are component-driven, cut from the mockup, not from the UC narrative.
---

Follow `<redacted>`. It is the source of truth for this process — read it in full before cutting anything, and do not restate its method here or in the stories you write.

That document is agreed team methodology, reviewed by a human colleague. If the process needs to change, change **it** — never work around it locally, and never let this skill drift into a second copy of the method.

## What the skill exists to guarantee

**Stories are component-driven.** The unit of a story is a piece of UI you can point at, so the unit of review is a piece of UI you can open. That means: read the mockup page, cut it into a skeleton (route, layout, header, empty placeholders) plus one story per component that drops into it, and anchor every story to its mockup file and line range.

A story with no mockup anchor must be one of the documented non-component exceptions (background process, cross-cutting rule, meaningfully-different alternate flow). If it isn't one of those, the cut is wrong — go back to the mockup.

## Boundaries with other skills

- **Creating the GitLab issues** from finished stories is the `ticket` skill's Route A. This skill produces the spec files; that one uploads them.
- **Approving a story for implementation** is the `planning` skill's Definition of Done gate — it flips `DRAFT` to `APPROVED`. Stories are written `DRAFT` here and stay that way.
- Never draft story files or create issues without an explicit per-story green light from the user.
