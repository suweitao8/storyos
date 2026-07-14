# Bilibili Subtitle Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an AI post-processing pass that corrects likely Bilibili subtitle recognition errors before writing-craft analysis while retaining the raw subtitles.

**Architecture:** Keep subtitle acquisition unchanged. Add a focused Studio service that sends numbered timestamped entries to the existing `chatCompletion`, strictly parses a JSON correction response, and returns corrected entries plus a change count. The Bilibili import route will use corrected text for `analysis-input.txt` and the UI preview, while saving the original entries/text unchanged; any correction error falls back to the original text with an explicit status.

**Tech Stack:** TypeScript, Vitest, Hono, React, existing `@actalk/inkos-core` LLM provider with thinking disabled.

---

## Files and responsibilities

- Create `packages/studio/src/api/bilibili-subtitle-correction.ts`: prompt construction, JSON extraction/validation, correction orchestration, and fallback result type.
- Create `packages/studio/src/api/bilibili-subtitle-correction.test.ts`: unit tests for prompt input/output validation, changed-count calculation, and fallback behavior.
- Modify `packages/studio/src/api/server.ts:5410-5465`: run correction after Bilibili subtitle extraction, persist raw and corrected artifacts correctly, and return correction metadata.
- Modify `packages/studio/src/pages/CraftManager.tsx:113-140, 820-950`: type correction metadata and show the correction stage/result in the existing import progress area.
- Create `packages/studio/src/__tests__/craft-bilibili-import-endpoint.test.ts`: verify the import route wires corrected text into the analysis input while retaining raw subtitle files, using the existing Studio server test setup and mocked import/LLM boundaries if available.

## Task 1: Define and test the correction result contract

**Files:**
- Create: `packages/studio/src/api/bilibili-subtitle-correction.test.ts`
- Create: `packages/studio/src/api/bilibili-subtitle-correction.ts`

- [ ] **Step 1: Write the failing tests for valid correction output.**

Use two entries, including the recognition-error example:

```ts
const source = [
  { from: 0, to: 1.2, content: "他倒着烧香" },
  { from: 1.2, to: 2.4, content: "然后回到寺庙" },
];
const response = JSON.stringify([
  { index: 0, content: "他倒着烧香" },
  { index: 1, content: "然后回到寺庙" },
]);

it("applies only returned content while preserving timestamps and counts changes", () => {
  const result = applySubtitleCorrection(source, response);
  expect(result.entries).toEqual(source);
  expect(result.changedCount).toBe(0);
});

it("corrects a likely homophone without changing segment boundaries", () => {
  const result = applySubtitleCorrection(
    [{ from: 0, to: 1.2, content: "他盗着烧箱" }],
    JSON.stringify([{ index: 0, content: "他倒着烧香" }]),
  );
  expect(result.entries).toEqual([{ from: 0, to: 1.2, content: "他倒着烧香" }]);
  expect(result.changedCount).toBe(1);
});
```

- [ ] **Step 2: Run the focused test and verify it fails for the missing helper.**

Run: `pnpm --dir packages/studio test -- bilibili-subtitle-correction.test.ts`

Expected: FAIL because `bilibili-subtitle-correction.ts` does not export `applySubtitleCorrection` yet.

- [ ] **Step 3: Implement the minimal pure parser and validator.**

Export `applySubtitleCorrection(source, rawResponse)` and a `SubtitleCorrectionResult` type. Parse optional Markdown fences, require an array, require exactly one unique integer `index` for every source entry, require non-empty string `content`, ignore no entries, and rebuild entries by copying each source `from`/`to` while replacing only `content`. Count entries whose content differs after trimming.

- [ ] **Step 4: Run the focused test and verify it passes.**

Run: `pnpm --dir packages/studio test -- bilibili-subtitle-correction.test.ts`

Expected: PASS.

- [ ] **Step 5: Add malformed-response tests before expanding the service.**

Cover these exact cases:

```ts
it.each([
  ["not json", "not json"],
  ["missing entry", JSON.stringify([{ index: 0, content: "只返回一条" }])],
  ["duplicate index", JSON.stringify([{ index: 0, content: "A" }, { index: 0, content: "B" }])],
  ["unknown index", JSON.stringify([{ index: 0, content: "A" }, { index: 9, content: "B" }])],
  ["blank content", JSON.stringify([{ index: 0, content: "   " }])],
])("rejects %s correction output", (_name, raw) => {
  expect(() => applySubtitleCorrection(source, raw)).toThrow();
});
```

