# AGENTS.md

## 规则来源

- 这是本仓库的主要工作流规则文件。
- 以后涉及开发、修复、重构、测试、提交和收尾时，先按这里的流程执行。

## 默认开发流程

1. 先创建独立 worktree，再开始改动。
2. worktree 目录默认放在项目内 `.worktrees/<task-name>`。
3. 分支名默认使用 `codex/<task-name>`。
4. 任何功能、修复、重构类变更都不要直接在主 checkout 上做。
5. 只允许在 worktree 里完成代码修改、验证和提交。

## 设计文档执行

- 设计文档/spec 完成后直接按文档执行，不需要等待用户查看、确认或再次询问。
- 不要进入 plan mode，不要调用 `ExitPlanMode` 让用户审批 spec，不要把 spec 当作需要签字的产物。
- 调研、设计、实现一气呵成：理解需求 → 探索代码 → 创建 worktree → 直接写代码，中间不停下来等用户确认。
- 只有遇到真正的范围或方向分歧（代码和默认推断都无法解决）时才提问，且只问决定性问题。

## 开工前检查

在动手前先确认：

- `git rev-parse --show-toplevel`
- `git rev-parse --git-common-dir`
- `git branch --show-current`
- `git worktree list`

如果当前 shell 还在主 checkout，而且目标分支是 `master`，先切到或创建独立 worktree，再继续。

## 收尾流程

完成后按这个顺序处理：

1. 在 worktree 里提交改动。
2. 用 `node scripts/finish-worktree.mjs --base master` 完成回主分支、推送、删除 worktree、`git worktree prune`。
3. 不要把已完成的 worktree 留给下一次对话。

## 强制收尾

- 只要当前任务已经完成，必须先提交，再立刻执行收尾脚本。
- 如果脚本判断主 checkout 或 worktree 不是干净状态，先处理干净，再继续。
- 除非用户明确要求保留 worktree，否则不要把已完成的 worktree 挂着不管。

## Studio 重启

- 每次 finish-worktree 合并回 master 后，如果改动涉及 Studio 前端或后端代码，必须立刻自动重启 Studio，不要询问用户。
- 开发 Studio 前先在当前 worktree 执行 `pnpm worktree:check`；用 `pnpm worktree:runtime` 查看当前任务的端口和运行目录。finish 合并完成后从主 checkout 重启 Studio 时不执行 worktree 检查。
- 重启步骤：
  1. 根据 `pnpm worktree:runtime` 输出，杀掉占用当前任务 Studio 端口的旧进程；如果端口已被占用且进程是 Studio 相关的 tsx/vite，先杀再启。
  2. 在主 checkout 执行 `pnpm install`（确保新依赖到位）。
  3. 在需要运行的 checkout 根目录执行 `pnpm --dir packages/studio dev`；启动器会自动分配可用端口，并把日志写入 `.studio-live/<task-slug>/`。
  4. 等待 5 秒，确认 `pnpm worktree:runtime` 输出的端口监听成功。
- 不要等用户催，合并完就重启。

## 验证要求

- 提交前先确认 `git status --short` 只剩预期改动。
- 需要安装或依赖更新时，优先保留 lockfile 和工作区配置的真实变化，不要把它们当作垃圾忽略。
- `node_modules`、构建产物和临时文件仍然留在 `.gitignore` 管理范围内。

## 变更原则

- 只提交真正需要保留的文件。
- 如果某个文件只是安装、构建或运行后自动生成，而且不影响复现，就加入忽略，而不是硬塞进提交。
- 如果它会影响复现、依赖解析或工作流本身，就提交。

## 运行时文件管理

项目运行时产生的日志、截图、临时文件等不得散落在项目根目录，统一放到对应目录并加入 `.gitignore`。

### 目录约定

| 目录 | 用途 | 是否忽略 |
|---|---|---|
| `.studio-live/` | Studio 运行日志（server/client 的 out/err） | 是 |
| `.screenshots/` | 开发过程中对网页/Studio 的截图（用于检查 UI 改动） | 是 |
| `.worktrees/` | Git worktree 隔离工作区 | 是 |
| `.inkos/` | 用户运行时数据（会话记录、书籍内容、密钥） | 是 |
| `tmp/` | 临时文件 | 是 |

### 日志

- Studio 重启时，日志统一写到 `.studio-live/` 目录（见「Studio 重启」步骤）。
- 不要在项目根目录创建 `.studio-live-*.log` 等散落日志文件。

### 截图

- 对网页/Studio 界面截图时，截图文件统一放到 `.screenshots/` 目录。
- 截图文件名格式：`{功能描述}-{时间戳}.png`，如 `model-config-20260708.png`。
- `.screenshots/` 已加入 `.gitignore`，不会被提交。
- 截图仅用于开发调试，不作为项目产物保留。

## 隔离 worktree 清理

用户要求清理隔离工作区时，必须先盘点再处理，不能按目录名或分支名直接删除。

1. 逐项检查：
   - `git worktree list --porcelain`
   - 对每个 worktree 执行 `git -C <worktree> status --short --branch` 和 `git -C <worktree> log -1 --oneline --decorate`
   - 如果是 Studio worktree，执行 `pnpm --dir <worktree> worktree:runtime`，并检查对应端口上的 Studio 进程
   - 检查 Git 锁、合并状态、分支是否已合并到 `master`，以及 `.worktrees/` 下是否存在未注册的物理目录

2. 占用判定：
   - 当前对话正在使用的 worktree、仍有对应 Studio 进程或运行锁的 worktree，视为正在使用，禁止修改、提交或删除
   - 只有“没有端口监听”不能证明 worktree 无人使用；无法确认所有权时，默认保留并报告
   - 仅有未提交改动的 worktree 不能直接删除；先查看 diff，只有在明确无人使用且任务范围清楚时，才允许继续完成、测试和提交

3. 处理顺序：
   - 干净且已合并到 `master` 的 worktree：删除 worktree、删除已合并分支，再执行 `git worktree prune`
   - 无人使用但有明确未完成改动的 worktree：先理解 diff，补完必要实现并验证，提交后用 `node scripts/finish-worktree.mjs --base master` 合并、推送和清理
   - 改动范围不清楚、测试失败且无法安全修复，或所有权无法确认：保留 worktree，不得为了“清理”而丢弃改动
   - 主 checkout 中的本地配置、运行时数据和未跟踪目录必须单独分类；除非明确属于当前任务，不得带入提交、删除或覆盖

4. 删除安全：
   - 不得对正在使用或有未提交改动的 worktree 使用 `git worktree remove --force`
   - 只有 Git 已解除 worktree 注册后，才允许清理对应物理目录；递归删除前必须确认目标路径位于项目 `.worktrees` 目录内
   - 不得删除 `.inkos/`、`shorts/` 等用户运行数据；清理后必须再次检查 `git worktree list`、分支引用、主 checkout 状态和残留目录
