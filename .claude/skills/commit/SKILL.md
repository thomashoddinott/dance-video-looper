---
name: commit
description: Commits to the current Git repository
---

- Commit your current changes.
- Do not use composite commands, which always force a permission request from the user.
- Given you're already in the Git repository folder - do not explicitly `cd` first - as it's redundant, and can also cause a composite command.
- End every commit message with a provenance trailer as its final line: `Co-Authored-By: <your model name> <noreply@anthropic.com>` — e.g. `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Name the specific model, not the bare `Claude`, so the commit records which model authored the work.
- This trailer is the project's commit-provenance standard: it makes the stamp a repo behaviour rather than personal harness config, giving commit-level auditability. A commit with no such trailer signals manual (human) authorship — that is the intended signal, so only stamp commits you actually generated, never one written by a human.
