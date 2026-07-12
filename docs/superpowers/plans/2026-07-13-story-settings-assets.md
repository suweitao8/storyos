# Story Settings And Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the story workspace into full-width settings, adjustment, and story-assets stages, automatically extract text-only character/scene/prop assets, and generate one reference image per asset only after an explicit user action.

**Architecture:** Existing story files remain the source of truth for settings and chapters. A story-local `assets/manifest.json` stores normalized assets and image state. Core owns extraction, merge, persistence, and image generation; Studio owns safe API routes, stage navigation, settings presentation, and asset cards.

**Tech Stack:** TypeScript, Zod, Vitest, React 19, Hono Studio API, existing `useApi`/`postApi`, existing cover image provider resolution and `generateImageFromPrompt`.

---

## Files And Responsibilities

- Create `packages/core/src/models/story-assets.ts`: asset types, lifecycle, manifest validation, id/name normalization, and merge helpers.
- Create `packages/core/src/agents/story-assets.ts`: text-model extraction prompt and tolerant JSON parser.
- Create `packages/core/src/pipeline/story-assets-runner.ts`: story content loading, extraction, manifest persistence, single-image and batch-image operations.
- Modify `packages/core/src/index.ts`: export the story asset types and runner functions.
- Create `packages/core/src/__tests__/story-assets.test.ts`: contract, extraction, merge, and image lifecycle tests.
- Modify `packages/studio/src/api/server.ts`: safe story asset routes and manifest-referenced image serving.
- Modify `packages/studio/src/api/server.test.ts`: route, persistence, no-auto-image, batch, and traversal tests.
- Create `packages/studio/src/pages/story-workspace-state.ts` and `.test.ts`: stage ids, labels, default, and disabled future stages.
- Create `packages/studio/src/pages/StorySettingsPanel.tsx`: full-width grouped existing story settings/content view.
- Create `packages/studio/src/pages/StoryAssetsPanel.tsx` and `story-assets-view.test.ts`: filters, cards, status, and explicit image actions.
- Modify `packages/studio/src/pages/ChatPage.tsx`: stage navigation and full-width settings/assets/adjustment rendering.
- Reuse or minimally refactor `packages/studio/src/components/chat/StoryContentPanel.tsx` only for shared response types/helpers; do not retain the permanent chat/content split.

## Task 1: Core Asset Contract

**Files:** create `packages/core/src/models/story-assets.ts`, modify `packages/core/src/index.ts`, test `packages/core/src/__tests__/story-assets.test.ts`.

- [ ] Write failing tests for `normalizeStoryAssetKind("人物") === "character"`, Chinese scene/prop aliases, blank-name rejection, duplicate `(kind, normalizedName)` collapse, and `mergeStoryAssets` preserving an existing ready image path when text fields are refreshed.
- [ ] Run `pnpm --filter @actalk/inkos-core exec vitest run src/__tests__/story-assets.test.ts`; expected failure because the helpers do not exist.
- [ ] Implement `StoryAssetKind = "character" | "scene" | "prop"`, image statuses `missing | generating | ready | error`, `StoryAsset`, `StoryAssetDraft`, `StoryAssetManifest`, `createEmptyStoryAssetManifest`, `normalizeStoryAssetKind`, `normalizeStoryAssetName`, and `mergeStoryAssets`.
- [ ] Export all public types/helpers from `packages/core/src/index.ts`, rerun the focused test, and commit `feat: add story asset manifest contract`.

## Task 2: Text-Only Extraction

**Files:** create `packages/core/src/agents/story-assets.ts` and `packages/core/src/pipeline/story-assets-runner.ts`; modify `packages/core/src/index.ts`; extend `packages/core/src/__tests__/story-assets.test.ts`.

- [ ] Add a fake-runtime test with source text containing one character, one room, and one recurring object. Assert three typed drafts have non-empty summaries and image prompts, and assert no image runtime is called.
- [ ] Run the test and confirm it fails before implementation.
- [ ] Implement `StoryAssetExtractorAgent` with JSON-only output requiring `characters`, `scenes`, and `props`. Parse English/Chinese aliases, discard malformed entries, forbid long copied passages/proper-name dependence, and require reusable visual prompts.
- [ ] Implement `extractStoryAssets({ projectRoot, storyKind, storyId, source, runtime })`: resolve only `books/<id>` or `shorts/<id>`, read settings and story text, load the old manifest, extract drafts, merge while preserving ready images, atomically write `assets/manifest.json`, and return progress plus manifest.
- [ ] Export the runner, run core asset tests, and commit `feat: extract story asset metadata`.

## Task 3: On-Demand Image Lifecycle

**Files:** modify `packages/core/src/pipeline/story-assets-runner.ts`; extend `packages/core/src/__tests__/story-assets.test.ts`.

