# InkOS Overall Architecture Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gradually separate the Studio API composition root from route and boundary modules while preserving all existing HTTP, Core, CLI, file, and event contracts.

**Architecture:** `createStudioServer` remains the only Hono composition root. Route factories receive explicit `StudioRouteContext` dependencies and return registration functions; they do not import or mutate server-local state. The first implementation slice extracts shared API boundary helpers and the story-assets route cluster, then applies the same pattern to project/config and story routes. Existing `server.ts` tests remain the contract suite while focused route tests cover new module seams.

**Tech Stack:** TypeScript 5.8, Hono 4, Vitest 3, pnpm workspaces, `@actalk/inkos-core`.

---

## File map

- Create: `packages/studio/src/api/routes/context.ts` — explicit read-only and callback dependencies shared by route factories.
- Create: `packages/studio/src/api/routes/boundary.ts` — API error conversion, request parsing, language and response helpers that do not own application state.
- Create: `packages/studio/src/api/routes/story-assets.ts` — story asset validation, manifest, extraction, patch, image generation and image serving routes.
- Create: `packages/studio/src/api/routes/project.ts` — project/config, services, prompts, skills, files, artifacts and language routes.
- Create: `packages/studio/src/api/routes/stories.ts` — books/shorts listing, content, chapters, truth, writing, audit, revision, imports and exports.
- Create: `packages/studio/src/api/routes/index.ts` — route registration composition for extracted modules.
- Create: `packages/studio/src/api/routes/__tests__/boundary.test.ts` — pure boundary regression tests.
- Modify: `packages/studio/src/api/server.ts` — retain middleware, lifecycle state and route-context construction; remove migrated route bodies.
- Modify: `packages/studio/src/api/server.test.ts` — only when a moved test needs a focused fixture or a route contract assertion must be clarified.
- Test: `packages/studio/src/api/server.test.ts` — unchanged as the end-to-end API compatibility suite.

## Invariants

1. `createStudioServer(initialConfig, root, overrides)` remains the only public server factory.
2. Every existing `/api/v1/...` path, status code, JSON shape, SSE event and filesystem path remains unchanged.
3. No route module reads process globals or `cachedConfig` directly; all mutable behavior comes through context callbacks.
4. `ApiError` is converted to the same `{ error: { code, message } }` response shape at the same boundary.
5. The root checkout's unrelated untracked `shorts/` directory is never staged.

### Task 1: Add explicit route context and pure boundary helpers

**Files:**
- Create: `packages/studio/src/api/routes/context.ts`
- Create: `packages/studio/src/api/routes/boundary.ts`
- Create: `packages/studio/src/api/routes/__tests__/boundary.test.ts`
- Modify: `packages/studio/src/api/server.ts:1-150`

- [ ] **Step 1: Define the context contract without importing `server.ts`**

Add the smallest shared contract needed by route modules:

```ts
import type { Hono } from "hono";
import type {
  NodeImageDeps,
  PipelineConfig,
  ProjectConfig,
  StateManager,
  StudioLanguage,
} from "@actalk/inkos-core";

export interface StudioRouteContext {
  readonly app: Hono;
  readonly root: string;
  readonly state: StateManager;
  readonly overrides: { readonly nodeImageGenerator?: NodeImageDeps };
  readonly getProjectConfig: (options?: { readonly requireApiKey?: boolean }) => Promise<ProjectConfig>;
  readonly getLanguage: () => Promise<StudioLanguage>;
  readonly buildPipelineConfig: (options?: {
    readonly currentConfig?: ProjectConfig;
    readonly sessionIdForSSE?: string;
    readonly bookIdForSettings?: string;
    readonly externalContext?: string;
  }) => Promise<PipelineConfig>;
  readonly broadcast: (event: string, data: unknown) => void;
}
```

Use the actual Core-exported language type available in the repository; if the type is private to `server.ts`, define the route-local union as `"zh" | "en"` instead of exporting server internals.

- [ ] **Step 2: Move only pure response and input helpers**

Move `storyAssetErrorMessage`, generic API error response conversion, language selection, attachment disposition, and path normalization helpers into `boundary.ts`. Keep helpers that close over `root`, caches, or `broadcast` in `server.ts` until their route module is extracted.

