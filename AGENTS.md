# AGENTS.md

本仓库的主要工作流规则文件。涉及开发、修复、重构、测试、提交和收尾时，先按这里的流程执行。这是 zcode 唯一读取的规则文件，不再维护 CLAUDE.md。

## 开发前

### worktree 隔离

任何功能、修复、重构类变更都不要直接在主 checkout 上做。只允许在 worktree 里完成代码修改、验证和提交。

- 目录默认放在 `.worktrees/<task-name>`，分支名 `codex/<task-name>`。
- 动手前先确认当前位置：
  ```bash
  git rev-parse --show-toplevel
  git branch --show-current
  git worktree list
  ```
- 如果当前在主 checkout 且目标分支是 `master`，先切到或创建独立 worktree，再继续。

### 设计文档执行

- 设计文档/spec 完成后直接按文档执行，不需要等待用户查看、确认或再次询问。
- 不要进入 plan mode，不要调用 `ExitPlanMode` 让用户审批 spec，不要把 spec 当作需要签字的产物。
- 调研、设计、实现一气呵成：理解需求 → 探索代码 → 创建 worktree → 直接写代码，中间不停下来等用户确认。
- 只有遇到真正的范围或方向分歧（代码和默认推断都无法解决）时才提问，且只问决定性问题。

## 开发中

### Studio 运行

- 开发 Studio 前先在当前 worktree 执行 `pnpm worktree:check`；用 `pnpm worktree:runtime` 查看当前任务的端口和运行目录。
- 用 `pnpm --dir packages/studio dev` 启动，启动器会自动分配可用端口，日志写入 `.studio-live/<task-slug>/`。

### 验证要求

- 提交前先确认 `git status --short` 只剩预期改动。
- 需要安装或依赖更新时，优先保留 lockfile 和工作区配置的真实变化，不要把它们当作垃圾忽略。
- `node_modules`、构建产物和临时文件仍然留在 `.gitignore` 管理范围内。

### 变更原则

- 只提交真正需要保留的文件。
- 如果某个文件只是安装、构建或运行后自动生成，而且不影响复现，就加入忽略，而不是硬塞进提交。
- 如果它会影响复现、依赖解析或工作流本身，就提交。

## 开发后（收尾）

### 提交与合并

任务完成后**必须立即收尾**，不要把已完成的 worktree 挂着不管：

1. 在 worktree 里提交改动。
2. 用 `node scripts/finish-worktree.mjs --base master` 完成回主分支、推送、删除 worktree、`git worktree prune`。
3. 如果脚本判断主 checkout 或 worktree 不是干净状态，先处理干净，再继续。

### Studio 重启

每次 finish-worktree 合并回 master 后，如果改动涉及 Studio 前端或后端代码，**必须立刻自动重启 Studio，不要询问用户**，不要等用户催。从主 checkout 重启时不执行 worktree 检查。

1. 根据 `pnpm worktree:runtime` 输出，杀掉占用当前任务 Studio 端口的旧进程；如果端口已被占用且进程是 Studio 相关的 tsx/vite，先杀再启。
2. 在主 checkout 执行 `pnpm install`（确保新依赖到位）。
3. 在主 checkout 根目录执行 `pnpm --dir packages/studio dev`。
4. 等待 5 秒，确认 `pnpm worktree:runtime` 输出的端口监听成功。

## 运行时文件管理

项目运行时产生的日志、截图、临时文件等不得散落在项目根目录，统一放到对应目录并加入 `.gitignore`。不要在项目根目录创建散落日志文件（如 `.studio-live-*.log`）。

| 目录 | 用途 | 忽略 |
|---|---|---|
| `.studio-live/` | Studio 运行日志（server/client 的 out/err） | 是 |
| `.screenshots/` | 开发过程中对网页/Studio 的截图，文件名 `{功能描述}-{时间戳}.png` | 是 |
| `.worktrees/` | Git worktree 隔离工作区 | 是 |
| `.storyos/` | 用户运行时数据（会话记录、书籍内容、密钥） | 是 |
| `books/` `crafts/` `shorts/` `worlds/` `genres/` | 用户创作数据 | 是 |
| `radar/` `prompt/` `craft-source-uploads/` | 其他运行时数据 | 是 |
| `tmp/` | 临时文件 | 是 |

## 隔离 worktree 清理

用户要求清理隔离工作区时，必须先盘点再处理，不能按目录名或分支名直接删除。

1. **逐项盘点**：`git worktree list --porcelain`；对每个 worktree 执行 `git -C <worktree> status --short --branch` 和 `git -C <worktree> log -1 --oneline --decorate`；Studio worktree 执行 `pnpm --dir <worktree> worktree:runtime` 检查端口进程；检查 Git 锁、合并状态、分支是否已合并到 `master`、`.worktrees/` 下是否有未注册物理目录。

2. **占用判定**：当前对话正在使用、仍有 Studio 进程或运行锁的 worktree 视为正在使用，禁止修改、提交或删除。只有"没有端口监听"不能证明无人使用；无法确认所有权时默认保留并报告。仅有未提交改动的不能直接删除，先看 diff，明确无人使用且任务范围清楚时才允许补完、测试、提交。

3. **处理顺序**：
   - 干净且已合并到 `master`：删除 worktree、删除已合并分支、`git worktree prune`。
   - 无人使用但有明确未完成改动：先理解 diff，补完并验证，提交后用 `node scripts/finish-worktree.mjs --base master` 合并、推送和清理。
   - 改动范围不清楚、测试失败且无法安全修复、所有权无法确认：保留 worktree，不得为了"清理"而丢弃改动。
   - 主 checkout 的本地配置、运行时数据和未跟踪目录必须单独分类；除非明确属于当前任务，不得带入提交、删除或覆盖。

4. **删除安全**：不得对正在使用或有未提交改动的 worktree 使用 `git worktree remove --force`；只有 Git 已解除 worktree 注册后才允许清理物理目录，递归删除前必须确认路径在 `.worktrees/` 内；不得删除 `.storyos/`、`shorts/` 等用户运行数据；清理后再次检查 `git worktree list`、分支引用、主 checkout 状态和残留目录。
