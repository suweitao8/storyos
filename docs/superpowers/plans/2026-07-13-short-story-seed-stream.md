# Short Story Seed Streaming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the short-story creation spinner with a structured, editable story-seed candidate that streams visible final content while it is generated, then passes the accepted seed into the existing short-fiction pipeline.

**Architecture:** Keep long-story creation unchanged. Add a core `StorySeed` model, Markdown parser, serializer, and prompt builder; expose a POST SSE endpoint that forwards only final text deltas from `chatCompletion`; adapt the Studio creation state to parse the stream and render a two-column short-story candidate editor with a live generation panel. The accepted seed serializes back into the existing `shortRun.direction` contract, so downstream production and asset extraction remain compatible.

**Tech Stack:** TypeScript, Vitest, Hono `streamSSE`, React 19, Tailwind utility classes, existing `chatCompletion` streaming callbacks.

---

### Task 1: Add the structured story-seed contract and parser

**Files:**
- Create: `packages/core/src/models/story-seed.ts`
- Test: `packages/core/src/__tests__/story-seed.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing parser and serializer tests**

Add tests for a complete Simplified Chinese Markdown seed containing the ten required headings. Assert that `parseStorySeed` returns the expected fields, rejects a missing required heading, strips an optional Markdown code fence, and that `serializeStorySeed` includes every field in stable order.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm --filter @actalk/inkos-core exec vitest run src/__tests__/story-seed.test.ts`

Expected: FAIL because `story-seed.ts` and its exported functions do not exist.

- [ ] **Step 3: Implement the minimal model, parser, and serializer**

Define `StorySeed` with string fields for title, genreTone, hook, worldview, characters, conflict, outline, reversals, ending, and visualAudioMotifs. Parse headings using exact `##` labels, trim fenced output, reject empty required sections with a named error, and serialize with the same labels plus the short-story originality constraint.

- [ ] **Step 4: Export the contract and rerun the focused tests**

Run: `pnpm --filter @actalk/inkos-core exec vitest run src/__tests__/story-seed.test.ts`

Expected: PASS with all parser and serializer assertions passing.

- [ ] **Step 5: Commit the contract**

```bash
git add packages/core/src/models/story-seed.ts packages/core/src/__tests__/story-seed.test.ts packages/core/src/index.ts
git commit -m "feat: add structured short story seed"
```

### Task 2: Build the expanded prompt and enforce direct output

**Files:**
- Modify: `packages/core/src/agents/craft-prompts.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/__tests__/story-direction-prompt.test.ts`
- Test: `packages/core/src/__tests__/provider-minimax-thinking.test.ts`

- [ ] **Step 1: Add failing prompt assertions**

Extend the existing story-direction prompt tests with `buildStorySeedPrompt` assertions for all ten headings, the craft `worldview` and `storyOutline`, originalization rules, and an instruction to output only the final Markdown sections without analysis or thinking text.

- [ ] **Step 2: Run the focused prompt tests and verify the new assertions fail**

Run: `pnpm --filter @actalk/inkos-core exec vitest run src/__tests__/story-direction-prompt.test.ts`

Expected: FAIL because the expanded prompt builder is not present.

- [ ] **Step 3: Implement `buildStorySeedPrompt`**

Reuse the existing craft reference compaction, add the ten exact section labels in generation order, tell the model to fill every section with concrete short-film material, and explicitly say not to emit `<think>`, reasoning, Markdown fences, or commentary. Add a no-craft prompt path using the same output contract and generic short-film rules.

- [ ] **Step 4: Add a provider regression for direct output**

Update the MiniMax request expectation so the provider sends an explicit disabled-thinking control for supported models and never forwards reasoning content to returned text or `onTextDelta`. Preserve compatibility behavior for models that do not accept a thinking control by filtering their reasoning channel instead of displaying it.

- [ ] **Step 5: Run core prompt and provider tests**

Run: `pnpm --filter @actalk/inkos-core exec vitest run src/__tests__/story-direction-prompt.test.ts src/__tests__/provider-minimax-thinking.test.ts`

Expected: PASS with zero failures.

- [ ] **Step 6: Commit prompt and provider changes**

```bash
git add packages/core/src/agents/craft-prompts.ts packages/core/src/index.ts packages/core/src/__tests__/story-direction-prompt.test.ts packages/core/src/__tests__/provider-minimax-thinking.test.ts
git commit -m "feat: generate complete short story seeds directly"
```

### Task 3: Add the streaming story-seed API

**Files:**
- Modify: `packages/studio/src/api/server.ts`
- Test: `packages/studio/src/api/server.test.ts`

- [ ] **Step 1: Write failing route tests**

Add tests for `POST /api/v1/crafts/:id/story-direction/stream`: a mock model emits two text deltas and the response emits `start`, two `delta` events, and `complete` with the parsed seed. Add a failure case that emits `error` and preserves no complete event when parsing fails. Add the no-craft `POST /api/v1/story-direction/stream` route test.

- [ ] **Step 2: Run the route tests and verify the new assertions fail**

Run: `pnpm --filter @actalk/inkos-studio exec vitest run src/api/server.test.ts -t "story seed stream"`

Expected: FAIL because neither streaming route exists.

- [ ] **Step 3: Implement one shared streaming handler**

Create a local helper in `server.ts` that loads an optional craft, builds the seed prompt, calls `chatCompletion` with `onTextDelta` and `retry: false`, and writes Hono SSE events. Send only `onTextDelta` output as `delta`; parse and validate the final accumulated Markdown before sending `complete`; catch model, parse, and disconnect errors as `error` events. Use the existing project LLM config and agent context, and keep the old non-streaming endpoint unchanged for compatibility.

