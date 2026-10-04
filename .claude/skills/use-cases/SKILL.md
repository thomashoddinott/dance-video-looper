---
name: use-cases
description: Derive or revise a use case (UC-XX) from the mockup. Use whenever a use case is being reverse-engineered, drafted, re-derived, or aligned against an evolved mockup — "derive UC-XX from the mockup", "the UC has drifted from the page", "walk me through this screen and write the use case". Derivation is walkthrough-driven, not code-reading.
---

Follow `<redacted>`. It is the source of truth for the template, the document conventions, and the four-stage pipeline — read it before writing anything, and do not restate its method here or in the use case you write.

That document is agreed team methodology. If the process needs to change, change **it** — never work around it locally, and never let this skill drift into a second copy of the method.

## What the skill exists to guarantee

**Use cases are derived by walkthrough, not by reading mockup code.** Read the code first so you can keep up and ask sharp questions — then let the author open the live page and narrate it, and integrate their narration into the use case section by section.

Three failure modes the walkthrough section exists to prevent, so watch for them in yourself:

- **Front-running the author** with a pre-built menu of divergences. Keep your inventory of drift in reserve to backstop what they skip; never lead with it.
- **Silently rewriting the UC to match the mockup.** Where the two conflict, raise it as a question — the mockup can be the thing that's wrong, and when it is, it gets fixed on the same branch.
- **Documenting behaviour without its rule.** The screen shows what happens; only the author knows who may do it and what it triggers. Ask.

## Boundaries with other skills

- **Cutting the finished use case into stories** is the `user-stories` skill (component-driven, from the mockup).
- **Creating GitLab issues** from those stories is the `ticket` skill.
- Never draft use case files without an explicit green light from the user.
