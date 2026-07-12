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

- 设计文档完成后直接按文档执行，不需要等待用户查看、确认或再次询问。

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
- 重启步骤：
  1. 杀掉占用 4567/4569 端口的旧进程（`netstat -ano | grep ":456[79].*LISTENING"` 取 PID，`taskkill //PID <pid> //F`）。
  2. 在主 checkout 执行 `pnpm install`（确保新依赖到位）。
  3. 在 `packages/studio` 目录下用 Git Bash 启动（日志统一写到 `.studio-live/` 目录）：
     - API: `INKOS_STUDIO_PORT=4569 INKOS_PROJECT_ROOT=../.. npx tsx watch --clear-screen=false src/api/index.ts > ../../.studio-live/server.out.log 2> ../../.studio-live/server.err.log &`
     - 前端: `npx vite --host --port 4567 > ../../.studio-live/client.out.log 2> ../../.studio-live/client.err.log &`
  4. 等待 5 秒，确认端口监听成功。
- 如果端口已被占用且进程是 Studio 相关的 tsx/vite，先杀再启。
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