The boundary module must expose functions with explicit inputs:

```ts
export function errorResponse(c: Context, error: unknown): Response;
export function normalizeLanguage(value: unknown): "zh" | "en";
export function attachmentDisposition(fileName: string): string;
export function normalizeRelativePath(value: string): string;
```

- [ ] **Step 3: Add pure regression tests before wiring routes**

Cover invalid language fallback, CR/LF removal in attachment names, path traversal rejection, `ApiError` status/code preservation, and generic error redaction. Run:

```bash
pnpm --filter @actalk/inkos-studio exec vitest run src/api/routes/__tests__/boundary.test.ts
```

Expected: all new boundary tests pass.

- [ ] **Step 4: Replace server-local calls with the boundary functions**

Update only equivalent helper call sites in `server.ts`; do not change route behavior. Run:

```bash
pnpm --filter @actalk/inkos-studio typecheck
pnpm --filter @actalk/inkos-studio exec vitest run src/api/routes/__tests__/boundary.test.ts src/api/server.test.ts
```

Expected: typecheck succeeds and the existing server suite remains green.

- [ ] **Step 5: Commit the boundary seam**

```bash
git add packages/studio/src/api/routes/context.ts packages/studio/src/api/routes/boundary.ts packages/studio/src/api/routes/__tests__/boundary.test.ts packages/studio/src/api/server.ts
git commit -m "refactor(studio): define explicit api route boundaries"
```

### Task 2: Extract the story-assets route cluster

**Files:**
- Create: `packages/studio/src/api/routes/story-assets.ts`
- Modify: `packages/studio/src/api/routes/context.ts`
- Modify: `packages/studio/src/api/routes/index.ts`
- Modify: `packages/studio/src/api/server.ts:148-3120`
- Test: `packages/studio/src/api/server.test.ts`

- [ ] **Step 1: Define the asset-specific context extension**

Add a factory contract that receives the existing server callbacks instead of importing `server.ts`:

```ts
export interface StoryAssetRouteContext extends StudioRouteContext {
  readonly loadStoryAssetSources: (kind: StoryAssetRouteKind, storyId: string) => Promise<StoryAssetSources>;
  readonly loadStoryAssetManifest: (kind: StoryAssetRouteKind, storyId: string) => Promise<StoryAssetManifestContext>;
  readonly createStoryAssetTextModel: (config: PipelineConfig) => StoryAssetTextModel;
}

export function registerStoryAssetRoutes(context: StoryAssetRouteContext): void;
```

Keep the kind/id validation and manifest/file-writer construction in the module so its security boundary is independently reviewable.

- [ ] **Step 2: Move asset operations without changing route paths**

Move the handlers currently registered for:

```text
/api/v1/stories/:kind/:id/assets
/api/v1/books/:id/assets
/api/v1/shorts/:id/assets
/api/v1/.../assets/extract
/api/v1/.../assets/:assetId
/api/v1/.../assets/:assetId/generate-image
/api/v1/.../assets/generate-missing*
/api/v1/.../assets/images/:assetId
/api/v1/.../assets/:assetId/image
```

The compatibility aliases must call the same handler function, not duplicate implementation.

- [ ] **Step 3: Register the module from the composition root**

Create `routes/index.ts` with explicit registration:

```ts
export function registerStudioRoutes(context: StudioRouteContext): void {
  registerStoryAssetRoutes(createStoryAssetRouteContext(context));
}
```

`server.ts` builds the context after `cachedConfig`, `buildPipelineConfig`, `broadcast`, and the asset persistence callbacks exist, then calls `registerStudioRoutes(context)` once.

- [ ] **Step 4: Run the asset contract suite**

```bash
pnpm --filter @actalk/inkos-studio exec vitest run src/api/server.test.ts src/__tests__/story-assets-view.test.ts
pnpm --filter @actalk/inkos-studio typecheck
```

Expected: all asset and server tests pass with unchanged response payloads.

- [ ] **Step 5: Commit the extraction**

