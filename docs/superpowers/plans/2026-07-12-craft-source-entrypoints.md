# 新建模式来源入口 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将新建模式拆成 B 站视频链接和小说文本文件两个来源入口，并在导入成功后自动提取、保存写作模式。

**Architecture:** 复用现有三个 Studio API，不新增后端接口。`CraftCreate` 增加来源类型状态和两个独立面板；两个导入回调都把规范化后的文本、名称和模式交给同一个分析函数，成功后沿用现有 `onSuccess` 导航。

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Hono API。

---

### Task 1: 定义来源类型和统一分析请求

**Files:**
- Modify: `packages/studio/src/pages/CraftManager.tsx`
- Test: `packages/studio/src/pages/craft-profile-view.test.ts`

- [ ] **Step 1: Write the failing test**

增加 `CraftSourceType` 相关纯函数测试，验证 B 站和小说来源都生成同一结构的分析请求：

```ts
expect(buildCraftAnalyzePayload({
  type: "bilibili",
  text: "字幕内容",
  detectedName: "鬼故事视频",
}, "ghost-story")).toEqual({
  text: "字幕内容",
  sourceName: "鬼故事视频",
  language: "zh",
  mode: "ghost-story",
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `packages/studio/node_modules/.bin/vitest.CMD run packages/studio/src/pages/craft-profile-view.test.ts`

Expected: FAIL because `buildCraftAnalyzePayload` is not defined.

- [ ] **Step 3: Write minimal implementation**

在 `CraftManager.tsx` 导出：

```ts
export type CraftSourceType = "bilibili" | "novel";

export function buildCraftAnalyzePayload(
  source: { type: CraftSourceType; text: string; detectedName: string },
  mode: "general" | "ghost-story",
) {
  return {
    text: source.text,
    sourceName: normalizeCraftDisplayName(source.detectedName),
    language: "zh" as const,
    mode,
  };
}
```

让两个导入成功回调都调用该函数后再执行 `/craft/analyze`。

- [ ] **Step 4: Run test to verify it passes**

Run: `packages/studio/node_modules/.bin/vitest.CMD run packages/studio/src/pages/craft-profile-view.test.ts`

Expected: PASS。

### Task 2: 将新建模式界面拆为两个来源卡片

**Files:**
- Modify: `packages/studio/src/pages/CraftManager.tsx`
- Test: `packages/studio/src/pages/craft-profile-view.test.ts`

- [ ] **Step 1: Write the failing test**

增加来源定义测试，确保顺序和标签稳定：

```ts
expect(CRAFT_SOURCE_TYPES).toEqual([
  { value: "bilibili", label: "B 站视频链接" },
  { value: "novel", label: "小说文本文件" },
]);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `packages/studio/node_modules/.bin/vitest.CMD run packages/studio/src/pages/craft-profile-view.test.ts`

Expected: FAIL because `CRAFT_SOURCE_TYPES` is not defined。

- [ ] **Step 3: Write minimal implementation**

增加来源卡片状态：

```ts
const [sourceType, setSourceType] = useState<CraftSourceType>("novel");
```

渲染两个 `button` 卡片，使用 `aria-pressed` 表示选择状态；`sourceType === "bilibili"` 时只渲染 URL 输入和字幕预览，`sourceType === "novel"` 时只渲染文件选择区。切换来源时清理另一来源的结果、错误、当前步骤和进度日志。

- [ ] **Step 4: Run test to verify it passes**

Run: `packages/studio/node_modules/.bin/vitest.CMD run packages/studio/src/pages/craft-profile-view.test.ts`

Expected: PASS。

### Task 3: 让两种导入成功后自动分析并保存

**Files:**
- Modify: `packages/studio/src/pages/CraftManager.tsx`
- Test: `packages/studio/src/pages/craft-profile-view.test.ts`

- [ ] **Step 1: Write the failing test**

覆盖统一请求函数的名称清洗和模式传递，确保文件名 `示例小说-100.txt` 或 B 站标题中的章节标记不会进入保存名称。

- [ ] **Step 2: Run test to verify it fails**

Run: `packages/studio/node_modules/.bin/vitest.CMD run packages/studio/src/pages/craft-profile-view.test.ts`

Expected: FAIL until the new shared path uses `normalizeCraftDisplayName`。

- [ ] **Step 3: Write minimal implementation**

抽出 `runExtraction(source)`：设置 `activeSourceNameRef`、清理错误和日志、调用 `/craft/analyze`，成功执行 `onSuccess`，失败恢复 `extracting` 并保留错误。`handleFile` 和 `handleBilibiliImport` 在设置导入结果后直接调用它；删除依赖导入结果的手动提取按钮和对应的重复状态分支。

- [ ] **Step 4: Run test to verify it passes**

Run: `packages/studio/node_modules/.bin/vitest.CMD run packages/studio/src/pages/craft-profile-view.test.ts packages/studio/src/api/bilibili.test.ts`

Expected: PASS。

### Task 4: 完整验证和收尾

**Files:**
- Modify: `packages/studio/src/pages/CraftManager.tsx`
- Test: `packages/studio/src/pages/craft-profile-view.test.ts`

- [ ] **Step 1: Run focused Studio tests**

Run: `Push-Location packages/studio; & '.\\node_modules\\.bin\\vitest.CMD' run src/pages/craft-profile-view.test.ts src/api/bilibili.test.ts; Pop-Location`

Expected: all focused tests pass。

- [ ] **Step 2: Run typecheck and production build**

Run: `packages/studio/node_modules/.bin/tsc.CMD --noEmit -p packages/studio/tsconfig.json` and `Push-Location packages/studio; & '.\\node_modules\\.bin\\vite.CMD' build; Pop-Location`

Expected: both exit 0。

- [ ] **Step 3: Inspect the diff**

Run: `git diff --check; git status --short`

Expected: only the source-entrypoint implementation and its tests/docs are changed。

- [ ] **Step 4: Commit**

```bash
git add packages/studio/src/pages/CraftManager.tsx packages/studio/src/pages/craft-profile-view.test.ts docs/superpowers/specs/2026-07-12-craft-source-entrypoints-design.md docs/superpowers/plans/2026-07-12-craft-source-entrypoints.md
git commit -m "feat(studio): split craft creation sources"
```
