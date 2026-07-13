# 并行开发工作流防护设计

## 目标

让多个 Codex 对话可以在独立 worktree 中并行开发，同时避免收尾合并、Studio 运行资源和主 checkout 操作互相冲突。

## 范围

本阶段只修改仓库开发工作流，不修改 Studio 业务功能。实现三项能力：

1. `finish-worktree` 的跨进程互斥锁；
2. 按 worktree/分支生成独立的 Studio 端口和运行目录；
3. 统一的 worktree 状态检查，并接入开发和收尾入口。

不处理已有的 `shorts/` 用户内容，不改变现有分支命名约定、worktree 目录约定或 master 合并策略。

## 设计

### 1. 收尾锁

新增 `scripts/worktree-lock.mjs`，使用 Git common directory 下的原子目录创建作为锁机制。锁目录位于 `.git/codex-finish.lock`，并写入持有进程、分支、worktree 和创建时间等诊断信息。

`finish-worktree.mjs` 在读取并确认 worktree 状态后、执行 checkout/pull/merge/push 前获取锁；所有退出路径都通过 `finally` 释放锁。若锁已存在，脚本立即失败，并显示现有持有者信息，不自动强制清理未知锁，避免两个收尾流程同时操作 master。

锁只保护同一仓库的收尾流程，不阻止开发、测试或启动 Studio。锁模块通过依赖注入的目录和时间函数保持可测试。

### 2. 任务级运行时配置

新增 `scripts/worktree-runtime.mjs`，根据当前分支名生成稳定的任务 slug，并生成：

- `.studio-live/<task-slug>/` 日志目录；
- `.screenshots/<task-slug>/` 截图目录；
- 当前 worktree 内的 `.inkos/` 运行时数据目录；
- 一对稳定且可覆盖的 Studio 前后端端口。

端口默认从分支 slug 的哈希映射到开发端口范围，并在启动前检查占用情况；显式的 `INKOS_STUDIO_CLIENT_PORT`、`INKOS_STUDIO_PORT` 或任务基础端口优先。日志和截图目录按任务 slug 分组；`.inkos/` 保持 worktree 本地根目录，以保持 Studio 现有的项目文件和运行时数据语义。新增的 Studio 启动入口负责把这些配置传给 API 和 Vite，并在退出时回收子进程。

### 3. Worktree 守卫

新增 `scripts/worktree-guard.mjs`，提供可复用的检查函数和 CLI：

- 必须位于 linked worktree，而不是主 checkout；
- 当前分支不能是 `master`；
- worktree 必须位于项目 `.worktrees/` 目录；
- worktree 状态必须干净时才允许收尾；
- 主 checkout 必须干净时才允许收尾。

开发入口通过显式的 `worktree:check` 命令使用守卫，`finish-worktree.mjs` 在已有状态检查基础上复用相同逻辑。错误信息包含实际路径、分支和建议操作，便于多个对话同时运行时快速定位问题。

## 文件边界

- `scripts/worktree-lock.mjs`：收尾锁的获取和释放。
- `scripts/worktree-runtime.mjs`：任务 slug、运行目录和端口配置计算。
- `scripts/studio-dev.mjs`：创建运行目录、探测端口并启动/回收 Studio 子进程。
- `scripts/worktree-guard.mjs`：Git/worktree 状态检查。
- `scripts/finish-worktree.mjs`：接入锁和守卫，不改变原有合并顺序。
- `package.json`：提供工作流检查和运行时配置入口。
- `AGENTS.md`：补充新的命令和运行时隔离约定。
- `scripts/__tests__/`：覆盖三个工作流模块的行为测试。

## 错误处理

- 锁已存在：非零退出，显示锁信息；不自动删除。
- 锁释放失败：保留原始收尾错误，并把释放错误写入 stderr。
- 无法识别 worktree：非零退出，提示在 linked worktree 中重试。
- 端口被占用：优先尝试配置中的备用端口；没有可用端口时非零退出并显示任务 slug 和建议覆盖变量。
- 运行目录创建失败：非零退出，不启动 Studio。

## 验证策略

使用 Node 内置测试验证纯函数和临时目录上的真实文件系统行为：

1. 锁首次获取成功，重复获取失败，释放后可再次获取；
2. 锁信息文件包含持有者诊断字段；
3. 分支名转换为稳定 slug，并正确生成目录和端口；
4. 主 checkout、linked worktree、错误分支和脏状态分别得到正确检查结果；
5. `finish-worktree --dry-run` 保持原有只读行为。

完成后运行新增的工作流测试、Studio 现有单元测试、类型检查和 `git diff --check`。
