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

## 验证要求

- 提交前先确认 `git status --short` 只剩预期改动。
- 需要安装或依赖更新时，优先保留 lockfile 和工作区配置的真实变化，不要把它们当作垃圾忽略。
- `node_modules`、构建产物和临时文件仍然留在 `.gitignore` 管理范围内。

## 变更原则

- 只提交真正需要保留的文件。
- 如果某个文件只是安装、构建或运行后自动生成，而且不影响复现，就加入忽略，而不是硬塞进提交。
- 如果它会影响复现、依赖解析或工作流本身，就提交。