- [ ] **Step 4: Run the route tests and server typecheck**

Run: `pnpm --filter @actalk/inkos-studio exec vitest run src/api/server.test.ts -t "story seed stream"`

Expected: PASS.

Run: `pnpm --filter @actalk/inkos-studio typecheck`

Expected: PASS with no TypeScript errors.

- [ ] **Step 5: Commit the streaming API**

```bash
git add packages/studio/src/api/server.ts packages/studio/src/api/server.test.ts
git commit -m "feat: stream short story seed generation"
```

### Task 4: Add Studio stream parsing and creation action data

**Files:**
- Modify: `packages/studio/src/pages/story-creation-state.ts`
- Test: `packages/studio/src/pages/story-creation-state.test.ts`
- Modify: `packages/studio/src/pages/ChatPage.tsx`
- Test: `packages/studio/src/pages/chat-page-story-workspace.integration.test.ts`

- [ ] **Step 1: Write failing state tests**

Test SSE line parsing across chunk boundaries, mapping `complete` payloads into a `StorySeed`, serializing an edited seed into the `shortRun.direction`, and keeping `canCreate` false until a complete seed exists.

- [ ] **Step 2: Run the focused Studio tests and verify they fail**

Run: `pnpm --filter @actalk/inkos-studio exec vitest run src/pages/story-creation-state.test.ts src/pages/chat-page-story-workspace.integration.test.ts`

Expected: FAIL because the new seed helpers and stream callback do not exist.

- [ ] **Step 3: Implement stream helpers and callback wiring**

Add `StorySeed`, `StorySeedStreamEvent`, `parseStorySeedStream`, and `buildShortStoryCreationAction` support for `seed`. In `ChatPage`, replace the one-shot direction callback for short stories with a fetch-based POST stream reader that reports start/delta/complete/error callbacks, aborts stale requests, and sends the accepted serialized seed to the existing `shortRun` action.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `pnpm --filter @actalk/inkos-studio exec vitest run src/pages/story-creation-state.test.ts src/pages/chat-page-story-workspace.integration.test.ts`

Expected: PASS.

Run: `pnpm --filter @actalk/inkos-studio typecheck`

Expected: PASS.

- [ ] **Step 5: Commit the Studio state integration**

```bash
git add packages/studio/src/pages/story-creation-state.ts packages/studio/src/pages/story-creation-state.test.ts packages/studio/src/pages/ChatPage.tsx packages/studio/src/pages/chat-page-story-workspace.integration.test.ts
git commit -m "feat: connect short story seed streaming to creation"
```

### Task 5: Replace the short-story creation UI with the two-column candidate editor

**Files:**
- Modify: `packages/studio/src/pages/StoryCreationPanel.tsx`
- Create: `packages/studio/src/pages/StorySeedPreview.tsx`
- Test: `packages/studio/src/pages/StoryCreationPanel.test.tsx`

- [ ] **Step 1: Write failing component tests**

Render the short-story panel with a seed stream harness and assert that the right panel displays live deltas and completed fields, the accept button is disabled while generating or when no complete seed exists, retry/regenerate is available after failure, and the ten seed fields become editable after completion. Assert that long-story rendering still shows the existing form.

- [ ] **Step 2: Run the component tests and verify they fail**

Run: `pnpm --filter @actalk/inkos-studio exec vitest run src/pages/StoryCreationPanel.test.tsx`

Expected: FAIL because the preview component and short-story stream props do not exist.

- [ ] **Step 3: Implement the preview component and panel state**

Create focused `StorySeedPreview` field cards and a live-generation panel. In `StoryCreationPanel`, keep long-story state untouched; for short stories, manage candidate, live text, stage index, status, error, request sequence, and editable field updates. Use responsive grid classes for desktop two-column and mobile stacked layout. Disable all generation/accept actions while the request is active and keep partial text visible on errors.

- [ ] **Step 4: Run component tests and build the Studio client**

Run: `pnpm --filter @actalk/inkos-studio exec vitest run src/pages/StoryCreationPanel.test.tsx`

Expected: PASS.

Run: `pnpm --filter @actalk/inkos-studio build:client`

Expected: PASS with a generated Vite client bundle.

- [ ] **Step 5: Commit the UI**

```bash
git add packages/studio/src/pages/StoryCreationPanel.tsx packages/studio/src/pages/StorySeedPreview.tsx packages/studio/src/pages/StoryCreationPanel.test.tsx
git commit -m "feat: add live short story seed preview"
```

### Task 6: Full verification and branch handoff

**Files:**
- Modify only files already listed above if verification finds a defect.

- [ ] **Step 1: Run the complete core and Studio test suites**

Run: `pnpm --filter @actalk/inkos-core test && pnpm --filter @actalk/inkos-studio test`

Expected: both commands exit 0 with zero failed tests.

- [ ] **Step 2: Run repository typechecks and build**

Run: `pnpm --filter @actalk/inkos-core typecheck && pnpm --filter @actalk/inkos-studio typecheck && pnpm --filter @actalk/inkos-studio build`

Expected: all commands exit 0.

- [ ] **Step 3: Check the final diff and worktree**

Run: `git diff --check; git status --short`

Expected: no whitespace errors and only the intended source, test, and documentation files are present.

- [ ] **Step 4: Commit any final verification fixes**

```bash
git add packages/core/src packages/studio/src
git commit -m "fix: complete short story seed verification"
```

- [ ] **Step 5: Finish the worktree according to `AGENTS.md`**

Run from the worktree: `node scripts/finish-worktree.mjs --base master`.

Expected: changes merge back to `master`, push, worktree cleanup, and prune complete; because Studio code changed, restart Studio from the main checkout and verify its runtime port before handing off.
