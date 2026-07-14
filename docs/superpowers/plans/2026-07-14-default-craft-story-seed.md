# Default Craft Story Seed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist one default story seed per writing craft, pre-generate it in the background after craft analysis, and require explicit user action for later regeneration.

**Architecture:** Reuse `crafts/<craftId>/story_seed.json` and expose seed status through `CraftMeta`. A Studio-local background task generates the seed after a craft profile exists; the existing SSE generation route remains the explicit regeneration path. Craft detail receives a dedicated story-seed tab, while StoryCreationPanel consumes cached seeds and never auto-starts a model request.

**Tech Stack:** TypeScript, Vitest, Hono, React, SSE, `PipelineRunner`, existing `StorySeed` parser/prompt.

---

### Task 1: Define and verify persisted seed status

**Files:**
- Modify: `packages/core/src/models/craft-profile.ts`
- Modify: `packages/core/src/pipeline/runner.ts`
- Test: `packages/core/src/__tests__/pipeline-runner.test.ts`

- [ ] **Step 1: Write failing tests** for `saveCraftStorySeed` setting `storySeedStatus: "ready"`, pending/error status updates, and preserving a previous seed when an error is recorded.
- [ ] **Step 2: Run the focused Core tests** and confirm they fail because the status fields/method do not exist.
- [ ] **Step 3: Add optional `storySeedStatus`/`storySeedError` fields and a small `updateCraftStorySeedStatus` runner method; make `saveCraftStorySeed` mark ready.** Keep `story_seed.json` unchanged.
- [ ] **Step 4: Run the focused Core tests** and confirm they pass.
- [ ] **Step 5: Commit** `feat: persist craft story seed status`.

### Task 2: Add background default-seed generation

**Files:**
- Modify: `packages/studio/src/api/server.ts`
- Modify: `packages/studio/src/__tests__/craft-bilibili-import-endpoint.test.ts`
- Modify: `packages/studio/src/api/server.test.ts`

- [ ] **Step 1: Write failing API tests** covering the background generator’s no-duplicate behavior, skipping an existing seed, and the novel analyze route returning before the seed generation promise resolves.
- [ ] **Step 2: Run those tests** and confirm the expected missing background behavior.
- [ ] **Step 3: Implement a `craftStorySeedTasks` map and `startCraftStorySeedGeneration` helper** using `buildStorySeedPrompt`, `chatCompletion`, `parseStorySeed`, `PipelineRunner.saveCraftStorySeed`, and the existing no-thinking LLM call options. Record pending/error status and broadcast completion/error events.
- [ ] **Step 4: Start the helper after synchronous `/craft/analyze` returns and await it inside the existing Bilibili background pipeline after profile analysis.** Do not start it when a valid seed already exists.
- [ ] **Step 5: Make `/crafts/:id/story-direction/stream` immediately return a cached seed when no replacement direction is requested, without calling the model.
- [ ] **Step 6: Run the API tests** and confirm they pass.
- [ ] **Step 7: Commit** `feat: pre-generate craft story seeds in background`.

### Task 3: Add the story-seed detail tab and explicit regeneration

**Files:**
- Modify: `packages/studio/src/pages/CraftManager.tsx`
- Modify: `packages/studio/src/pages/story-seed-stream.ts` if a reusable stream helper is needed
- Modify: `packages/studio/src/pages/CraftManager.test.ts`
- Modify: `packages/studio/src/pages/craft-profile-view.test.ts`

- [ ] **Step 1: Write failing view/helper tests** for the new tab label, cached seed rendering, pending/error states, and explicit regeneration not being disabled merely because no seed exists.
- [ ] **Step 2: Run the focused Studio page tests** and confirm the missing behavior.
- [ ] **Step 3: Add a dedicated “故事设定” tab** that renders `StorySeedPreview`/serialized sections, status text, and a manual stream regeneration action that saves the returned seed.
- [ ] **Step 4: Reload the profile/meta after save** so the list and detail data share the same cached seed.
- [ ] **Step 5: Run the page tests and typecheck**.
- [ ] **Step 6: Commit** `feat: add craft story seed editor`.

### Task 4: Stop implicit generation in story creation and reuse cache

**Files:**
- Modify: `packages/studio/src/pages/StoryCreationPanel.tsx`
- Modify: `packages/studio/src/pages/story-creation-state.ts`
- Modify: `packages/studio/src/pages/story-creation-state.test.ts`

- [ ] **Step 1: Write failing tests** proving selecting a craft without `storySeed` leaves the short story seed idle and that a cached seed serializes directly into the creation direction.
- [ ] **Step 2: Run the focused state tests** and confirm the current auto-generation expectation fails.
- [ ] **Step 3: Remove the no-seed `useEffect` generation branch**; retain the existing explicit regenerate button and save flow. For long stories, use the cached serialized seed as the initial direction and retain manual direction regeneration.
- [ ] **Step 4: Run the focused page/state tests** and verify no implicit stream request is issued.
- [ ] **Step 5: Commit** `fix: reuse cached craft story seeds`.

### Task 5: Full verification and handoff

**Files:**
- No new production files; inspect all changed files and docs.

- [ ] **Step 1: Run `pnpm worktree:check`.**
- [ ] **Step 2: Run Core focused tests, Studio focused tests, Core/Studio typechecks, and Studio client/server builds.**
- [ ] **Step 3: Run `git diff --check` and verify `git status --short` contains only intended files.
- [ ] **Step 4: Commit any final test-only/doc adjustments.**
- [ ] **Step 5: Run `node scripts/finish-worktree.mjs --base master`, verify master/push/worktree state, and restart Studio because Core and Studio changed.
