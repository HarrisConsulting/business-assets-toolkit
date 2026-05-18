---
name: regression-guard
description: Use this skill automatically whenever running an autonomous /goal, fixing bugs, refactoring code, or implementing new features. It enforces strict Git environment checks, branch isolation, and Jest testing protocols to prevent regressions.
---

# Regression Guard Workflow

Whenever you are assigned a codebase modification task, you MUST follow this strict regression prevention protocol. Do not skip any steps.

## Step 0: Create an Isolation Branch
1. Run `git branch` to confirm the current branch.
2. Create and checkout a new branch: `git checkout -b codex/<short-task-slug>`.
3. All changes MUST be made on this branch. Never commit directly to `main` or `master`.

## Step 1: Pre-flight Safety Check
1. Run `git status`. Ensure the working directory is clean.
2. If there are uncommitted changes, STOP immediately. Ask the user to commit or stash their changes before you proceed.

## Step 2: Establish a Green Baseline
1. Run the test suite using `npm test -- --bail` to ensure all existing tests pass before you make any edits.
2. If the baseline test fails, STOP. Capture the stdout/stderr output and report the following to the user: (1) the name of the failing test, (2) the assertion that failed, and (3) the file and line number. Do not attempt to write new code or fix unrelated tests.

## Step 3: Implement the Objective
1. Proceed with the code modifications required by the user's prompt.
2. Keep changes atomic and directly related to the objective.
3. You are permitted a maximum of **2 implementation attempts**. If both fail the regression check in Step 4, STOP, run `git restore .` to restore all tracked files to HEAD, and summarize what was tried and why it failed.

## Step 4: Post-implementation Validation
1. Run the full test suite using `npm test` (without `--bail`) so that all regressions are visible in the report.
2. **Regression Protocol:** If the test run fails, you have introduced a regression. Capture the stdout/stderr and report: (1) the name of each failing test, (2) the assertion that failed, and (3) the file and line number.
   - Run `git restore <file>` for each modified file, or `git restore .` to restore all tracked files to HEAD.
   - Attempt a completely different implementation strategy and return to Step 3.
   - If both attempts fail, STOP and report to the user as described in Step 3.
3. Once tests pass, check whether a `build` script exists in `package.json`. If it does, run `npm run build` to ensure there are no compilation or type errors. If it does not exist, skip this step and note it in the completion report.

## Step 4b: Coverage Check (Optional)
1. If a `test:coverage` script or `test -- --coverage` flag is available, run it and confirm that overall line coverage has not decreased from the baseline.
2. Report the coverage delta to the user as part of the completion summary.

## Step 5: Completion
1. Once Step 4 is successful, report completion to the user including:
   - Confirmation that the regression guard passed.
   - The branch name created in Step 0.
   - Whether the build step was run and its result.
   - Whether coverage was checked and the delta (if Step 4b was run).
