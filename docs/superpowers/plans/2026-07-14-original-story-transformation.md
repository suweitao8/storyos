# Short Story Originality Transformation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cache an explicit originality transformation plan per craft and make short-story generation consume only abstract craft mechanics plus that plan, preventing direct reuse of reference plots, events, and exemplar prose.

**Architecture:** Extend the existing Markdown `StorySeed` cache with an optional `originalizationPlan` section so old ten-section seeds remain valid. Strengthen seed generation to produce that section, add a short-fiction-only craft guide that filters out raw reference story material and exemplars, and route short-fiction outline/draft prompts through the filtered guide. Keep the existing full `buildCraftGuide` for long-form writing compatibility.

**Tech Stack:** TypeScript, Vitest, existing `StorySeed` parser/serializer, short-fiction pipeline, Hono Studio API.

---

### Task 1: Add the optional originality plan to cached story seeds

**Files:**
- Modify: `packages/core/src/models/story-seed.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/__tests__/story-seed.test.ts` (create if absent)

- [ ] **Step 1: Write failing tests** for parsing and serializing the new `原创化改编方案` section and for accepting the existing ten-section seed without it.

```ts
it("parses and serializes the optional originality transformation plan", () => {
  const seed = parseStorySeed(`${TEN_SECTION_SEED}\n\n## 原创化改编方案\n场景从校园迁移到写字楼，重新设计身份、关系和因果链。`);

  expect(seed.originalizationPlan).toContain("写字楼");
  expect(serializeStorySeed(seed)).toContain("## 原创化改编方案");
});

it("keeps legacy ten-section story seeds valid", () => {
  const seed = parseStorySeed(TEN_SECTION_SEED);
  expect(seed.originalizationPlan).toBeUndefined();
  expect(isStorySeed(seed)).toBe(true);
});
```

- [ ] **Step 2: Run the focused test and confirm it fails** because the parser has no optional section or field.

Run: `pnpm --dir packages/core exec vitest run src/__tests__/story-seed.test.ts`

Expected: FAIL with missing `originalizationPlan` behavior.

- [ ] **Step 3: Implement the minimal compatible schema.** Add the optional definition and `StorySeed.originalizationPlan?: string`; make `isStorySeed` validate only the original ten required fields; make `parseStorySeed` retain the optional section; make `serializeStorySeed` omit absent optional sections.

- [ ] **Step 4: Run the focused test and confirm it passes.**

Run: `pnpm --dir packages/core exec vitest run src/__tests__/story-seed.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the schema change.**

Run: `git add packages/core/src/models/story-seed.ts packages/core/src/index.ts packages/core/src/__tests__/story-seed.test.ts && git commit -m "feat: cache short story originality plans"`

### Task 2: Make story-seed generation produce an explicit transformation plan

**Files:**
- Modify: `packages/core/src/agents/craft-prompts.ts`
- Modify: `packages/studio/src/api/server.ts`
- Test: `packages/core/src/__tests__/story-direction-prompt.test.ts`
- Test: `packages/studio/src/__tests__/api/server.test.ts` or the existing server test file that covers cached story seeds

- [ ] **Step 1: Write failing prompt tests** requiring the new output heading and concrete replacement constraints, and a server serialization test proving a legacy cached seed does not render `undefined`.

```ts
it("requires an originality transformation plan in generated seeds", () => {
  const prompt = buildStorySeedPrompt(profile, "short", "zh");
  expect(prompt.user).toContain("原创化改编方案");
  expect(prompt.user).toContain("空间、身份、关系、因果链和结局");
  expect(prompt.system).toContain("不得复用连续事件顺序");
});
```

- [ ] **Step 2: Run the focused Core and Studio tests and confirm the new assertions fail.**

Run: `pnpm --dir packages/core exec vitest run src/__tests__/story-direction-prompt.test.ts`

Run: `pnpm --dir packages/studio exec vitest run src/api/server.test.ts -t "cached story seed"`

Expected: FAIL only on the new originality assertions/legacy serialization expectation.

- [ ] **Step 3: Update `buildStorySeedPrompt`.** Include the optional section in the exact heading list and instruct the model to write a concrete transformation matrix, new setting/identity/relationship/causal-chain choices, beat-function mapping, forbidden carry-over list, and a self-check. Preserve direct-output/no-thinking rules and old seed parsing compatibility.

- [ ] **Step 4: Update cached SSE output to use `serializeStorySeed`.** The cache path must include the optional plan when present and omit absent optional fields for legacy seeds; do not interpolate an optional property directly.

- [ ] **Step 5: Run both focused test files and confirm they pass.**

Expected: PASS.

- [ ] **Step 6: Commit the prompt/API change.**

Run: `git add packages/core/src/agents/craft-prompts.ts packages/core/src/__tests__/story-direction-prompt.test.ts packages/studio/src/api/server.ts packages/studio/src/__tests__/api/server.test.ts && git commit -m "feat: generate explicit story originality plans"`

### Task 3: Build a short-fiction-only filtered craft guide

**Files:**
- Modify: `packages/core/src/agents/craft-prompts.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/__tests__/short-fiction-craft.test.ts`

- [ ] **Step 1: Write failing tests** for a new `buildShortFictionCraftGuide` that includes abstract rhythm and the cached transformation plan but excludes raw worldview/story outline, concrete video events/reversals/payoffs, and exemplar text.

