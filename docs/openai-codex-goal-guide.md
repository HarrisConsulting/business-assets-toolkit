# 🤖 Using `/goal` in OpenAI Codex CLI — A Comprehensive Guide
### *Experimental Feature — CLI v0.128+*

---

> **What is `/goal`?** It transforms Codex from a step-by-step assistant into a **true autonomous agent** — you assign a mission, it plans, acts, tests, debugs, and iterates until a verifiable stopping condition is met. Think of it as the difference between asking a contractor *"can you hand me that wrench?"* versus saying *"renovate the kitchen."*

---

## 📦 1. Enabling `/goal`

There are two ways to turn it on:

**Option A — In-session toggle:**
```
/experimental
```
Then enable goals from the experimental features menu.

**Option B — Persistent config (`config.toml`):**
```toml
[features]
goals = true
```

> ⚠️ **Note:** Because this is experimental, expect behavior changes across CLI versions. Pin your CLI version in team environments to avoid unexpected agent behavior shifts mid-project.

---

## 🎯 2. Writing Goals That Work

The quality of your goal statement is the **single most important factor** in a successful run. Codex needs a goal it can objectively verify — not just complete.

### The Formula: `Action + Scope + Verifiable Exit Condition`

| ❌ Weak Goal | ✅ Strong Goal |
|---|---|
| `Improve the codebase` | `Refactor the auth module to use JWT tokens and ensure all existing auth tests pass` |
| `Migrate to Python 3` | `Migrate this project from Python 2 to Python 3; all tests in /tests must pass with no deprecation warnings` |
| `Build a game` | `Build a functional Snake game in Python using pygame; the game must launch, score, and handle game-over state` |
| `Make the prompts better` | `Iteratively refine prompts in /prompts against the eval suite until average score exceeds 0.85` |

### 🔑 Key Principles
- **Make "done" measurable.** Passing tests, a linting score, a build succeeding — these are good exit conditions. "Looks cleaner" is not.
- **Reference artifacts.** Point to specific files, plans, or docs: `Read ARCHITECTURE.md first, then...`
- **Scope boundaries.** Tell it what's in and out of scope: `Only modify files under /src/auth — do not touch /src/payments`

---

## 🚀 3. Running `/goal`

### Starting a Goal
```bash
/goal Migrate this project from Python 2 to 3, ensuring all tests pass with no warnings
```

### Managing an Active Goal
```bash
/goal           # Check current status and progress summary
/goal pause     # Pause execution (safe stopping point)
/goal resume    # Resume from last checkpoint
/goal clear     # Abandon the current goal entirely
```

---

## 🔄 4. Understanding the Ralph Loop

`/goal` operates on an internal **plan → act → test → review → iterate** cycle. Here's what happens under the hood:

```
┌────────────────────────────────────────────────────────┐
│                     /goal SET                          │
│                        │                               │
│              ┌─────────▼──────────┐                   │
│              │   PLAN (sub-tasks) │                   │
│              └─────────┬──────────┘                   │
│                        │                               │
│              ┌─────────▼──────────┐                   │
│              │   ACT (write code) │◄──────────┐       │
│              └─────────┬──────────┘           │       │
│                        │                      │       │
│              ┌─────────▼──────────┐           │       │
│              │  TEST (run checks) │           │       │
│              └─────────┬──────────┘           │       │
│                        │                      │       │
│              ┌─────────▼──────────┐           │       │
│              │ REVIEW (pass/fail?)│           │       │
│              └─────────┬──────────┘           │       │
│                   Pass │    Fail ─────────────┘       │
│                        │                               │
│              ┌─────────▼──────────┐                   │
│              │   GOAL COMPLETE    │                   │
│              └────────────────────┘                   │
└────────────────────────────────────────────────────────┘
```

**Checkpointing** logs each cycle's progress so you can audit what changed at each step, even across runs that span hours.

---

## 🧰 5. Best Practices by Use Case

### 🔀 Code Migrations (e.g., Python 2 → 3, React 17 → 19)
```bash
/goal Migrate this project from Python 2 to Python 3. Read requirements.txt and all files under /src. All tests in /tests must pass. Do not modify /tests themselves.
```
- ✅ Commit a clean baseline to Git **before** starting
- ✅ Let Codex run one module at a time if the project is large — use `/goal pause` between modules to review
- ✅ After completion, run your test suite manually to independently verify

---

### 🏗️ Large Refactors
```bash
/goal Refactor the database layer to use the Repository pattern. Relevant files are under /src/db. All integration tests must pass after the change.
```
- ✅ Pre-write tests *before* setting the goal — they become the exit condition
- ✅ Use narrow scope declarations to prevent unintended file changes
- ✅ Review the checkpoint log to catch over-aggressive changes

---

