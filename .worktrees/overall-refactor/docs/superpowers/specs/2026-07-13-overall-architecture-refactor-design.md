# InkOS 整体架构渐进式重构设计

日期：2026-07-13

## 背景

InkOS 当前是一个 pnpm TypeScript monorepo，包含三个运行时包：

- `packages/core`：故事领域模型、LLM、agent、状态、pipeline、互动世界和文件持久化。
- `packages/studio`：Hono API、React Studio 页面、状态 store 和浏览器端交互。
- `packages/cli`：Commander CLI、TUI 以及对 Core / Studio 的运行时封装。

当前行为测试基线为 core 175 个测试文件 / 1696 个测试、studio 68 个测试文件 / 584 个测试、cli 38 个测试文件 / 211 个测试，全部通过。

主要结构性问题集中在以下文件：

- `packages/studio/src/api/server.ts`：约 6.3k 行，同时承担路由注册、请求解析、领域编排、配置读写、文件安全、SSE、daemon 和错误处理。
- `packages/core/src/pipeline/runner.ts`：约 3.2k 行，同时承担书籍生命周期、章节 pipeline、导入、状态同步、记忆索引和审计修订。
- `packages/core/src/agent/agent-tools.ts`：约 2.6k 行，把工具 schema、参数归一化、领域调用、Play 操作和文件工具混在一个注册模块中。
- `packages/studio/src/pages/ChatPage.tsx`：约 1.5k 行，同时管理会话、附件、模型选择、技能、Play、故事工作区和渲染。
- `packages/core/src/index.ts`：约 680 行，根出口聚合了几乎全部能力，导致依赖者难以区分稳定公共 API 与内部实现。

## 目标

1. 保持现有 CLI 命令、Studio HTTP 路径、SSE 事件、文件布局和 Core 公共行为兼容。
2. 将“组合根 / 适配器 / 用例 / 领域与基础设施”分离，使每个模块可以独立测试和替换。
3. 降低高耦合文件的职责密度，后续新增功能只需修改对应能力模块和注册表。
4. 把跨边界的输入校验、错误转换、路径安全和事件协议集中到可复用的边界层。
5. 让重构可以按阶段合并，每阶段都有可运行的测试、类型检查和构建证据。

## 非目标

- 不重写业务规则、prompt、状态文件格式或 LLM provider 行为。
- 不在本轮改变 HTTP API 路径、CLI 参数、Studio 页面信息架构或视觉设计。
- 不把 `core` 拆成多个 npm 包；先通过目录边界和 subpath exports 建立稳定边界。
- 不删除现有兼容入口，迁移完成前保留薄 façade。

## 备选方案

### 方案 A：一次性按新架构重写

优点是最终目录整洁；缺点是跨越 API、核心 pipeline、CLI 和前端，回归范围巨大，难以定位行为变化。本方案不采用。

### 方案 B：只做文件切分，不建立边界

优点是改动小；缺点是大文件中的隐式依赖仍然存在，只是把耦合搬到更多文件中。本方案不采用。

### 方案 C：渐进式边界重构（采用）

先定义依赖方向和稳定接口，再按能力迁移实现；每一阶段保留兼容 façade，先迁移测试覆盖最强、边界最清晰的模块。这样可以持续交付，也能用现有 2491 个测试验证行为不变。

## 目标架构

```text
CLI / Studio adapters
        │
        ▼
application use cases / orchestration
        │
        ├── domain models and pure policies
        └── ports
              ├── filesystem / project storage
              ├── LLM / image / voice providers
              ├── event and notification sinks
              └── clock / process runtime
```

依赖规则：

- `models`、纯 policy 和 schema 不依赖 Studio、CLI 或 Node 运行时。
- Core application services 通过显式依赖和 ports 使用文件、LLM、事件等基础设施。
- Studio API 只负责 HTTP 输入输出和依赖组装；路由模块调用 application services，不直接拼装复杂领域逻辑。
- CLI 只负责命令参数、终端表现和运行时启动，不复制 Studio 或 Core 的业务规则。
- 兼容入口可以依赖新模块；新模块不得反向依赖兼容入口。

## 分阶段设计

### 阶段 1：Studio API 组合根与路由边界

把 `server.ts` 变成依赖组装和路由挂载入口，按能力拆出：

- stories / books / shorts：列表、详情、章节、写作、审计、修订、导入导出。
- project / config：项目、模型、服务、提示词包、技能、通知、检测和 review 配置。
- sessions / agent / events：session 生命周期、agent 请求、SSE 和运行事件。
- assets / crafts / radar / interactive-film：故事资产、craft、radar 和互动影游。
- shared boundary：路径安全、错误响应、语言、请求 body 解析、响应序列化。

