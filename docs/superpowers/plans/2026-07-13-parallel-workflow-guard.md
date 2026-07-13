# Parallel Workflow Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make parallel worktree development safe by serializing finish operations, isolating Studio runtime resources, and rejecting unsafe checkout states.

**Architecture:** Keep the existing Git merge/push lifecycle, but extract three small ESM modules: an atomic filesystem lock, a pure runtime configuration/port allocator, and a Git worktree guard. A cross-platform Node Studio launcher consumes the runtime configuration and owns child-process cleanup.

**Tech Stack:** Node.js 22 ESM, `node:test`, `node:fs/promises`, `node:net`, Git CLI, pnpm, Vite, tsx.

---

### Task 1: Add tested lock and runtime primitives

**Files:**
- Create: `scripts/worktree-lock.mjs`
- Create: `scripts/worktree-runtime.mjs`
- Create: `scripts/__tests__/worktree-lock.test.mjs`
- Create: `scripts/__tests__/worktree-runtime.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing lock tests**

Test real temporary directories with Node's built-in test runner. Cover first acquisition, duplicate acquisition with owner details, release, and lock metadata.

```js
test("a released lock can be acquired again", async () => {
  const root = await mkdtemp(join(tmpdir(), "inkos-lock-"));
  const lockPath = join(root, "codex-finish.lock");
  const first = await acquireWorktreeLock(lockPath, { branch: "codex/a" });
  await assert.rejects(
    acquireWorktreeLock(lockPath, { branch: "codex/b" }),
    /already held.*codex\/a/s,
  );
  await first.release();
  const second = await acquireWorktreeLock(lockPath, { branch: "codex/b" });
  await second.release();
  await rm(root, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run the lock test and verify the expected missing-module failure**

Run: `node --test scripts/__tests__/worktree-lock.test.mjs`

Expected: FAIL because `scripts/worktree-lock.mjs` does not exist yet.

- [ ] **Step 3: Implement the minimal atomic lock**

Export `acquireWorktreeLock(lockPath, metadata)`. Use `mkdir(lockPath)` without recursive mode, write `owner.json`, convert `EEXIST` into an error containing the existing owner file, and return an idempotent async `release()` that removes only the acquired lock directory.

- [ ] **Step 4: Run the lock test and verify it passes**

Run: `node --test scripts/__tests__/worktree-lock.test.mjs`

Expected: PASS with all lock tests passing.

- [ ] **Step 5: Write failing runtime tests**

Cover branch slug normalization, stable default ports, explicit port overrides, and task-scoped log/screenshot directories under the supplied worktree root.

```js
test("runtime config is stable and worktree-local", () => {
  const config = createRuntimeConfig({
    branch: "codex/story-settings/assets",
    projectRoot: "D:/work/storyos/.worktrees/story-settings",
  });
  assert.equal(config.taskSlug, "story-settings-assets");
  assert.match(config.clientPort.toString(), /^4[6-7]\d\d$/);
  assert.equal(config.serverPort, config.clientPort + 2);
  assert.equal(config.logDir, "D:/work/storyos/.worktrees/story-settings/.studio-live/story-settings-assets");
  assert.equal(config.screenshotDir, "D:/work/storyos/.worktrees/story-settings/.screenshots/story-settings-assets");
  assert.equal(config.projectRuntimeDir, "D:/work/storyos/.worktrees/story-settings/.inkos");
});
```

- [ ] **Step 6: Run the runtime test and verify the expected missing-module failure**

Run: `node --test scripts/__tests__/worktree-runtime.test.mjs`

Expected: FAIL because `scripts/worktree-runtime.mjs` does not exist yet.

- [ ] **Step 7: Implement runtime configuration and port probing**

Export `slugifyBranchName`, `createRuntimeConfig`, `isPortAvailable`, and `findAvailablePortPair`. Use a stable hash for the preferred client port, reserve `serverPort = clientPort + 2`, honor explicit `INKOS_STUDIO_CLIENT_PORT`/`INKOS_STUDIO_PORT`, and probe candidate pairs before the launcher starts.

- [ ] **Step 8: Run both primitive test files**

Run: `node --test scripts/__tests__/worktree-lock.test.mjs scripts/__tests__/worktree-runtime.test.mjs`

Expected: PASS with zero failures.

- [ ] **Step 9: Add the workflow test script**

Add this package script without changing the existing package test command:

```json
"test:workflow": "node --test scripts/__tests__/*.test.mjs"
```

- [ ] **Step 10: Commit the tested primitives**

```bash
git add scripts/worktree-lock.mjs scripts/worktree-runtime.mjs scripts/__tests__ package.json
git commit -m "feat: add parallel workflow runtime primitives"
```

### Task 2: Add the worktree guard

**Files:**
- Create: `scripts/worktree-guard.mjs`
- Create: `scripts/__tests__/worktree-guard.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing guard tests**

Inject `runGit` so tests cover a main checkout, a linked worktree under `.worktrees`, a linked worktree on `master`, and dirty finish state without invoking the real repository.

```js
test("rejects the main checkout", () => {
  assert.throws(
    () => assertWorktreeSafe({ gitDir: "D:/storyos/.git", gitCommonDir: "D:/storyos/.git", branch: "master", worktreePath: "D:/storyos" }),
    /linked worktree/i,
  );
});
```

- [ ] **Step 2: Run the guard test and verify it fails for the missing module**

Run: `node --test scripts/__tests__/worktree-guard.test.mjs`

Expected: FAIL because the guard module does not exist yet.

- [ ] **Step 3: Implement guard context and CLI**

Export `readWorktreeContext(cwd, runGit)` and `assertWorktreeSafe(context, options)`. The default CLI runs the location/branch checks; `--for-finish` additionally requires clean worktree and main checkout status. Errors must include the actual worktree path and branch.

- [ ] **Step 4: Run the guard tests and add the check command**

Run: `node --test scripts/__tests__/worktree-guard.test.mjs`

Expected: PASS.

Add:

```json
"worktree:check": "node scripts/worktree-guard.mjs",
"predev": "node scripts/worktree-guard.mjs"
```

- [ ] **Step 5: Commit the guard**

```bash
git add scripts/worktree-guard.mjs scripts/__tests__/worktree-guard.test.mjs package.json
git commit -m "feat: guard development commands to worktrees"
```

### Task 3: Integrate the lock and guard into finish-worktree

**Files:**
- Modify: `scripts/finish-worktree.mjs`
- Modify: `scripts/__tests__/worktree-lock.test.mjs`

- [ ] **Step 1: Add a failing integration assertion**

Add a test that acquires the common-directory finish lock and verifies a second simulated finisher is rejected before any merge operation can run.

- [ ] **Step 2: Run the integration test and confirm it fails**

Run: `node --test scripts/__tests__/worktree-lock.test.mjs`

Expected: FAIL until `finish-worktree.mjs` uses the shared lock path and metadata.

- [ ] **Step 3: Refactor finish-worktree to reuse the guard**

Replace duplicated path/branch/status checks with `readWorktreeContext` and `assertWorktreeSafe(..., { forFinish: true })`. Preserve `--dry-run` as a read-only operation.

- [ ] **Step 4: Wrap checkout/pull/merge/push/cleanup in the finish lock**

Acquire `.git/codex-finish.lock` after dry-run and before checkout. Use a `try/finally` to release it even when pull, merge, push, or cleanup fails. Keep the existing “main checkout must be clean” and base-branch checks.

- [ ] **Step 5: Run the workflow tests and dry-run check**

Run: `pnpm test:workflow`

Expected: PASS.

Run: `node scripts/finish-worktree.mjs --base master --dry-run`

Expected: the current linked worktree plan is printed without changing Git state.

- [ ] **Step 6: Commit finish integration**

```bash
git add scripts/finish-worktree.mjs scripts/__tests__
git commit -m "feat: serialize worktree finish operations"
```

### Task 4: Add isolated Studio launcher and documentation

**Files:**
- Create: `scripts/studio-dev.mjs`
- Create: `scripts/__tests__/studio-dev.test.mjs`
- Modify: `packages/studio/package.json`
- Modify: `AGENTS.md`
- Modify: `package.json`

- [ ] **Step 1: Write failing launcher/config tests**

Test command construction with injected spawn and filesystem functions. Verify that the launcher creates task-scoped log/screenshot directories, passes the generated client/server ports, uses the current worktree as `INKOS_PROJECT_ROOT`, and forwards termination to both child processes.

- [ ] **Step 2: Run the launcher test and verify it fails**

Run: `node --test scripts/__tests__/studio-dev.test.mjs`

Expected: FAIL because `scripts/studio-dev.mjs` does not exist yet.

- [ ] **Step 3: Implement the cross-platform launcher**

Use `spawn` with `shell: false` to start `tsx watch src/api/index.ts` and `vite --host --port <clientPort>` from `packages/studio`. Write each process's stdout/stderr to the task-scoped `.studio-live/<task-slug>/` files, create `.screenshots/<task-slug>/`, probe available ports, and kill both children on SIGINT/SIGTERM.

- [ ] **Step 4: Run launcher tests and update package commands**

Run: `node --test scripts/__tests__/studio-dev.test.mjs`

Expected: PASS.

Change `packages/studio`'s `dev` script to `node ../../scripts/studio-dev.mjs`; leave `dev:client` and `dev:server` available for explicit manual use. Add `worktree:runtime` to the root package scripts for printing the generated configuration.

- [ ] **Step 5: Update AGENTS.md runtime instructions**

Document `pnpm worktree:check`, `pnpm worktree:runtime`, and `pnpm --dir packages/studio dev`. Replace hard-coded shared log/port commands in the Studio restart section with the task-aware launcher while preserving the required automatic restart after finish.

- [ ] **Step 6: Run focused tests and commit the launcher/docs**

```bash
pnpm test:workflow
pnpm --dir packages/studio test -- --run src/api/studio-preferences-db.test.ts
git diff --check
git add scripts/studio-dev.mjs scripts/__tests__ packages/studio/package.json package.json AGENTS.md
git commit -m "feat: isolate Studio runtime per worktree"
```

### Task 5: Full verification and handoff

**Files:**
- Modify only files needed to address verification failures.

- [ ] **Step 1: Run the complete workflow test suite**

Run: `pnpm test:workflow`

Expected: all workflow tests pass.

- [ ] **Step 2: Run repository checks**

Run: `pnpm test`

Expected: all existing package tests pass.

Run: `pnpm typecheck`

Expected: exit code 0.

Run: `git diff --check`

Expected: no output and exit code 0.

- [ ] **Step 3: Verify worktree state and preserve unrelated main files**

Run:

```bash
git status --short
git diff master...HEAD --stat
git -C ../.. status --short --branch
```

Expected: only intended worktree files are changed; the main checkout's existing `shorts/` remains untouched.

- [ ] **Step 4: Commit any final verified adjustments**

```bash
git add scripts packages/studio/package.json package.json AGENTS.md
git commit -m "chore: verify parallel workflow guards"
```

- [ ] **Step 5: Finish the worktree**

Run from this worktree:

```bash
node scripts/finish-worktree.mjs --base master
```

Expected: the lock serializes final merge/push, the branch merges to `master`, the branch/worktree is removed, and stale worktree metadata is pruned. If the repository's Studio code changed, restart Studio using the updated task-aware command after the merge.
