# Movie Source Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a Bilibili commentary craft map each narration anchor to a user-provided original-film time range and use only that original-film material for previews and production references.

**Architecture:** Keep the commentary source and original-film source separate. A pure timeline service probes the original video and creates deterministic scene thumbnails; an alignment service asks the configured model to choose from those bounded scenes, never to invent free-form timestamps. The Studio UI exposes candidates and requires confirmation before a source segment can be attached to a script shot.

**Tech Stack:** TypeScript, Vitest, Hono, React, ffmpeg/ffprobe, existing `PipelineRunner`/LLM client, retained craft source assets.

---

## Scope decision

This plan delivers a complete, testable alignment vertical slice: upload an original video to an existing Bilibili craft, generate a keyframe timeline, align commentary anchors to bounded original scenes, review/correct/confirm matches, and expose confirmed source references to production. Automatic internet discovery of an original film remains out of scope.

## File map

- Create `packages/core/src/models/source-alignment.ts`: shared timeline, anchor, match, and confirmed reference types plus validation helpers.
- Create `packages/studio/src/api/source-timeline.ts`: ffprobe/ffmpeg adapter, deterministic timeline extraction, and source-time validation.
- Create `packages/studio/src/api/source-alignment.ts`: subtitle-anchor grouping, bounded AI alignment prompt/response parsing, and persisted alignment document helpers.
- Create `packages/studio/src/pages/SourceAlignmentPanel.tsx`: upload, timeline preview, candidate review, time correction, and confirmation UI.
- Modify `packages/core/src/index.ts`: export shared source-alignment models.
- Modify `packages/studio/src/api/craft-source-assets.ts`: distinguish commentary video from original source video and register timeline/frames.
- Modify `packages/studio/src/api/server.ts`: original-video upload, timeline build, alignment, match update, and source-segment preview endpoints.
- Modify `packages/studio/src/pages/CraftManager.tsx`: add the 原片对齐 tab and mount the panel for Bilibili crafts.
- Modify `packages/studio/src/api/story-production.ts` and `packages/studio/src/api/routes/story-production.ts`: accept confirmed source references and use original source segments when a shot requests one; preserve generated-image fallback for shots without references.
- Tests: add focused model, timeline, alignment, endpoint, UI-state, and production-reference tests beside the affected modules.

### Task 1: Define and test source-alignment contracts

**Files:**
- Create: `packages/core/src/models/source-alignment.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/__tests__/source-alignment.test.ts`

- [ ] **Step 1: Write failing tests for valid and invalid source references**

```ts
it("accepts only confirmed references that point to the original source video", () => {
  expect(validateSourceSegmentRef({
    matchId: "match-1",
    sourceFileKey: "sourceVideo",
    startSeconds: 12,
    endSeconds: 18,
    status: "confirmed",
  }, 120)).toEqual({ ok: true });
});

it("rejects commentary-video references, reversed ranges, and suggested matches", () => {
  expect(validateSourceSegmentRef({
    matchId: "match-1",
    sourceFileKey: "commentaryVideo",
    startSeconds: 18,
    endSeconds: 12,
    status: "suggested",
  }, 120)).toMatchObject({ ok: false });
});
```

- [ ] **Step 2: Run the focused test and verify it fails because the contract does not exist**

Run: `pnpm --filter @actalk/inkos-core test -- source-alignment.test.ts`

Expected: FAIL with the missing model/helper error.

- [ ] **Step 3: Implement the minimal shared types and validators**

```ts
export type SourceFileKey = "commentaryVideo" | "sourceVideo";
export type SourceMatchStatus = "suggested" | "confirmed" | "rejected";

export interface SourceScene {
  readonly id: string;
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly thumbnailFile: string;
  readonly visualSummary: string;
  readonly ocrText?: string;
}

export interface SourceTimeline {
  readonly version: 1;
  readonly sourceFileKey: "sourceVideo";
  readonly durationSeconds: number;
  readonly scenes: ReadonlyArray<SourceScene>;
}

export interface NarrationAnchor {
  readonly id: string;
  readonly commentaryStartSeconds: number;
  readonly commentaryEndSeconds: number;
  readonly text: string;
  readonly beatOrder?: number;
}

export interface SourceMatch {
  readonly id: string;
  readonly anchorId: string;
  readonly sceneId: string;
  readonly sourceStartSeconds: number;
  readonly sourceEndSeconds: number;
  readonly confidence: number;
  readonly reason: string;
  readonly status: SourceMatchStatus;
}

export interface SourceSegmentRef {
  readonly matchId: string;
  readonly sourceFileKey: "sourceVideo";
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly status: "confirmed";
}

export function validateSourceSegmentRef(ref: unknown, durationSeconds: number): { ok: true } | { ok: false; reason: string };
```

