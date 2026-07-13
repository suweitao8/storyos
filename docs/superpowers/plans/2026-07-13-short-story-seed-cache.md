# Short Story Seed Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist one complete story seed per writing craft, reuse it during story creation, regenerate only on explicit request, and make the creation workspace full width.

**Architecture:** Store mutable story seeds in `crafts/<id>/story_seed.json`, expose them through the existing craft list/detail pipeline, and add a narrow save endpoint. Hydrate `StoryCreationPanel` from the selected craft’s cached seed; only the explicit regenerate action bypasses the cache. Remove the creation panel’s fixed maximum width while preserving its responsive two-column grid.

**Tech Stack:** TypeScript, React, Hono, Vitest, pnpm workspace packages.

---

### Task 1: Add the persisted seed model and pipeline storage

**Files:**
- Modify: `packages/core/src/models/story-seed.ts`
- Test: `packages/core/src/__tests__/story-seed.test.ts`
- Modify: `packages/core/src/models/craft-profile.ts`
- Modify: `packages/core/src/pipeline/runner.ts`
- Test: `packages/core/src/__tests__/pipeline-runner.test.ts`

- [ ] **Step 1: Write the failing model and storage tests**

  Add a complete seed fixture and tests that assert `isStorySeed` accepts it and rejects missing/blank fields. Add a pipeline test that creates a temporary craft directory with `craft_profile.json`, calls `saveCraftStorySeed`, then asserts `loadCraft` and `listCrafts` expose the saved seed and that the file is stored as `story_seed.json`.

- [ ] **Step 2: Run the focused tests and verify they fail**

  Run `pnpm --filter @actalk/inkos-core test -- src/__tests__/story-seed.test.ts src/__tests__/pipeline-runner.test.ts`.

  Expected result: FAIL because `isStorySeed` and `saveCraftStorySeed` do not exist and the craft types do not expose `storySeed`.

- [ ] **Step 3: Implement the minimal model and storage API**

  Export `isStorySeed(value: unknown): value is StorySeed` by checking all ten `STORY_SEED_SECTION_DEFINITIONS` keys for non-empty strings. Add optional `storySeed?: StorySeed` to `CraftProfile` and `CraftMeta`. In `PipelineRunner`, add `loadCraftStorySeed`, merge a valid `story_seed.json` into `loadCraft`, include it in `listCrafts`, and add `saveCraftStorySeed(craftId, storySeed)` that verifies the profile exists, creates the craft directory if needed, and writes formatted JSON to `story_seed.json`.

- [ ] **Step 4: Run the focused tests and verify they pass**

  Run the same core command and confirm the story-seed and pipeline persistence tests pass.

- [ ] **Step 5: Commit the core storage slice**

  Run `git diff --check`, then commit with `git add packages/core/src/models/story-seed.ts packages/core/src/models/craft-profile.ts packages/core/src/pipeline/runner.ts packages/core/src/__tests__/story-seed.test.ts packages/core/src/__tests__/pipeline-runner.test.ts && git commit -m "feat: persist story seeds with writing crafts"`.

### Task 2: Add the story-seed save API

**Files:**
- Modify: `packages/studio/src/api/server.ts`
- Test: `packages/studio/src/api/server.test.ts`

- [ ] **Step 1: Write the failing API tests**

  Extend the mocked pipeline runner with `saveCraftStorySeed`. Add tests for a valid `PUT /api/v1/crafts/craft-1/story-seed`, malformed or blank seed input, and a missing craft. Assert valid input calls the pipeline method and returns the seed, while invalid input returns `INVALID_CRAFT_REQUEST` and never writes.

- [ ] **Step 2: Run the focused API tests and verify they fail**

  Run `pnpm --filter @actalk/inkos-studio test -- src/api/server.test.ts`.

  Expected result: FAIL because the route and mock method are not implemented.

- [ ] **Step 3: Implement the route**

  Import `isStorySeed` and `type StorySeed` from the core entry. Add `PUT /api/v1/crafts/:id/story-seed` before the catch-all craft detail route. Normalize the ID, parse an object body, require a valid `storySeed`, load the craft to return `CRAFT_NOT_FOUND` for missing profiles, call `saveCraftStorySeed`, and return `{ storySeed }`.

