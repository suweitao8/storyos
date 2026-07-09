# Craft Profile Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand craft extraction from a coarse four-part summary into a practical, module-based writing-breakdown profile that is easier to inspect and use for generation.

**Architecture:** Keep the existing `CraftProfile` as a compatibility layer, but add richer breakdown modules underneath it so the analyzer can capture opening hooks, chapter flow, scene transitions, pacing, disclosure, suspense, POV, and emotional/turning-point mechanics. The analyzer will keep the current JSON repair and exemplar validation logic, while the studio page will move from four summary cards to a clearer overview plus module cards and evidence excerpts.

**Tech Stack:** TypeScript, React, Vitest, existing LLM provider/prompt pipeline, existing SSE progress updates.

---

### Task 1: Extend the craft profile schema without breaking callers

**Files:**
- Modify: `D:/Github/storyos/packages/core/src/models/craft-profile.ts`
- Modify: `D:/Github/storyos/packages/studio/src/pages/CraftManager.tsx`
- Modify: `D:/Github/storyos/packages/core/src/agents/craft-prompts.ts`

- [ ] **Step 1: Write the failing test**

Add a Vitest assertion that the craft prompt mentions the new module families and that the studio detail view can read a richer profile shape while still rendering the legacy four sections.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C packages/core exec vitest run src/__tests__/craft-analyzer.test.ts`

Expected: fail because the new module fields are not yet defined or surfaced.

- [ ] **Step 3: Write minimal implementation**

```ts
export interface CraftBreakdownModule {
  readonly label: string;
  readonly summary: string;
  readonly evidence?: string;
}

export interface CraftProfile {
  readonly sourceName: string;
  readonly analyzedAt: string;
  readonly language: "zh" | "en";
  readonly structure: CraftStructure;
  readonly sceneRhythm: CraftSceneRhythm;
  readonly informationDisclosure: CraftInformationDisclosure;
  readonly narrativePerspective: CraftNarrativePerspective;
  readonly modules?: ReadonlyArray<CraftBreakdownModule>;
  readonly exemplars: ReadonlyArray<CraftExemplar>;
}
```

Keep the legacy fields intact and treat `modules` as additive.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -C packages/core exec vitest run src/__tests__/craft-analyzer.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/models/craft-profile.ts packages/studio/src/pages/CraftManager.tsx packages/core/src/agents/craft-prompts.ts
git commit -m "feat: expand craft profile schema"
```

### Task 2: Teach the analyzer to extract richer breakdown modules

**Files:**
- Modify: `D:/Github/storyos/packages/core/src/agents/craft-analyzer.ts`
- Modify: `D:/Github/storyos/packages/core/src/agents/craft-prompts.ts`
- Modify: `D:/Github/storyos/packages/core/src/__tests__/craft-analyzer.test.ts`

- [ ] **Step 1: Write the failing test**

Add a test that feeds a crafted JSON response containing a `modules` array with opening, pacing, suspense, and turning-point summaries, then asserts that `analyze()` preserves them and still backfills exemplars.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C packages/core exec vitest run src/__tests__/craft-analyzer.test.ts -t "modules"`

Expected: fail because the analyzer currently ignores the additive module field.

- [ ] **Step 3: Write minimal implementation**

```ts
type CraftModule = {
  readonly label: string;
  readonly summary: string;
  readonly evidence?: string;
};

function parseModules(raw: unknown): ReadonlyArray<CraftModule> {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      label: String(item.label ?? "").trim(),
      summary: String(item.summary ?? item.description ?? "").trim(),
      evidence: String(item.evidence ?? item.excerpt ?? "").trim() || undefined,
    }))
    .filter((item) => item.label && item.summary);
}
```

Thread `modules` through `parseProfile()`, preserve it through refinement, and keep the existing repair logic unchanged for the old fields.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -C packages/core exec vitest run src/__tests__/craft-analyzer.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/agents/craft-analyzer.ts packages/core/src/agents/craft-prompts.ts packages/core/src/__tests__/craft-analyzer.test.ts
git commit -m "feat: extract richer craft breakdowns"
```

### Task 3: Redesign the studio craft detail view to surface the new modules

**Files:**
- Modify: `D:/Github/storyos/packages/studio/src/pages/CraftManager.tsx`
- Modify: `D:/Github/storyos/packages/studio/src/hooks/use-i18n.ts`
- Add: `D:/Github/storyos/packages/studio/src/pages/craft-profile-view.test.ts` (or extend the existing page tests if a dedicated file is not needed)

- [ ] **Step 1: Write the failing test**

Add a UI test that renders a profile containing `modules` and verifies the page shows a summary heading, module cards, and evidence text while still rendering the legacy sections.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C packages/studio exec vitest run`

Expected: fail because the page still renders only the four original sections.

- [ ] **Step 3: Write minimal implementation**

Render a compact overview block first, then a grid/list of module cards, then the existing four sections below as a compatibility area. Add i18n keys for the new labels only where the page needs them.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -C packages/studio exec vitest run`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/studio/src/pages/CraftManager.tsx packages/studio/src/hooks/use-i18n.ts packages/studio/src/pages/craft-profile-view.test.ts
git commit -m "feat: present richer craft analysis in studio"
```

### Task 4: Verify the end-to-end craft extraction on the sample novel

**Files:**
- None, verification only

- [ ] **Step 1: Run the craft upload/analyze path against the sample novel**

Run the same local end-to-end script against `D:/Github/animcg/backups/我的治愈系游戏_100.txt` and confirm the returned profile includes the new module breakdown and still has valid exemplars.

- [ ] **Step 2: Inspect the saved profile output**

Confirm the module summaries are specific, non-placeholder, and consistent with the reference text.

- [ ] **Step 3: Commit any last-minute fixes**

```bash
git add -A
git commit -m "test: verify craft expansion end to end"
```