The validator must require finite numbers, `0 <= start < end <= duration`, `sourceFileKey === "sourceVideo"`, and `status === "confirmed"`.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `pnpm --filter @actalk/inkos-core test -- source-alignment.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the contract**

```bash
git add packages/core/src/models/source-alignment.ts packages/core/src/index.ts packages/core/src/__tests__/source-alignment.test.ts
git commit -m "feat: add source alignment contracts"
```

### Task 2: Store the original video and build a deterministic keyframe timeline

**Files:**
- Modify: `packages/studio/src/api/craft-source-assets.ts`
- Create: `packages/studio/src/api/source-timeline.ts`
- Test: `packages/studio/src/api/source-timeline.test.ts`
- Test: `packages/studio/src/api/craft-source-assets.test.ts`

- [ ] **Step 1: Write failing tests for source-file registration and bounded timeline extraction**

```ts
it("registers the original film separately from the commentary video", () => {
  expect(normalizeCraftSourceFileKey("sourceVideo")).toBe("sourceVideo");
  expect(normalizeCraftSourceFileKey("video")).toBe("commentaryVideo");
});

it("extracts scenes whose ranges are ordered and inside the probed duration", async () => {
  const timeline = await buildSourceTimeline("D:/film.mp4", {
    probe: async () => ({ durationSeconds: 90 }),
    runFfmpeg: async (args) => { await writeFixtureFrame(args); },
    outputDirectory: "D:/timeline",
    sampleEverySeconds: 10,
  });
  expect(timeline.sourceFileKey).toBe("sourceVideo");
  expect(timeline.scenes[0]).toMatchObject({ startSeconds: 0, endSeconds: 10 });
  expect(timeline.scenes.every((scene) => scene.endSeconds <= 90)).toBe(true);
});
```

- [ ] **Step 2: Run the tests and verify the expected missing-function failure**

Run: `pnpm --filter @actalk/inkos-studio test -- source-timeline.test.ts craft-source-assets.test.ts`

Expected: FAIL because source-key normalization and timeline extraction are not implemented.

- [ ] **Step 3: Implement the storage and ffmpeg adapter**

Extend the manifest keys with `commentaryVideo`, `sourceVideo`, `sourceVideoSubtitles`, `timeline`, and `frame`; keep reading legacy `video` as commentary video. Add a dependency-injected timeline builder:

```ts
export interface SourceTimelineDeps {
  readonly probe: (videoPath: string) => Promise<{ durationSeconds: number }>;
  readonly runFfmpeg: (args: ReadonlyArray<string>) => Promise<void>;
  readonly outputDirectory: string;
  readonly sampleEverySeconds?: number;
}

export async function buildSourceTimeline(videoPath: string, deps: SourceTimelineDeps): Promise<SourceTimeline>;
```

The production adapter uses `ffprobe` to read duration and `ffmpeg -ss <time> -i <video> -frames:v 1 -vf scale=640:-2` to write JPEG thumbnails. It must create the output directory, cap the sample interval to at least 1 second, and never write outside the craft source directory.

- [ ] **Step 4: Run the tests and verify timeline output and legacy compatibility**

Run: `pnpm --filter @actalk/inkos-studio test -- source-timeline.test.ts craft-source-assets.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the storage/timeline layer**

```bash
git add packages/studio/src/api/craft-source-assets.ts packages/studio/src/api/source-timeline.ts packages/studio/src/api/source-timeline.test.ts packages/studio/src/api/craft-source-assets.test.ts
git commit -m "feat: index original video keyframes"
```

### Task 3: Add vision-capable bounded alignment and test the parser

**Files:**
- Modify: `packages/core/src/llm/provider.ts`
- Test: `packages/core/src/__tests__/provider-vision.test.ts`
- Create: `packages/studio/src/api/source-alignment.ts`
- Test: `packages/studio/src/api/source-alignment.test.ts`

- [ ] **Step 1: Write failing tests for multimodal messages and bounded match parsing**

