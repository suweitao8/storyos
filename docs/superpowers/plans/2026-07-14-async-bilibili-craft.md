# Async Bilibili Craft Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Bilibili writing-craft creation return immediately while video import, subtitle correction, and craft analysis continue in the background.

**Architecture:** Persist processing metadata in each craft directory, expose a status endpoint, and run one in-memory background task per craft. The existing synchronous import endpoint and novel workflow stay compatible; only the Bilibili create-page path switches to the new async endpoint. Craft detail polls status and transitions from a pending shell to the existing profile view.

**Tech Stack:** TypeScript, Vitest, Hono, React, existing PipelineRunner and SSE/runtime conventions.

---

## Task 1: Extend craft metadata and pipeline status persistence

**Files:**
- Modify: `packages/core/src/models/craft-profile.ts`
- Modify: `packages/core/src/pipeline/runner.ts`
- Test: `packages/core/src/__tests__/craft-source-idempotency.test.ts` or a focused new test beside the runner

- [ ] Add optional processing fields to `CraftMeta` and helper types.
- [ ] Add `PipelineRunner.createPendingCraft(...)` to create `crafts/<id>/meta.json` without a profile.
- [ ] Add `PipelineRunner.updateCraftProcessing(...)` to update status/stage/error without touching profile data.
- [ ] Make `analyzeCraft(... existingCraftId)` write `processingStatus: "ready"` in the final metadata.
- [ ] Test pending metadata creation, status updates, and old metadata compatibility.
- [ ] Run `pnpm --dir packages/core test -- craft-source-idempotency.test.ts` and `pnpm --dir packages/core typecheck`.
- [ ] Commit: `feat: persist async craft processing status`.

## Task 2: Add the immediate Bilibili create endpoint and background worker

**Files:**
- Modify: `packages/studio/src/api/server.ts`
- Modify: `packages/studio/src/api/server.test.ts` or create `packages/studio/src/__tests__/craft-bilibili-async-endpoint.test.ts`

- [ ] Add `POST /api/v1/craft/bilibili/create` that validates `parseBvid`, creates pending metadata, starts a guarded background task, and returns `{ status: "processing", craftId, meta }` without waiting for Bilibili or LLM calls.
- [ ] Extract/reuse the existing import, subtitle correction, source-asset persistence, and `analyzeCraft` flow in a worker that passes `existingCraftId`.
- [ ] Broadcast `craft:start`, stage logs, `craft:complete`, and `craft:error` with the craft ID.
- [ ] Ensure only one worker runs per craft ID and a failed worker stores `processingStatus: "error"` plus a retryable source reference.
- [ ] Add `GET /api/v1/crafts/:id/status` with ready fallback for old profiles and pending/error metadata responses.
- [ ] Add `POST /api/v1/crafts/:id/retry` for failed Bilibili crafts, guarded against duplicates.
- [ ] Permit `/crafts/recent` to select pending crafts and let source/status reads distinguish pending from missing profile.
- [ ] Test immediate response timing/data, success with same craft ID, error persistence, retry, and invalid BV input.
- [ ] Run focused Studio API tests and typecheck.
- [ ] Commit: `feat: create bilibili crafts asynchronously`.

## Task 3: Switch CraftManager to async creation and pending metadata

**Files:**
- Modify: `packages/studio/src/pages/CraftManager.tsx`
- Modify/add: `packages/studio/src/pages/craft-profile-view.test.ts` and `packages/studio/src/pages/CraftManager.test.ts` as appropriate

- [ ] Extend local `CraftMeta` with processing status/stage/error and allow `CraftCreate` success without a profile.
- [ ] Change the Bilibili create handler to call `/craft/bilibili/create`, then immediately select the returned craft and enter detail; keep novel upload on the existing synchronous path.
- [ ] Pass selected metadata into `CraftDetail` so it can render without a profile.
- [ ] Render processing/error badges in craft cards.
- [ ] Add pending detail shell with stage, BVID/source name, refresh state, and retry action.
- [ ] Poll `/crafts/:id/status` only while processing; on ready load profile/source and refresh the craft list; on error stop polling and show retry.
- [ ] Test status transitions and old ready metadata behavior.
- [ ] Run client tests and Studio typecheck.
- [ ] Commit: `feat: show async bilibili craft progress`.

## Task 4: Verification and repository close-out

- [ ] Run focused core and Studio tests.
- [ ] Run `pnpm --dir packages/studio typecheck` and `pnpm --dir packages/studio build`.
- [ ] Run `git diff --check`, inspect status, and ensure no generated files are tracked.
- [ ] Run the full relevant Studio suite; separate unrelated baseline failures from this change.
- [ ] Commit final test adjustments if needed.
- [ ] Run `node scripts/finish-worktree.mjs --base master` from the worktree, prune/clean any Windows residue safely, and restart Studio from main checkout.