### 🎮 Prototype Development
```bash
/goal Build a functional Tetris clone in Python using pygame. The game must: launch without errors, display a grid, spawn and move pieces, detect line clears, and show a score counter. Write the code to /src/tetris.
```
- ✅ Specify the output path explicitly
- ✅ List *each* required behavior as part of the goal — Codex uses these as mini-checkpoints
- ✅ Expect multiple test-run/fix cycles before it stabilizes

---

### 📊 Prompt / Eval Optimization
```bash
/goal Iteratively improve prompts in /prompts/classify.txt by running the eval suite at /evals/run.py after each change. Stop when the average score across all test cases exceeds 0.88.
```
- ✅ Ensure the eval script outputs a parseable score (e.g., `Score: 0.87`)
- ✅ Set a ceiling on iterations if you're cost-sensitive: `...or after 20 iterations, whichever comes first`

---

## 📋 6. The `MERGE_CHECK.md` Pattern

One of the most valuable practices when using `/goal` is asking Codex to **generate a handoff document** as part of the goal itself:

```bash
/goal Refactor the payments module to use Stripe v3. All existing tests must pass. After completion, create a MERGE_CHECK.md file in the root that explains: 1) what changed, 2) what was intentionally left unchanged, 3) any known risks or edge cases to review before merging.
```

A good `MERGE_CHECK.md` will look like:

```markdown
## What Changed
- Replaced Stripe v2 `charge` calls with v3 `PaymentIntent` API across 4 files
- Updated `stripe` dependency in requirements.txt from 2.x to 3.x

## What Was Left Unchanged
- Webhook handler logic in `/src/webhooks.py` (compatible with both versions)
- All test files in `/tests/payments/`

## Known Risks Before Merging
- Stripe v3 requires `idempotency_key` for retries — not yet implemented
- No load/volume testing performed
- Sandbox mode only — needs prod key validation
```

This turns `/goal` from an autonomous black box into a **reviewable, auditable process**.

---

## 🛡️ 7. Safety & Oversight Guardrails

Because `/goal` can run autonomously for hours, establish these guardrails **before** you start:

### Repository Safety
```bash
# Always start from a clean, committed state
git status          # Confirm no uncommitted changes
git checkout -b goal/migrate-python3   # Work on a dedicated branch
```

### File Scope Boundaries
Include explicit constraints in the goal text:
```
...Only modify files under /src. Do not touch /config, /infra, or any .env files.
```

### Credential Hygiene
- Run Codex in an environment with **minimum necessary secrets** — if the goal is a refactor, it doesn't need prod API keys
- Prefer `.env.test` over `.env` in the working directory during goal runs

### Know When to Intervene
Use `/goal pause` if you observe:
- The agent repeatedly attempting and failing the same step (stuck loop)
- Unexpected files being created or deleted
- Test counts shrinking (tests being removed rather than fixed)

---

## 📊 8. Multi-Project Strategy

When `/goal` is used across **multiple projects or a team**, consider the following structure:

```
project-root/
├── .codex/
│   ├── goals/
│   │   ├── active.md        # Current goal definition (committed)
│   │   ├── completed/       # Archive of past goals + outcomes
│   │   └── MERGE_CHECK.md   # Latest goal handoff doc
│   └── config.toml          # goals = true, scoped per project
```

### Team Workflow
1. **Define** the goal in `active.md` and commit it — creates a paper trail
2. **Run** `/goal` pointing Codex at that file: `/goal Read .codex/goals/active.md and execute it`
3. **Review** `MERGE_CHECK.md` as part of your PR checklist
4. **Archive** the completed goal with its outcome for future reference

---

## ⚡ 9. Quick-Reference Cheatsheet

```bash
# Enable
[features]
goals = true               # in config.toml

# Core Commands
/goal <objective>          # Start a new goal
/goal                      # Check current status
/goal pause                # Pause at next checkpoint
/goal resume               # Resume paused goal
/goal clear                # Abandon current goal

# Goal Writing Formula
/goal [ACTION] [SCOPE], [VERIFIABLE EXIT CONDITION]

# The MERGE_CHECK Pattern
/goal [...task...]. After completion, write MERGE_CHECK.md summarizing
what changed, what was left alone, and risks to review before merging.
```

---

## 🔭 10. Limitations to Keep in Mind (as of May 2026)

| Limitation | Mitigation |
|---|---|
| Can get stuck in repair loops on hard bugs | Use `/goal pause`, fix manually, then `/goal resume` |
| No native multi-repo support | Run separate `/goal` sessions per repo; coordinate via shared spec files |
| Experimental — behavior may change between CLI versions | Pin CLI version in CI/team environments |
| Cost/token burn on long runs | Set iteration caps in your goal definition |
| No human-in-the-loop approval steps mid-run | Use checkpointing and `/goal pause` at logical boundaries |

---

> 💡 **The mindset shift:** `/goal` works best when you stop thinking like a *prompter* and start thinking like a *tech lead assigning a sprint ticket* — detailed acceptance criteria, clear scope, a way to verify "done," and a handoff document at the end. The more complete your goal definition, the more effective your autonomous teammate becomes.