```ts
it("serializes a low-detail frame as an image input without changing text-only messages", () => {
  const messages = buildSourceAlignmentMessages({
    anchor: { id: "a1", commentaryStartSeconds: 0, commentaryEndSeconds: 4, text: "主角推开地下室的门" },
    candidates: [{ id: "scene-1", startSeconds: 12, endSeconds: 18, thumbnailDataUrl: "data:image/jpeg;base64,AA==" }],
  });
  expect(messages[1]?.content).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: "image_url" }),
  ]));
});

it("drops model matches that point outside the supplied candidate windows", () => {
  expect(parseSourceMatches('{"matches":[{"sceneId":"scene-1","startSeconds":70,"endSeconds":80,"confidence":0.9}]}', [
    { id: "scene-1", startSeconds: 12, endSeconds: 18, thumbnailDataUrl: "data:image/jpeg;base64,AA==" },
  ])).toEqual([]);
});
```

- [ ] **Step 2: Run the tests and verify they fail before implementation**

Run: `pnpm --filter @actalk/inkos-core test -- provider-vision.test.ts; pnpm --filter @actalk/inkos-studio test -- source-alignment.test.ts`

Expected: FAIL with missing multimodal serialization/parser functions.

- [ ] **Step 3: Extend the LLM boundary without breaking text-only callers**

Add `LLMTextPart` and `LLMImagePart` to `LLMMessage.content`, and convert them to OpenAI chat, Responses, Anthropic, and pi-ai payload shapes. Keep all existing string messages unchanged. Use `detail: "low"` for timeline thumbnails and reject unsupported data URLs before making a request.

- [ ] **Step 4: Implement anchor grouping, prompt construction, and strict parsing**

`groupNarrationAnchors` merges adjacent subtitle entries when the gap is at most 1.2 seconds and the combined text stays under 180 Chinese characters. `buildSourceAlignmentMessages` tells the model that the images are original-film candidates, asks it to select only candidate IDs, and requires JSON containing `sceneId`, `startSeconds`, `endSeconds`, `confidence`, and `reason`. `parseSourceMatches` validates JSON, candidate containment, duration bounds, and confidence range; invalid items are discarded rather than repaired into invented timestamps.

- [ ] **Step 5: Run focused tests and verify green**

Run: `pnpm --filter @actalk/inkos-core test -- provider-vision.test.ts; pnpm --filter @actalk/inkos-studio test -- source-alignment.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the alignment core**

```bash
git add packages/core/src/llm/provider.ts packages/core/src/__tests__/provider-vision.test.ts packages/studio/src/api/source-alignment.ts packages/studio/src/api/source-alignment.test.ts
git commit -m "feat: align narration with original film frames"
```

### Task 4: Expose original-source and alignment endpoints

**Files:**
- Modify: `packages/studio/src/api/server.ts`
- Test: `packages/studio/src/api/server.test.ts`

- [ ] **Step 1: Write failing endpoint tests**

Cover these requests:

```ts
POST /api/v1/crafts/:id/source/original-video
POST /api/v1/crafts/:id/source/timeline/build
GET  /api/v1/crafts/:id/source/timeline
POST /api/v1/crafts/:id/source/alignment
PUT  /api/v1/crafts/:id/source/matches/:matchId
GET  /api/v1/crafts/:id/source/segment/:matchId
```

Assert that an upload is registered as `sourceVideo`, timeline build returns `sourceFileKey: "sourceVideo"`, alignment receives only bounded candidates, and a segment request rejects suggested/rejected matches.

- [ ] **Step 2: Run endpoint tests and verify the route failures**

Run: `pnpm --filter @actalk/inkos-studio test -- server.test.ts`

Expected: FAIL because the routes do not exist.

- [ ] **Step 3: Implement persistence and route handlers**

Store `timeline.json`, `narration-anchors.json`, and `source-matches.json` under `crafts/<id>/source/timeline/`. The original upload endpoint accepts only video MIME types, enforces the existing upload size policy, copies the file into the craft source directory, and never replaces the commentary source. Timeline build uses the injected ffmpeg service. Alignment loads subtitle JSON and timeline scenes, sends a bounded candidate batch to the model, and persists `suggested` matches. The match update route only accepts ranges within the selected scene and transitions to `confirmed` or `rejected`. The segment route streams a short ffmpeg clip or returns a safe time-range response for browser preview; it must read only `sourceVideo`.

- [ ] **Step 4: Run endpoint tests and verify green**

Run: `pnpm --filter @actalk/inkos-studio test -- server.test.ts`

Expected: PASS for the new cases and existing server tests unchanged.

- [ ] **Step 5: Commit the API layer**

```bash
git add packages/studio/src/api/server.ts packages/studio/src/api/server.test.ts
git commit -m "feat: expose original film alignment endpoints"
```

### Task 5: Build the review UI and connect production references

**Files:**
- Create: `packages/studio/src/pages/SourceAlignmentPanel.tsx`
- Test: `packages/studio/src/pages/SourceAlignmentPanel.test.tsx`
- Modify: `packages/studio/src/pages/CraftManager.tsx`
- Modify: `packages/studio/src/api/story-production.ts`
- Modify: `packages/studio/src/api/routes/story-production.ts`
- Test: `packages/studio/src/api/story-production.test.ts`

- [ ] **Step 1: Write failing UI and production tests**

```ts
it("shows the original-film label and disables confirmation for a low-confidence suggestion", () => {
  const html = renderToStaticMarkup(createElement(SourceAlignmentPanel, fixtureProps));
  expect(html).toContain("原片素材");
  expect(html).toContain("仅供建议");
  expect(html).not.toContain("解说视频作为画面");
});