- [ ] Add failing tests for one-asset ready state/path, batch skipping ready assets, error persistence, retrying an error asset, and extraction never calling image generation.
- [ ] Implement `generateStoryAssetImage`: persist `generating` before calling the existing image runtime, write `assets/images/<assetId>.<ext>`, persist `ready/path/generatedAt`, and persist `error` without deleting the prompt on failure.
- [ ] Implement `generateMissingStoryAssetImages` to process only assets whose image status is not `ready` and return per-asset results for partial success.
- [ ] Run core asset tests and commit `feat: generate story asset reference images on demand`.

## Task 4: Studio Asset API

**Files:** modify `packages/studio/src/api/server.ts`; test `packages/studio/src/api/server.test.ts`.

- [ ] Add failing tests for `GET /api/v1/stories/short/:id/assets`, `POST .../assets/extract`, `PATCH .../assets/:assetId`, single-image generation, batch generation, image serving, and unsafe id/file rejection.
- [ ] Add a server helper accepting only `kind = "book" | "short"`, validate ids with existing safe-id helpers, and map to `books/<id>` or `shorts/<id>` without accepting filesystem paths.
- [ ] Wire manifest/extract routes to core and broadcast `story-assets:start`, `story-assets:complete`, and `story-assets:error`.
- [ ] Wire patch/single/batch image routes. Serve only manifest-referenced image files with validated extensions; return explicit 404 for missing stories/assets.
- [ ] Run focused API tests and commit `feat: expose story asset APIs`.

## Task 5: Stage Navigation

**Files:** create `packages/studio/src/pages/story-workspace-state.ts` and `.test.ts`.

- [ ] Add failing tests for default `settings`, valid `settings/assets/adjust`, disabled `script/storyboard/video`, and invalid-stage fallback.
- [ ] Implement `STORY_WORKSPACE_STAGES`, `StoryWorkspaceStage`, `resolveStoryWorkspaceStage`, and `buildStoryWorkspaceTabs(isZh)`. First three stages are enabled; future stages have stable disabled labels.
- [ ] Run the focused tests and commit `feat: add story production stage navigation`.

## Task 6: Settings And Assets UI

**Files:** create `packages/studio/src/pages/StorySettingsPanel.tsx`, `StoryAssetsPanel.tsx`, `story-assets-view.test.ts`; minimally reuse `StoryContentPanel.tsx` helpers if needed.

- [ ] Add pure tests for kind filtering, missing/generating/ready/error labels, empty state, and the invariant that mounting never calls an image-generation callback.
- [ ] Implement `StorySettingsPanel` using existing `/books/:id/content` and `/shorts/:id/content` response shapes. Group world rules, outline, packaging, roles, and chapters in a full-width document view; expose `onOpenAdjustment` instead of embedding chat.
- [ ] Implement `StoryAssetsPanel` with `提取资产`, `生成全部缺失图片`, `角色/场景/道具` filters, responsive cards, editable text fields, image prompt display, stable empty-image placeholder, and explicit single/batch generation callbacks.
- [ ] Run Studio view tests and commit `feat: add story settings and assets panels`.

## Task 7: ChatPage Integration

**Files:** modify `packages/studio/src/pages/ChatPage.tsx`; modify `StoryCreationPanel.tsx` only if story id handoff is required; test the existing chat/page state suite plus a focused integration test.

- [ ] Add a failing assertion that a story session registers all six tabs, defaults to `settings`, switches to `assets` without changing the selected story, and renders `adjust` as a full-width chat surface.
- [ ] Replace the current `create/adjust` toolbar registration with `buildStoryWorkspaceTabs`, preserving the creation screen before a story exists and selecting `settings` after creation.
- [ ] Render `StorySettingsPanel` for `settings`, `StoryAssetsPanel` for `assets`, and the current chat for `adjust`; remove the permanent `StoryContentPanel` + chat grid from the adjustment branch.
- [ ] Run focused Studio tests and commit `feat: split story workspace into production stages`.

## Task 8: Verification And Finish

- [ ] Run `pnpm --filter @actalk/inkos-core test`, `typecheck`, and `build`; all must exit `0`.
- [ ] Run `pnpm --filter @actalk/inkos-studio test`, `typecheck`, and `build`; existing Vite chunk-size warnings are acceptable only when there are no errors.
- [ ] With Studio running, extract assets and verify the default path makes no image request; generate one card, then batch-generate and verify ready cards are skipped; refresh and verify manifest/image statuses persist.
- [ ] Run `git diff --check`, `git status --short`, and `git worktree list`; generated story data/logs must stay ignored and only intended source/test/docs changes may remain.
- [ ] Commit final fixes, run `node scripts/finish-worktree.mjs --base master`, preserve unrelated user-owned `shorts/` if detected, restart Studio on `4567/4569`, and verify both endpoints return HTTP `200`.