- [ ] **Step 4: Run the focused API tests and verify they pass**

  Run `pnpm --filter @actalk/inkos-studio test -- src/api/server.test.ts` and confirm the complete server suite passes.

- [ ] **Step 5: Commit the API slice**

  Run `git diff --check`, then commit with `git add packages/studio/src/api/server.ts packages/studio/src/api/server.test.ts && git commit -m "feat: add story seed persistence endpoint"`.

### Task 3: Reuse cached seeds in the creation UI

**Files:**
- Modify: `packages/studio/src/pages/story-creation-state.ts`
- Test: `packages/studio/src/pages/story-creation-state.test.ts`
- Modify: `packages/studio/src/pages/ChatPage.tsx`
- Modify: `packages/studio/src/pages/StoryCreationPanel.tsx`

- [ ] **Step 1: Write the failing state tests**

  Add a pure `shouldAutoGenerateShortStorySeed` helper and test that it returns false for a cached seed, true for an uncached selected craft, and true for an uncached no-craft session. Add a UI/API test seam for saving a seed through `PUT /crafts/:id/story-seed`.

- [ ] **Step 2: Run the focused UI tests and verify they fail**

  Run `pnpm --filter @actalk/inkos-studio test -- src/pages/story-creation-state.test.ts src/pages/StoryCreationPanel.test.ts`.

  Expected result: FAIL because the helper and save callback do not exist and the layout test still expects the old max width.

- [ ] **Step 3: Implement cache hydration and explicit regeneration**

  Extend `CraftOption` with `storySeed?: StorySeed`. Add `onSaveSeed` to `StoryCreationPanel` and `saveStorySeed` to `ChatPage`. In the short-story effect, reset from `selectedCraft.storySeed` and return early with ready status when it exists. Keep generation for cache misses. In both initial generation and explicit regeneration, save the returned seed for the selected craft, surface persistence errors without clearing the valid preview, and refetch the craft list after a successful save. Keep the existing `previousDirection` behavior for explicit regeneration.

- [ ] **Step 4: Remove the creation-page width cap**

  Change `STORY_CREATION_LAYOUT_CLASSES.workspace` to a full-width scroll container such as `flex h-full w-full min-w-0 flex-col overflow-y-auto px-4 py-6 md:px-8 xl:px-10`, without `mx-auto` or `max-w-[1440px]`. Keep the columns grid and add only the `min-w-0` constraints needed to prevent long seed text from overflowing.

- [ ] **Step 5: Run the focused UI tests and verify they pass**

  Run `pnpm --filter @actalk/inkos-studio test -- src/pages/story-creation-state.test.ts src/pages/StoryCreationPanel.test.ts src/pages/StorySeedPreview.test.ts`.

  Expected result: PASS, including the no-regeneration cached-seed behavior and the full-width layout assertion.

- [ ] **Step 6: Commit the UI slice**

  Run `git diff --check`, then commit with `git add packages/studio/src/pages/story-creation-state.ts packages/studio/src/pages/story-creation-state.test.ts packages/studio/src/pages/ChatPage.tsx packages/studio/src/pages/StoryCreationPanel.tsx packages/studio/src/pages/StoryCreationPanel.test.ts && git commit -m "fix: reuse cached short story seeds"`.

### Task 4: Verify, integrate, and restart Studio

**Files:**
- No source changes expected.

- [ ] **Step 1: Run the complete relevant validation**

  Run `pnpm --filter @actalk/inkos-core test`, `pnpm --filter @actalk/inkos-studio test`, `pnpm --filter @actalk/inkos-studio typecheck`, `pnpm --filter @actalk/inkos-studio build:client`, and `git diff --check`.

- [ ] **Step 2: Confirm worktree scope**

  Run `git status --short` and verify only the planned files and design/plan documents are present; do not stage changes from other worktrees.

- [ ] **Step 3: Finish the worktree**

  From the worktree run `node scripts/finish-worktree.mjs --base master`, then run `git worktree prune` from the main checkout. Preserve any unrelated concurrent worktree and main-checkout changes if the finish script reports a conflict.

- [ ] **Step 4: Restart Studio after the merge**

  From the main checkout run `pnpm install`, start Studio with `pnpm --dir packages/studio dev`, wait five seconds, and verify the listener with `pnpm worktree:runtime`.