- [ ] **Step 6: Run the malformed-response tests and confirm they fail for any unimplemented validation.**

Run: `pnpm --dir packages/studio test -- bilibili-subtitle-correction.test.ts`

Expected: FAIL until all validation branches are implemented.

- [ ] **Step 7: Complete validation and rerun the focused suite.**

Run: `pnpm --dir packages/studio test -- bilibili-subtitle-correction.test.ts`

Expected: PASS with no unhandled test errors.

- [ ] **Step 8: Commit the correction contract.**

```bash
git add packages/studio/src/api/bilibili-subtitle-correction.ts packages/studio/src/api/bilibili-subtitle-correction.test.ts
git commit -m "test: define bilibili subtitle correction contract"
```

## Task 2: Add the no-thinking LLM correction service and fallback

**Files:**
- Modify: `packages/studio/src/api/bilibili-subtitle-correction.ts`
- Modify: `packages/studio/src/api/bilibili-subtitle-correction.test.ts`

- [ ] **Step 1: Write the failing orchestration tests.**

Inject a `chatCompletion` function so the test does not call a real provider:

```ts
it("sends timestamped entries with a correction-only prompt and returns corrected entries", async () => {
  const chat = vi.fn().mockResolvedValue({
    content: JSON.stringify([{ index: 0, content: "他倒着烧香" }]),
  });
  const result = await correctBilibiliSubtitles(source.slice(0, 1), {
    client: {} as never,
    model: "test-model",
    chatCompletion: chat,
  });
  expect(result.status).toBe("corrected");
  expect(result.entries[0]?.content).toBe("他倒着烧香");
  expect(chat).toHaveBeenCalledWith(
    {},
    "test-model",
    expect.arrayContaining([
      expect.objectContaining({ role: "system", content: expect.stringContaining("只输出 JSON") }),
      expect.objectContaining({ role: "user", content: expect.stringContaining("[0.0s-1.2s]") }),
    ]),
    expect.objectContaining({ temperature: 0, retry: false }),
  );
});

it("falls back to raw entries when the model fails", async () => {
  const result = await correctBilibiliSubtitles(source, {
    client: {} as never,
    model: "test-model",
    chatCompletion: vi.fn().mockRejectedValue(new Error("provider unavailable")),
  });
  expect(result.status).toBe("fallback");
  expect(result.entries).toEqual(source);
  expect(result.changedCount).toBe(0);
  expect(result.message).toContain("原始字幕");
});
```

The injected option should match the existing provider call shape but must not add a thinking-mode option; the provider already hard-disables thinking globally. The test should assert only the absence of a positive thinking configuration, not a nonexistent per-call field.

- [ ] **Step 2: Run the focused suite and confirm the orchestration tests fail.**

Run: `pnpm --dir packages/studio test -- bilibili-subtitle-correction.test.ts`

Expected: FAIL because `correctBilibiliSubtitles` is not implemented.

- [ ] **Step 3: Implement prompt construction and orchestration.**

Use a system message that says the model is correcting ASR/OCR errors only, must preserve order/boundaries, must keep uncertain text, must not explain its reasoning, and must output only an array of `{ "index": number, "content": string }`. Use `subtitleText`-equivalent timestamp formatting for the user payload. Call the injected/default `chatCompletion` with `temperature: 0`, a bounded output token budget based on entry count, and `retry: false`; never request thinking.

Return `{ status: "corrected", entries, changedCount }` on valid output. Catch provider, parsing, and validation errors and return `{ status: "fallback", entries: source, changedCount: 0, message: "字幕文字校正失败，已使用原始字幕" }`.

- [ ] **Step 4: Run the focused suite and verify all correction behavior passes.**