it("rejects a script source reference unless its match is confirmed", () => {
  expect(parseUnifiedScript("... sourceMatchId: suggested ...")).not.toHaveProperty("shots[0].sourceSegmentRef");
});
```

- [ ] **Step 2: Run focused UI/production tests and verify red**

Run: `pnpm --filter @actalk/inkos-studio test -- SourceAlignmentPanel.test.tsx story-production.test.ts`

Expected: FAIL because the panel, source reference field, and safe production handling do not exist.

- [ ] **Step 3: Implement the review panel**

Add an 原片对齐 tab only for Bilibili crafts. The panel has: original-video upload button; timeline build button; anchor list; candidate thumbnail; original-film `<video>` preview with `#t=start,end`; numeric start/end fields; confidence/status badge; confirm/reject/save buttons; and a message when the original video is missing. The panel refreshes persisted files after every save and never presents commentary video as the source preview.

- [ ] **Step 4: Add confirmed source references to script parsing and rendering**

Extend `UnifiedScriptShot` with an optional `sourceSegmentRef`. Parse only a confirmed match ID supplied by the server-side source-match document. In `composeSegmentVideo`, when a shot has a confirmed source reference, use the original `sourceVideo` segment as the video input and overlay the generated narration/subtitles; otherwise preserve the current generated-image path. Never silently fall back from a requested source segment to the commentary video.

- [ ] **Step 5: Run focused tests and verify green**

Run: `pnpm --filter @actalk/inkos-studio test -- SourceAlignmentPanel.test.tsx story-production.test.ts CraftManager.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the UI and production integration**

```bash
git add packages/studio/src/pages/SourceAlignmentPanel.tsx packages/studio/src/pages/SourceAlignmentPanel.test.tsx packages/studio/src/pages/CraftManager.tsx packages/studio/src/api/story-production.ts packages/studio/src/api/routes/story-production.ts packages/studio/src/api/story-production.test.ts
git commit -m "feat: review and render original film segments"
```

### Task 6: Verify the vertical slice and finish the worktree

**Files:**
- No new production files.

- [ ] **Step 1: Run focused regression suites**

Run:

```bash
pnpm --filter @actalk/inkos-core build
pnpm --filter @actalk/inkos-core test -- source-alignment.test.ts provider-vision.test.ts
pnpm --filter @actalk/inkos-studio typecheck
pnpm --filter @actalk/inkos-studio test -- source-timeline.test.ts source-alignment.test.ts server.test.ts SourceAlignmentPanel.test.tsx story-production.test.ts
```

Expected: all new and touched-path tests pass. Existing unrelated baseline failures must be reported separately, not hidden.

- [ ] **Step 2: Run the Studio browser smoke test**

Run `pnpm --dir packages/studio dev` after `pnpm worktree:check`, open the allocated local URL, navigate to a Bilibili craft, and verify the 原片对齐 tab, original-video upload state, candidate thumbnail, video time preview, and confirmation state. Save screenshots under `.screenshots/` only.

- [ ] **Step 3: Confirm the worktree contains only expected changes**

Run: `git status --short` and `git diff --check`.

Expected: only the files in this plan are changed; runtime data remains ignored.

- [ ] **Step 4: Commit any final test-only adjustments**

```bash
git add <only-files-shown-by-git-status>
git commit -m "test: verify original source alignment flow"
```

- [ ] **Step 5: Finish the worktree**

Run from the worktree:

```bash
node scripts/finish-worktree.mjs --base master
```

After the merge completes, restart Studio from the main checkout as required by `AGENTS.md`, wait five seconds, and verify `pnpm worktree:runtime` reports a listening port.
