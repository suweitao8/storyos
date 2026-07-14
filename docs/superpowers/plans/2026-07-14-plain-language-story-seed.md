# 通俗易懂的故事设定输出实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让故事设定面向 B 站普通观众输出，用日常中文和短句表达，同时保留原创化、悬疑推进和反转结构。

**Architecture:** 在 Core 的故事种子生成提示词中集中加入面向普通观众的语言约束，使生成源头统一简化；不修改内部 craft 分析字段，避免丢失创作结构。Studio 只补充可见说明，明确该设定会以易读方式呈现。

**Tech Stack:** TypeScript、Vitest、React、pnpm workspace。

---

### Task 1: 锁定通俗化生成契约

**Files:**
- Modify: `packages/core/src/__tests__/story-direction-prompt.test.ts`

- [ ] **Step 1: Write the failing test**

在故事种子提示词测试中断言中文提示词包含普通观众、日常用语、短句、避免论文式分析和术语改写示例，并断言故事方向提示词也携带同一语言契约。

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @actalk/inkos-core test -- story-direction-prompt.test.ts`

Expected: FAIL because the current prompts do not contain the new plain-language constraints.

### Task 2: 实现故事设定通俗化提示词

**Files:**
- Modify: `packages/core/src/agents/craft-prompts.ts:385-550`

- [ ] **Step 1: Add the shared Chinese language contract**

在 `buildStoryDirectionPrompt` 和无参考素材的种子提示词中加入：面向 B 站普通观众、使用日常中文、优先动作选择结果、必要术语首次解释、不写论文式分析、每节使用有限短句，并使用“冲突升级机制”“信息释放节奏”的通俗改写示例。

- [ ] **Step 2: Apply the contract to the complete seed**

在 `buildStorySeedPrompt` 的系统和用户指令中明确：十一个板块都必须易懂，保留悬疑与反转但不堆叠专业概念；大纲按“发生什么—主角怎么应对—带来什么新麻烦”展开；原创化改编方案也遵守同样的表达约束。

- [ ] **Step 3: Run the focused test**

Run: `pnpm --filter @actalk/inkos-core test -- story-direction-prompt.test.ts`

Expected: PASS.

### Task 3: 更新 Studio 可见说明

**Files:**
- Modify: `packages/studio/src/pages/CraftManager.tsx:1488-1508`

- [ ] **Step 1: Clarify the story-setting description**

将“默认故事设定”说明补充为：系统会保留悬疑、反转和创作重点，但会用普通观众容易理解的表达，减少专业术语和过长说明。

- [ ] **Step 2: Run typecheck and tests**

Run: `pnpm --filter @actalk/inkos-core build` followed by `pnpm --filter @actalk/studio typecheck`.

Expected: both commands exit with code 0.

### Task 4: 提交并收尾

**Files:**
- Commit only the plan, test, Core prompt, and Studio copy changes.

- [ ] **Step 1: Confirm the worktree contains only expected changes**

Run: `git status --short`.

Expected: only the four planned files are modified.

- [ ] **Step 2: Commit**

Run: `git add docs/superpowers/plans/2026-07-14-plain-language-story-seed.md packages/core/src/__tests__/story-direction-prompt.test.ts packages/core/src/agents/craft-prompts.ts packages/studio/src/pages/CraftManager.tsx; git commit -m "feat: simplify story setting language"`.

- [ ] **Step 3: Finish the worktree**

Run from the worktree: `node scripts/finish-worktree.mjs --base master`.

- [ ] **Step 4: Restart Studio and verify HTTP endpoints**

From the main checkout, run `pnpm install`, then `pnpm --dir packages/studio dev`; after startup verify the client and API return HTTP 200 and confirm the Studio process is listening on the runtime port.
