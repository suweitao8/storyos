# 写作模式源文件保留与详情重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 保留写作模式的小说/视频/字幕源资产，支持基于源资产重新解析，并把详情页改造成可分区查看的工作台。

**Architecture:** 导入接口将源内容落到临时资产目录，分析成功后归档到 `crafts/<id>/source/`；重新解析读取归档的分析输入并复用现有 `PipelineRunner.analyzeCraft`。详情接口提供 profile、源资产状态和下载入口，React 详情页用分区导航按需展示内容。

**Tech Stack:** TypeScript, Hono, React, Vitest, Node fs/promises, ffmpeg/B 站 DASH media API。

---

### Task 1: 定义并测试源资产存储边界

**Files:**
- Create: `packages/studio/src/api/craft-source-assets.ts`
- Create: `packages/studio/src/api/craft-source-assets.test.ts`

- [ ] 写临时资产创建、元数据写入、归档移动、文件登记和安全下载路径的失败测试。
- [ ] 运行测试确认失败。
- [ ] 实现只负责文件系统边界的 helpers，不把分析逻辑放入该模块。
- [ ] 运行测试确认通过。

### Task 2: 接入小说上传与分析归档

**Files:**
- Modify: `packages/studio/src/api/server.ts`
- Modify: `packages/studio/src/pages/CraftManager.tsx`
- Modify: `packages/studio/src/api/server.test.ts`
- Modify: `packages/studio/src/pages/CraftManager.test.ts`

- [ ] 先增加 API 测试：上传返回 asset id，分析成功后源文件和 analysis input 被归档。
- [ ] 运行测试确认失败。
- [ ] 让 `/craft/upload` 写入临时资产并返回 `sourceAssetId`。
- [ ] 让 `/craft/analyze` 接收 asset id 并在成功后归档。
- [ ] 前端携带 asset id。
- [ ] 运行相关测试确认通过。

### Task 3: 下载并保留 B 站视频与字幕

**Files:**
- Modify: `packages/studio/src/api/bilibili.ts`
- Modify: `packages/studio/src/api/bilibili.test.ts`
- Modify: `packages/studio/src/api/server.ts`
- Modify: `packages/studio/src/pages/CraftManager.tsx`

- [ ] 先测试 DASH 媒体响应解析、字幕文件序列化和下载结果元数据。
- [ ] 运行测试确认失败。
- [ ] 下载视频/音频轨并用现有 ffmpeg 能力合成为可播放视频；保留字幕 JSON/TXT。
- [ ] B 站导入接口把资产写入临时目录并返回 asset id。
- [ ] 前端将 asset id 传给分析接口。
- [ ] 运行 B 站与 API 测试确认通过。

### Task 4: 增加重新解析与源文件下载 API

**Files:**
- Modify: `packages/studio/src/api/server.ts`
- Modify: `packages/studio/src/api/server.test.ts`

- [ ] 先增加重新解析成功、失败保留旧 profile、下载路径拒绝越界的测试。
- [ ] 运行测试确认失败。
- [ ] 实现 `POST /crafts/:id/reparse`，成功前写临时 profile，成功后替换旧结果。
- [ ] 实现源资产状态和登记文件的下载接口。
- [ ] 运行 API 测试确认通过。

### Task 5: 重构详情页为分区工作台

**Files:**
- Modify: `packages/studio/src/pages/CraftManager.tsx`
- Modify: `packages/studio/src/pages/CraftManager.test.ts`
- Modify: `packages/studio/src/hooks/use-i18n.ts`

- [ ] 先增加详情分区选择、旧标题不渲染、源资产空状态和重新解析按钮状态测试。
- [ ] 运行测试确认失败。
- [ ] 删除详情页重复标题，添加概览、视频结构、拆文模块、范例、源文件分区。
- [ ] 添加重新解析操作、加载状态、失败提示和下载入口。
- [ ] 添加必要的中文/英文文案。
- [ ] 运行页面测试确认通过。

### Task 6: 集成验证和收尾

**Files:**
- Modify: `packages/studio/src/api/craft-source-assets.ts` (only if verification exposes a defect)
- Modify: `packages/studio/src/api/bilibili.ts` (only if verification exposes a defect)

- [ ] 运行 Studio 全量测试。
- [ ] 构建 core 并运行 Studio 类型检查。
- [ ] 构建 Studio 客户端。
- [ ] 重启 Studio，用浏览器验证详情分区、标题去重、源文件状态和重新解析入口。
- [ ] 检查 diff、提交并按 AGENTS.md 完成 worktree 收尾。
