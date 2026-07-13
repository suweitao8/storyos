# Studio 工作区布局扩展 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 解除 Studio 宽屏页面中不必要的窄容器约束，让创建故事和主要创作界面使用更合理的工作区宽度。

**Architecture:** 保留现有 React/Tailwind 组件结构，在 App 层统一页面容器，在 StoryCreationPanel 层建立主表单/辅助区网格，在 ChatPage 层只限制消息阅读宽度而不限制整个工作区。所有变化只涉及布局 class 和布局测试，不触碰业务状态或 API。

**Tech Stack:** React, TypeScript, Tailwind utility classes, Vitest, Vite。

---

### Task 1: 建立页面容器分级

**Files:**
- Modify: `packages/studio/src/App.tsx`
- Test: `packages/studio/src/App.test.ts`

- [ ] **Step 1: 增加页面容器分类测试**

为页面容器映射增加纯函数测试，确保写作/聊天页不进入普通窄容器，工具页使用宽容器。

- [ ] **Step 2: 替换 App 中重复的 `max-w-4xl mx-auto` 包裹类**

将普通工具页包裹类统一为 `w-full max-w-[1440px] mx-auto px-6 py-10 md:px-10 xl:px-12`，将写作模式/题材页提升到 `max-w-[1600px]`，聊天与故事工作区继续使用 `absolute inset-0 flex min-w-0`。

- [ ] **Step 3: 运行 App 相关测试**

运行 `pnpm exec vitest run src/App.test.ts`，确认路由标题和页面选择行为不变。

### Task 2: 扩展创建故事工作区

**Files:**
- Modify: `packages/studio/src/pages/StoryCreationPanel.tsx`
- Test: `packages/studio/src/pages/chat-page-story-workspace.integration.test.ts`（仅在需要时补充布局行为断言）

- [ ] **Step 1: 将创建面板外层改为宽工作区**

把当前 `mx-auto ... max-w-3xl` 改为 `w-full max-w-[1440px] ... px-4 md:px-8 xl:px-10`，保证页面在宽屏下有稳定边距。

- [ ] **Step 2: 将表单和辅助信息拆成响应式双栏**

使用 `grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]`，左侧保留现有表单，右侧承载提示/摘要；`lg` 以下保持单列。

- [ ] **Step 3: 运行创建故事相关测试**

运行 `pnpm exec vitest run src/pages/chat-page-story-workspace.integration.test.ts src/pages/story-creation-state.test.ts`，确认创建动作和状态流没有变化。

### Task 3: 扩展聊天工作区而不放大阅读行长

**Files:**
- Modify: `packages/studio/src/pages/ChatPage.tsx`

- [ ] **Step 1: 扩展历史消息列**

将消息列表外层从 `max-w-3xl mx-auto` 改为 `w-full max-w-[1100px] mx-auto`，保留消息卡片自身的自然换行。

- [ ] **Step 2: 扩展快捷操作和输入框**

将快捷操作、播放选择和底部输入框的 `max-w-3xl` 改为与工作区一致的 `w-full max-w-[1100px] mx-auto`，避免输入区比历史区域更窄。

- [ ] **Step 3: 检查移动端溢出**

在 375px 和 768px 宽度下确认输入区、快捷操作、消息内容仍能收缩，长文本只在纵向滚动区内增长。

### Task 4: 浏览器验证与收尾

**Files:**
- Modify: `docs/superpowers/specs/2026-07-13-layout-expansion-design.md`
- Modify: `docs/superpowers/plans/2026-07-13-layout-expansion.md`

- [ ] **Step 1: 执行类型检查和客户端构建**

运行 `pnpm --filter @actalk/inkos-studio typecheck` 和 `pnpm --filter @actalk/inkos-studio build:client`。

- [ ] **Step 2: 使用浏览器验证主要页面**

检查创建故事、聊天、写作模式和普通工具页的 1440px/768px/375px 布局，确认没有横向溢出、内容没有被异常裁切。

- [ ] **Step 3: 检查差异、提交并按仓库流程收尾**

运行 `git diff --check` 和 `git status --short`，只提交本次布局文件及设计文档；完成后重启 Studio。