```bash
git add packages/studio/src/api/routes packages/studio/src/api/server.ts packages/studio/src/api/server.test.ts
git commit -m "refactor(studio): extract story asset routes"
```

### Task 3: Extract project and configuration routes

**Files:**
- Create: `packages/studio/src/api/routes/project.ts`
- Modify: `packages/studio/src/api/routes/context.ts`
- Modify: `packages/studio/src/api/routes/index.ts`
- Modify: `packages/studio/src/api/server.ts:3715-4500, 5679-6010`
- Test: `packages/studio/src/api/server.test.ts`

- [ ] **Step 1: Define project/config ports**

Expose callbacks for config load/save, secrets, provider probes, built-in prompt lookup, capability skill lookup, and safe project artifact reads/writes. The route module must not receive or mutate the raw `cachedConfig` variable.

- [ ] **Step 2: Move service, cover, voice, prompt-pack, skill, project-file, language, notification, detection and model-override routes**

Preserve every route path and existing aliases. Keep provider-specific probing in the injected callback layer; the route module only validates request input and serializes the result.

- [ ] **Step 3: Add focused request contract tests**

Move only tests that exercise pure project/config request mapping into `packages/studio/src/api/routes/__tests__/project.test.ts`; leave lifecycle and integration coverage in `server.test.ts`.

- [ ] **Step 4: Verify and commit**

```bash
pnpm --filter @actalk/inkos-studio exec vitest run src/api/server.test.ts src/api/routes/__tests__/project.test.ts
pnpm --filter @actalk/inkos-studio typecheck
git add packages/studio/src/api/routes packages/studio/src/api/server.ts packages/studio/src/api/server.test.ts
git commit -m "refactor(studio): extract project configuration routes"
```

### Task 4: Extract story workflow routes and finalize the Studio API composition root

**Files:**
- Create: `packages/studio/src/api/routes/stories.ts`
- Modify: `packages/studio/src/api/routes/context.ts`
- Modify: `packages/studio/src/api/routes/index.ts`
- Modify: `packages/studio/src/api/server.ts:3123-3690, 4508-4670, 5696-6540`
- Test: `packages/studio/src/api/server.test.ts`

- [ ] **Step 1: Define story workflow callbacks**

Inject list/detail/content loaders, pipeline creation, book mutation operations, session/run status lookup, export artifact creation, and safe truth-file access. The route module should not construct `PipelineRunner` directly.

- [ ] **Step 2: Move book/short listing, content, chapter, truth, plan/compose/write/audit/revise, review, import, export, delete and update handlers**

Keep book ID middleware at the composition root. Reuse the existing `isSafeBookId` check and response conversion rather than introducing a second validator.

- [ ] **Step 3: Verify all Studio API contracts**

```bash
pnpm --filter @actalk/inkos-studio exec vitest run src/api/server.test.ts
pnpm --filter @actalk/inkos-studio typecheck
pnpm --filter @actalk/inkos-studio build
```

Expected: `server.ts` still exports `createStudioServer` and `startStudioServer`, and the server test file reports the same passing count or more.

- [ ] **Step 4: Commit the completed Stage 1 API refactor**

```bash
git add packages/studio/src/api/routes packages/studio/src/api/server.ts packages/studio/src/api/server.test.ts
git commit -m "refactor(studio): split api routes from server composition"
```

### Task 5: Full repository verification and handoff to Core refactor

**Files:**
- Modify: none unless verification reveals a regression.

- [ ] **Step 1: Run the full required checks**

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm audit:semantic-patterns
pnpm verify:publish-manifests
git diff --check
```

- [ ] **Step 2: Confirm the final diff boundary**

```bash
git status --short
git diff --stat origin/master...HEAD
```

Expected: only Stage 1 route modules, server wiring, focused tests, and plan/spec docs are present; unrelated `shorts/` remains outside the staged diff.

- [ ] **Step 3: Record the next phase without changing behavior**

Add a short note to the final handoff identifying the next independent plan: extract `PipelineRunner` into `BookLifecycleService`, `ChapterWorkflowService`, `StateSyncService`, `ImportService`, and `PipelineRuntime`, preserving the current façade.