每个 route module 接收显式 `StudioRouteContext`，禁止从模块级可变变量读取 root、config 或 runtime。`createStudioServer` 继续作为唯一 composition root，旧测试继续通过同一入口验证。

### 阶段 2：Core Pipeline 用例边界

将 `PipelineRunner` 降为兼容门面和编排器，逐步提取：

- `BookLifecycleService`：建书、基础设定修订、同人 / 番外导入。
- `ChapterWorkflowService`：plan、compose、draft、write-next、audit、revise、rewrite。
- `StateSyncService`：truth 文件、结构化状态、Markdown 投影和记忆索引同步。
- `ImportService`：章节、正典和 replay seed 导入。
- `PipelineRuntime`：agent context、模型 override、日志、锁和通知等共享运行时。

每个 service 只暴露用例输入输出；`PipelineRunner` 的旧方法转发到 service，以保持 Core、CLI 和 Studio 兼容。

### 阶段 3：Agent tools 能力注册表

把 `agent-tools.ts` 拆为 capability modules：

- action proposal / confirmation
- sub-agent / research / materials
- writing / import / cover / script / storyboard
- Play
- file and truth editing

每个模块导出 schema、tool factory 和最小依赖类型；统一 registry 只负责按 session kind 组装工具。参数验证和安全路径策略保留在 capability 边界，避免工具模块互相调用内部实现。

### 阶段 4：Studio ChatPage 状态与视图拆分

将页面拆成：

- `useChatSessionLifecycle`：session 列表、创建、加载、激活、终止。
- `useChatAttachments`：文件读取、大小限制、data URL 序列化和错误状态。
- `useModelPicker`：服务、模型、偏好和 fallback 状态。
- `useStoryWorkspace`：故事设置、资产、列表和内容刷新。
- `usePlayWorkspace`：Play choice、HUD、图片设置和 world panel。
- `ChatTranscript`、`ChatComposer`、`ChatWorkspacePanels`：纯展示和事件回调。

`ChatPage` 保留页面级布局与组合，store contract 不变。

### 阶段 5：公共出口与 CLI 适配层收敛

- 将 Core 根出口按 `models`、`interaction`、`pipeline`、`play`、`interactive-film`、`llm`、`agents`、`utils` 提供明确 subpath exports。
- 根出口只保留稳定兼容 API，并在内部改为从领域入口聚合。
- CLI 命令按 book / writing / review / config / play / studio 归类，提取共享 command context 和错误格式化。
- 通过发布包验证确保 workspace protocol 替换、声明文件和运行时入口不变。

## 错误与兼容策略

- 领域错误保持可识别的 error code / 类型；适配层负责将其转换为 HTTP JSON 或 CLI 文本。
- 未知内部异常不得泄露文件路径、API key 或 provider 原始敏感信息。
- 路由迁移期间，旧路径和兼容别名继续指向同一 use case；禁止复制实现。
- 事件名称和 payload 先建立 contract tests，再移动实现。
- 文件写入继续采用临时文件 / 原子替换、路径归一化和既有允许根目录限制。

## 验证策略

每阶段都必须运行：

```text
pnpm test
pnpm typecheck
pnpm build
pnpm audit:semantic-patterns
```

并针对受影响边界运行专项测试：

- API：`packages/studio/src/api/server.test.ts` 及拆分后的 route tests。
- Core pipeline：`packages/core/src/__tests__/pipeline-runner.test.ts` 及新增 service tests。
- Agent tools：`packages/core/src/__tests__/agent-tools*.test.ts`。
- Chat：`packages/studio/src/pages/*state.test.ts`、组件测试和 Playwright smoke test。
- 发布：`pnpm verify:publish-manifests` 与现有 `publish-package.test.ts`。

阶段完成标准：外部 contract 测试通过、类型检查和构建通过、受影响大文件的职责边界可从目录和依赖图中直接看出，并且旧 façade 只剩转发和兼容逻辑。

## 执行顺序

本次实现从阶段 1 开始，先拆 Studio API 的 shared boundary、assets、project/config 和 stories 路由；随后按相同模式迁移 sessions / agent、craft / radar 和 interactive-film。阶段 1 稳定后继续阶段 2。每次迁移以“小步提交 + 全量回归”为单位，避免跨阶段混入行为修改。