```ts
it("keeps short-fiction craft input abstract and originality-first", () => {
  const guide = buildShortFictionCraftGuide({
    ...profile,
    worldview: "REFERENCE_WORLDVIEW_EVENT",
    storyOutline: "REFERENCE_STORY_OUTLINE_EVENT",
    storySeed: { ...seed, originalizationPlan: "NEW_SPACE=OFFICE; REBUILD_CAUSAL_CHAIN" },
    videoStory: {
      ...videoStory,
      beats: [{ ...videoStory.beats[0], event: "REFERENCE_BEAT_EVENT", function: "create a question", emotionalEffect: "unease" }],
      reversals: [{ ...videoStory.reversals[0], reveal: "REFERENCE_REVEAL" }],
      payoffs: [{ ...videoStory.payoffs[0], release: "REFERENCE_PAYOFF" }],
    },
    exemplars: [{ label: "copy", tone: "tense", excerpt: "REFERENCE_EXEMPLAR_PROSE" }],
  });

  expect(guide).toContain("NEW_SPACE=OFFICE");
  expect(guide).toContain("create a question");
  expect(guide).not.toContain("REFERENCE_WORLDVIEW_EVENT");
  expect(guide).not.toContain("REFERENCE_STORY_OUTLINE_EVENT");
  expect(guide).not.toContain("REFERENCE_BEAT_EVENT");
  expect(guide).not.toContain("REFERENCE_REVEAL");
  expect(guide).not.toContain("REFERENCE_PAYOFF");
  expect(guide).not.toContain("REFERENCE_EXEMPLAR_PROSE");
});
```

- [ ] **Step 2: Run the focused test and confirm it fails** because the new function does not exist.

Run: `pnpm --dir packages/core exec vitest run src/__tests__/short-fiction-craft.test.ts`

Expected: FAIL with an unresolved import/function.

- [ ] **Step 3: Implement `buildShortFictionCraftGuide`.** Preserve only structure/rhythm/disclosure/perspective mechanics, video beat position/kind/function/emotional effect, ghost-story mechanism rules, originalization rules, and the cached `originalizationPlan`. Add explicit hard rules to rebuild setting, identity, relationships, causal chain, signature objects, scenes, and ending, and state that exemplar prose is not supplied to short fiction.

- [ ] **Step 4: Run the focused test and confirm it passes.**

Expected: PASS.

- [ ] **Step 5: Commit the filtered guide.**

Run: `git add packages/core/src/agents/craft-prompts.ts packages/core/src/index.ts packages/core/src/__tests__/short-fiction-craft.test.ts && git commit -m "feat: isolate short fiction from reference plot"`

### Task 4: Route short-fiction outline and draft generation through the filtered guide

**Files:**
- Modify: `packages/core/src/pipeline/short-fiction-runner.ts`
- Modify: `packages/studio/src/pages/story-creation-state.ts`
- Test: `packages/core/src/__tests__/short-fiction-craft.test.ts`
- Test: `packages/studio/src/pages/story-creation-state.test.ts`

- [ ] **Step 1: Write failing tests** asserting the short-fiction runner passes the filtered craft guide and no exemplar prompt to outline/writer inputs, and the creation action describes the craft as a transformation reference rather than “原创仿写” of world/outlines.

- [ ] **Step 2: Run the focused tests and confirm they fail** against the current `buildCraftGuide`/`buildCraftExemplars` wiring and action wording.

- [ ] **Step 3: Update `short-fiction-runner.ts`.** Replace short-fiction calls to `buildCraftGuide` with `buildShortFictionCraftGuide`; remove `buildCraftExemplars` from short-fiction outline/draft inputs. Keep the rest of the production stages and resume behavior unchanged.

- [ ] **Step 4: Update `buildDefaultStoryDirection` and `buildShortStoryCreationAction`.** Tell the model that the cached seed is a transformation baseline and require new space/identity/relationship/causal chain/ending; do not describe the operation as copying or direct use of extracted world/story outline.

- [ ] **Step 5: Run the focused Core and Studio tests and confirm they pass.**

Expected: PASS.

- [ ] **Step 6: Commit the short-fiction wiring.**

Run: `git add packages/core/src/pipeline/short-fiction-runner.ts packages/core/src/__tests__/short-fiction-craft.test.ts packages/studio/src/pages/story-creation-state.ts packages/studio/src/pages/story-creation-state.test.ts && git commit -m "fix: apply originality transformation to short fiction"`

### Task 5: Full verification and worktree handoff

**Files:**
- No new production files; inspect all changed files and tests.

- [ ] **Step 1: Run the repository worktree check.**

Run: `pnpm worktree:check`

- [ ] **Step 2: Run targeted Core and Studio tests, Core build, and Studio typecheck.**

Run: `pnpm --dir packages/core exec vitest run src/__tests__/story-seed.test.ts src/__tests__/story-direction-prompt.test.ts src/__tests__/short-fiction-craft.test.ts`

Run: `pnpm --dir packages/studio exec vitest run src/api/server.test.ts src/pages/story-creation-state.test.ts`

Run: `pnpm --dir packages/core build`

Run: `pnpm --dir packages/studio typecheck`

- [ ] **Step 3: Inspect the final diff and repository status.**

Run: `git diff --check; git status --short --branch`

Expected: only the design/plan docs, production changes, and focused tests are present; no generated runtime files are included.

- [ ] **Step 4: Run the existing full Core/Studio tests if the targeted suite is green.** Record any pre-existing failures separately rather than hiding them.

- [ ] **Step 5: Run `node scripts/finish-worktree.mjs --base master`, verify the master worktree and push state, then restart Studio because Core and Studio changed.**
