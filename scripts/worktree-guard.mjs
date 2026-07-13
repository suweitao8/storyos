import { execFileSync } from "node:child_process";
import { dirname, isAbsolute, relative, resolve } from "node:path";

function defaultRunGit(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function isWithin(child, parent) {
  const rel = relative(resolve(parent), resolve(child));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export function readWorktreeContext(cwd = process.cwd(), runGit = defaultRunGit, options = {}) {
  const worktreePath = resolve(runGit(cwd, ["rev-parse", "--show-toplevel"]));
  const gitDir = resolve(worktreePath, runGit(worktreePath, ["rev-parse", "--git-dir"]));
  const gitCommonDir = resolve(worktreePath, runGit(worktreePath, ["rev-parse", "--git-common-dir"]));
  const context = {
    mainRoot: dirname(gitCommonDir),
    worktreePath,
    gitDir,
    gitCommonDir,
    branch: runGit(worktreePath, ["branch", "--show-current"]),
  };

  if (options.includeStatus) {
    context.worktreeStatus = runGit(worktreePath, ["status", "--short"]);
    context.mainStatus = runGit(context.mainRoot, ["status", "--short"]);
  } else {
    context.worktreeStatus = "";
    context.mainStatus = "";
  }

  return context;
}

export function assertWorktreeSafe(context, { baseBranch = "master", forFinish = false } = {}) {
  if (context.gitDir === context.gitCommonDir) {
    throw new Error(
      `Current checkout is not a linked worktree: ${context.worktreePath}. ` +
        "Create or switch to a worktree before developing.",
    );
  }

  if (context.branch === baseBranch) {
    throw new Error(
      `Refusing to operate on base branch "${baseBranch}" in ${context.worktreePath}. ` +
        "Use a task branch in a linked worktree.",
    );
  }

  const ownedRoot = resolve(context.mainRoot, ".worktrees");
  if (!isWithin(context.worktreePath, ownedRoot)) {
    throw new Error(
      `Worktree is outside the owned directory: ${context.worktreePath}. ` +
        `Expected a path under ${ownedRoot}.`,
    );
  }

  if (forFinish) {
    if (context.worktreeStatus) {
      throw new Error(
        "Worktree is not clean. Commit or discard changes before finishing:\n" +
          context.worktreeStatus,
      );
    }
    if (context.mainStatus) {
      throw new Error(
        "Main checkout is not clean. Refusing to merge until it is clean:\n" +
          context.mainStatus,
      );
    }
  }

  return context;
}

if (process.argv[1] && process.argv[1].endsWith("worktree-guard.mjs")) {
  const forFinish = process.argv.includes("--for-finish");
  const context = readWorktreeContext(process.cwd(), defaultRunGit, {
    includeStatus: forFinish,
  });
  assertWorktreeSafe(context, { forFinish });
  console.log(
    `Worktree check passed: ${context.branch} at ${context.worktreePath}` +
      (forFinish ? " (finishable)" : ""),
  );
}
