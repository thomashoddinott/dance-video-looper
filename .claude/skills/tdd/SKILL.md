---
name: tdd
description: Test-Driven Development workflow. Use for ALL code changes - features, bug fixes, refactoring. TDD is non-negotiable.
---

# Test-Driven Development

TDD is the fundamental practice. Every line of production code must be written in response to a failing test.

**For how to write good tests**, load the `testing` skill. This skill focuses on the TDD workflow/process.

---

## Classify the Change First

Decide which shape you have before writing a single test, because two of the
three shapes have a different first move.

| Shape            | What it is                                      | What the suite should do |
| ---------------- | ----------------------------------------------- | ------------------------ |
| **Additive**     | New behaviour, nothing replaced                 | Grow                     |
| **Reductive**    | Behaviour goes away and nothing takes its place | **Shrink**               |
| **Substitutive** | Behaviour A is replaced by B, or a gate moves   | Either way               |

**Substitutive is the shape that catches people.** It presents as reductive ("I am
only deleting a stub") while containing real additive work, so it gets handled as
if it were purely additive and the suite grows at both ends: new tests for the new
logic, plus tests asserting the old behaviour is gone. Split it explicitly. Delete
A's tests as a reduction, write B's tests as an addition, and count the two
separately.

---

## RED-GREEN-REFACTOR Cycle (additive changes)

### RED: Write Failing Test First

- NO production code until you have a failing test
- Test describes desired behavior, not implementation
- Test should fail for the right reason

### GREEN: Minimum Code to Pass

- Write ONLY enough code to make the test pass
- Resist adding functionality not demanded by a test
- Commit immediately after green, without asking (see the `planning` skill, "Commit Discipline")

### REFACTOR: Assess Improvements

- Assess AFTER every green (but only refactor if it adds value)
- Commit before refactoring
- All tests must pass after refactoring

---

## The Removal Cycle (reductive changes)

**Do not write a new test in order to delete code.** If the behaviour was built
under TDD it already has tests, and those tests are your RED. The cycle inverts.

### RED: Delete the tests for the behaviour

Delete them, then run the suite. It should stay **green**.

If something else goes red, you have just learned the code was load-bearing
somewhere you did not expect. That is the signal, and giving you that signal is
the entire point of the step. Stop and understand the failure before deleting
anything else.

### GREEN: Delete the production code

The suite is still green. Nothing was defending the code you removed except the
tests you already took out.

### REFACTOR: Unchanged

Assess as always.

The discipline is preserved, not waived. You still ran the suite before and after,
and you still let it tell you whether the change was safe. What you did not do is
manufacture a test to satisfy the letter of "start with a failing test". **The net
test count for a pure removal is negative.**

### If you genuinely need a scaffold

Occasionally a temporary test is a useful harness while you take something apart,
usually when the behaviour was never properly tested in the first place. Write it,
use it, and **delete it in the commit that finishes the removal**. A scaffold that
survives into `main` is the exact artefact this section exists to prevent.

---

## Is This Test Alive?

Apply this to every test you are about to write or keep, and to every test a
removal leaves behind:

> **Is there a change to production code that would make this test fail?**

If the only way to break it is to re-add code that no longer exists, the test
guards nothing. It is not a test, it is a note about history that runs in CI
forever.

### The absence-assertion rule

Tests asserting something is **not** there are where this goes wrong, because a
live one and a dead one look identical:

> An absence assertion is **alive** if some conditional in production could make
> the thing present. It is **dead** if the thing is absent because no code exists.

| Test                                                   | Verdict | Why                                                  |
| ------------------------------------------------------ | ------- | ---------------------------------------------------- |
| `customers never see internal notes`                   | Alive   | A branch decides this, and it could flip             |
| `uploading a <redacted> leaves the fields blank` | Dead    | No branch. The fields are blank because nothing runs |

Same grammatical shape, opposite value. Name the conditional the test defends. If
you cannot name one, delete it.

---

## One-Shot Verification: Write It, Run It, Do Not Commit It

Some production code runs **exactly once per environment and is then frozen**. A
data migration is the everyday case. TDD still applies to it in full — you write
the failing test first and you get it green — but the test's value is spent the
moment it passes, and committing it buys nothing while costing forever.

**This is not a licence to write untested migrations.** The RED still comes first.
What changes is only whether the test survives into `main`.

### Why the liveness rule already condemns these

Apply the question from the section above to a migration replay test _after_ the
migration has been applied:

> Is there a change to production code that would make this test fail?

No. An applied migration is frozen by convention — you write a new one rather than
edit an old one — so nothing can move that the test would catch. It is exactly what
that section describes: **a note about history that runs in CI forever.**

Two things compound it:

- **The cost is the worst in the suite.** Replaying a chain means flushing tables
  and migrating forward and back on every run. A handful of these routinely costs
  more than every other test in the module combined.
- **They accumulate against each other.** Ten data migrations with ten replay tests
  pin ten intermediate states nobody will ever occupy again. If those migrations
  net back to where they started, you have paid ten tests to test your way to zero.

### Recognising one (do not go by the file name)

An issue number in the filename means nothing either way. Ask three questions about
the code under test:

1. Does it run **once per environment** and then never again? (a migration, a
   backfill, a one-time repair command)
2. Is it **frozen after it runs** — would a correction be a new file rather than an
   edit to this one?
3. Does the test drive the **migration machinery** — `MigrationExecutor`, migrating
   to a named node, `TransactionTestCase` to replay a chain — rather than just
   calling a function?

Three yeses means one-shot. Write it, run it, delete it in the commit that lands
the code, and put what it asserted and the fact it passed in the commit body or MR
description. The evidence survives; the runtime cost does not.

### What to keep permanently

This carve-out is narrow. Do not let it eat real coverage:

- **Test the helper, not the migration that calls it once.** When a migration
  delegates to a function that runtime code also calls, that function is live
  production code and its tests are live tests. Keep them. The migration is just
  one of its callers.
- **Keep one chain-level guard, not one per migration** — that the chain applies
  from zero, and that `makemigrations --check` fails when a migration is missing.
  Those catch regressions that can genuinely still happen.
- **A schema migration needs no test of its own.** Every test that touches the
  model already exercises the column.
- **Anything whose behaviour can still change** is not one-shot, whatever it is
  named or wherever it lives.

---

## TDD Evidence in Commit History

### Default Expectation

Commit history should show clear RED → GREEN → REFACTOR progression.

**Ideal progression:**

```
commit abc123: test: add failing test for user authentication
commit def456: feat: implement user authentication to pass test
commit ghi789: refactor: extract validation logic for clarity
```

### Rare Exceptions

TDD evidence may not be linearly visible in commits in these cases:

**1. Multi-Session Work**

- Feature spans multiple development sessions
- Work done with TDD in each session
- Commits organized for PR clarity rather than strict TDD phases
- **Evidence**: Tests exist, all passing, implementation matches test requirements

**2. Context Continuation**

- Resuming from previous work
- Original RED phase done in previous session/commit
- Current work continues from that point
- **Evidence**: Reference to RED commit in PR description

**3. Refactoring Commits**

- Large refactors after GREEN
- Multiple small refactors combined into single commit
- All tests remained green throughout
- **Evidence**: Commit message notes "refactor only, no behavior change"

### Documenting Exceptions in PRs

When exception applies, document in PR description:

```markdown
## TDD Evidence

RED phase: commit c925187 (added failing tests for shopping cart)
GREEN phase: commits 5e0055b, 9a246d0 (implementation + bug fixes)
REFACTOR: commit 11dbd1a (test isolation improvements)

Test Evidence:
✅ 4/4 tests passing (7.7s with 4 workers)
```

**Important**: Exception is for EVIDENCE presentation, not TDD practice. TDD process must still be followed - these are cases where commit history doesn't perfectly reflect the process that was actually followed.

---

## Coverage Verification - CRITICAL

### NEVER Trust Coverage Claims Without Verification

**Always run coverage yourself before approving PRs.**

### Verification Process

**Before approving any PR claiming "100% coverage":**

1. Check out the branch

   ```bash
   git checkout feature-branch
   ```

2. Run the suite with coverage for the package under test

3. Verify ALL metrics hit 100%:
   - Lines: 100% ✅
   - Statements: 100% ✅
   - Branches: 100% ✅
   - Functions: 100% ✅

4. Check that tests are behavior-driven (not testing implementation details)

**For anti-patterns that create fake coverage (coverage theater)**, see the `testing` skill.

### Reading Coverage Output

Look for the "All files" line in coverage summary:

```
File           | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
---------------|---------|----------|---------|---------|-------------------
All files      |     100 |      100 |     100 |     100 |
setup.ts       |     100 |      100 |     100 |     100 |
context.ts     |     100 |      100 |     100 |     100 |
endpoints.ts   |     100 |      100 |     100 |     100 |
```

✅ This is 100% coverage - all four metrics at 100%.

### Red Flags

Watch for these signs of incomplete coverage:

❌ **PR claims "100% coverage" but you haven't verified**

- Never trust claims without running coverage yourself

❌ **Coverage summary shows <100% on any metric**

```
All files      |   97.11 |    93.97 |   81.81 |   97.11 |
```

- This is NOT 100% coverage (Functions: 81.81%, Lines: 97.11%)

❌ **"Uncovered Line #s" column shows line numbers**

```
setup.ts       |   95.23 |      100 |      60 |   95.23 | 45-48, 52-55
```

- Lines 45-48 and 52-55 are not covered

❌ **Coverage gaps without explicit exception documentation**

- If coverage <100%, exception should be documented (see Exception Process below)

### When Coverage Drops, Ask

**"What business behavior am I not testing?"**

NOT "What line am I missing?"

Add tests for behavior, and coverage follows naturally.

---

## 100% Coverage Exception Process

### Default Rule: 100% Coverage Required

No exceptions without explicit approval and documentation.

### Requesting an Exception

If 100% coverage cannot be achieved:

**Step 1: Document in package README**

Explain:

- Current coverage metrics
- WHY 100% cannot be achieved in this package
- WHERE the missing coverage will come from (integration tests, E2E, etc.)

**Step 2: Get explicit approval**

From project maintainer or team lead

**Step 3: Document in CLAUDE.md**

Under "Test Coverage: 100% Required" section, list the exception

**Example Exception:**

```markdown
## Current Exceptions

- **Next.js Adapter**: 86% function coverage
  - Documented in `/packages/nextjs-adapter/README.md`
  - Missing coverage from SSR functions (tested in E2E layer)
  - Approved: 2024-11-15
```

### Remember

The burden of proof is on the requester. 100% is the default expectation.

---

## Development Workflow

### Adding a New Feature

1. **Write failing test** - describe expected behavior
2. **Run test** - confirm it fails
3. **Implement minimum** - just enough to pass
4. **Run test** - confirm it passes
5. **Refactor if valuable** - improve code structure
6. **Commit** - with conventional commit message, then start the next step without pausing

### Workflow Example

```bash
# 1. Write failing test
it('should reject empty user names', () => {
  const result = createUser({ id: 'user-123', name: '' });
  expect(result.success).toBe(false);
}); # ❌ Test fails (no implementation)

# 2. Implement minimum code
if (user.name === '') {
  return { success: false, error: 'Name required' };
} # ✅ Test passes

# 3. Refactor if needed (extract validation, improve naming)

# 4. Commit
git add .
git commit -m "feat: reject empty user names"
```

### Removing a Feature

1. **Classify** - confirm this is reductive, not substitutive (does a gate move?)
2. **Find the tests** that cover the behaviour going away
3. **Delete those tests** - run the suite, confirm it stays green
4. **Delete the production code** - run the suite, confirm it stays green
5. **Sweep** - any test left behind that now asserts an absence with no conditional
   behind it goes too
6. **Commit** - the diff should show a net reduction in test count

> **Test scope during TDD:** Steps 2 and 4 run only the specific test or test file, never the full suite. The full suite runs once before `git push` (see CLAUDE.md "Test Execution During TDD").

---

## Commit Messages

Use conventional commits format:

```
feat: add user role-based permissions
fix: correct email validation regex
refactor: extract user validation logic
test: add edge cases for permission checks
docs: update architecture documentation
```

**Format:**

- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code change that neither fixes bug nor adds feature
- `test:` - Adding or updating tests
- `docs:` - Documentation changes

---

## Pull Request Requirements

Before submitting PR:

- [ ] All tests must pass
- [ ] All linting and type checks must pass
- [ ] **Coverage verification REQUIRED** - claims must be verified before review/approval
- [ ] PRs focused on single feature or fix
- [ ] Include behavior description (not implementation details)

**Example PR Description:**

```markdown
## Summary

Adds support for user role-based permissions with configurable access levels.

## Behavior Changes

- Users can now have multiple roles with fine-grained permissions
- Permission check via `hasPermission(user, resource, action)`
- Default role assigned if not specified

## Test Evidence

✅ 42/42 tests passing
✅ 100% coverage verified (see coverage report)

## TDD Evidence

RED: commit 4a3b2c1 (failing tests for permission system)
GREEN: commit 5d4e3f2 (implementation)
REFACTOR: commit 6e5f4a3 (extract permission resolution logic)
```

---

## Refactoring Priority

After green, classify any issues:

| Priority | Action       | Examples                                         |
| -------- | ------------ | ------------------------------------------------ |
| Critical | Fix now      | Knowledge duplication, >3 levels nesting         |
| High     | This session | Magic numbers, unclear names, >30 line functions |
| Nice     | Later        | Minor naming, single-use helpers                 |
| Skip     | Don't change | Already clean code                               |

For detailed refactoring methodology, load the `refactoring` skill.

---

## Anti-Patterns to Avoid

- ❌ Writing production code without failing test
- ❌ Testing implementation details (spies on internal methods)
- ❌ 1:1 mapping between test files and implementation files
- ❌ Trusting coverage claims without verification
- ❌ Mocking the function being tested
- ❌ Redefining schemas in test files
- ❌ Factories returning partial/incomplete objects
- ❌ Speculative code ("just in case" logic without tests)
- ❌ Writing a test that asserts deleted behaviour is absent
- ❌ A removal that leaves the test suite the same size or larger
- ❌ Keeping a scaffold test after the removal it supported has landed
- ❌ Keeping an absence assertion with no conditional behind it
- ❌ Committing a one-shot verification test (a migration replay) into the suite

**For detailed testing anti-patterns**, load the `testing` skill.

---

## Summary Checklist

Before marking work complete:

- [ ] Change shape classified: additive, reductive, or substitutive
- [ ] Every production code line has a failing test that demanded it (additive work)
- [ ] A removal left the suite **smaller**, with nothing asserting the deleted behaviour is absent
- [ ] Every kept test can name a conditional it defends
- [ ] One-shot verification tests deleted in the commit that landed the code, with their result recorded in the commit body
- [ ] Commit history shows TDD evidence (or documented exception)
- [ ] All tests pass (full suite verified before push)
- [ ] Coverage verified at 100% (or exception documented)
- [ ] Test factories used
- [ ] Tests verify behavior (not implementation details)
- [ ] Refactoring assessed and applied if valuable
- [ ] Conventional commit messages used