Run: `pnpm --dir packages/studio test -- bilibili-subtitle-correction.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the service.**

```bash
git add packages/studio/src/api/bilibili-subtitle-correction.ts packages/studio/src/api/bilibili-subtitle-correction.test.ts
git commit -m "feat: add ai bilibili subtitle correction"
```

## Task 3: Wire correction into the Bilibili import route and preserve raw files

**Files:**
- Create: `packages/studio/src/__tests__/craft-bilibili-import-endpoint.test.ts`
- Modify: `packages/studio/src/api/server.ts:5410-5465`

- [ ] **Step 1: Add an endpoint regression test for the data flow.**

Exercise `POST /api/v1/craft/bilibili/import` with mocked Bilibili import and LLM correction boundaries. Assert the response returns corrected `text`, corrected `subtitlePreview`, `correctionStatus: "corrected"`, and `correctionChangedCount`. Load the pending source asset from the response and assert `subtitles.json` and `subtitles.txt` contain the original text while `analysis-input.txt` contains corrected text.

- [ ] **Step 2: Run the endpoint test and verify it fails before route integration.**

Run: `pnpm --dir packages/studio test -- craft-bilibili-import-endpoint.test.ts`

Expected: FAIL because the current route returns raw text and has no correction metadata.

- [ ] **Step 3: Integrate correction after `importBilibiliSource`.**

Build a pipeline config once in the route, call `correctBilibiliSubtitles(result.subtitles, { client: pipelineConfig.client, model: pipelineConfig.model })`, and derive `correctedText` from the returned entries. Pass `correctedText` to `createCraftSourceUpload({ analysisText })`. Continue writing `result.subtitles` and `result.text` to the raw subtitle files. Return corrected preview/text and correction status/count/message.

When correction returns fallback, log only the stage and error summary through the existing logger; do not log subtitle content. Keep the existing temporary-directory cleanup and source-asset cleanup behavior unchanged.

- [ ] **Step 4: Run the endpoint test and verify it passes.**

Run: `pnpm --dir packages/studio test -- craft-bilibili-import-endpoint.test.ts`

Expected: PASS, including raw-file preservation and corrected analysis input.

- [ ] **Step 5: Run the related Studio API tests.**

Run: `pnpm --dir packages/studio test -- craft-source-assets.test.ts bilibili.test.ts craft-bilibili-import-endpoint.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit route integration.**

```bash
git add packages/studio/src/api/server.ts packages/studio/src/__tests__/craft-bilibili-import-endpoint.test.ts
git commit -m "feat: use corrected subtitles for craft analysis"
```

## Task 4: Surface correction progress and result in CraftManager

**Files:**
- Modify: `packages/studio/src/pages/CraftManager.tsx:113-140, 820-950`

- [ ] **Step 1: Extend the response type and add UI assertions where the current component test harness permits.**

Add `correctionStatus: "corrected" | "fallback"`, `correctionChangedCount`, and optional `correctionMessage` to `BilibiliImportResponse`.

- [ ] **Step 2: Update import progress messages.**

After the fetch succeeds but before `runExtraction`, append `正在校正字幕文字` to `progressLogs` and set it as `currentStep` while the API response already contains the correction result. Then append the final success or fallback message and set `currentStep` accordingly. Keep the existing busy-state disabling behavior.

- [ ] **Step 3: Show final correction status beside subtitle metadata.**

Render a small status line in the Bilibili result card: successful correction shows the changed count; fallback shows the returned fallback message in a warning color. Continue previewing `subtitlePreview`, which is now the corrected preview.

- [ ] **Step 4: Run Studio typecheck and client tests.**

Run: `pnpm --dir packages/studio typecheck`

Expected: PASS.

- [ ] **Step 5: Commit the UI status changes.**

```bash
git add packages/studio/src/pages/CraftManager.tsx
git commit -m "feat: show bilibili subtitle correction status"
```

## Task 5: Full verification and close-out

**Files:**
- Verify all changed files only; do not add generated runtime files.

- [ ] **Step 1: Run the complete Studio test suite.**

Run: `pnpm --dir packages/studio test`

Expected: PASS.

- [ ] **Step 2: Run typecheck and production builds.**

Run: `pnpm --dir packages/studio typecheck; pnpm --dir packages/studio build`

Expected: both commands exit 0.

- [ ] **Step 3: Inspect the final diff and working tree.**

Run: `git status --short; git diff --check; git diff master...HEAD --stat`

Expected: only the design/plan docs, correction service/tests, route changes, and UI changes are present; `git diff --check` is clean.

- [ ] **Step 4: Commit any final test-only adjustments.**

```bash
git add packages/studio/src docs/superpowers
git commit -m "test: verify bilibili subtitle correction flow"
```

- [ ] **Step 5: Finish the worktree according to repository policy.**

Run from the worktree after the final commit:

```bash
node scripts/finish-worktree.mjs --base master
```

Expected: the branch is merged back to `master`, pushed, the completed worktree is removed, and `git worktree prune` completes. Because Studio code changes, restart Studio from the main checkout according to `AGENTS.md` and verify the runtime port is listening.
