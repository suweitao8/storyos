#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { acquireWorktreeLock } from "./worktree-lock.mjs";
import { assertWorktreeSafe, readWorktreeContext } from "./worktree-guard.mjs";

function parseArgs(argv) {
  const result = {
    baseBranch: "master",
    dryRun: false,
    branch: undefined,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      result.dryRun = true;
      continue;
    }
    if (arg === "--base") {
      const value = argv[i + 1];
      if (!value) throw new Error("--base requires a value");
      result.baseBranch = value;
      i += 1;
      continue;
    }
    if (arg === "--branch") {
      const value = argv[i + 1];
      if (!value) throw new Error("--branch requires a value");
      result.branch = value;
      i += 1;
      continue;
    }
  }

  return result;
}

function runGit(cwd, args, options = {}) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    throw new Error(
      `git ${args.join(" ")} failed${stderr || stdout ? `\n${stderr || stdout}` : ""}`,
    );
  }
  return (result.stdout ?? "").trim();
}

const args = parseArgs(process.argv.slice(2));
const context = readWorktreeContext(process.cwd(), runGit, { includeStatus: true });
assertWorktreeSafe(context, { baseBranch: args.baseBranch, forFinish: true });

const { worktreePath, gitCommonDir, mainRoot } = context;
const currentBranch = args.branch ?? context.branch;

if (!currentBranch) {
  throw new Error("Could not determine current branch");
}
if (currentBranch === args.baseBranch) {
  throw new Error(`Refusing to finish from base branch "${args.baseBranch}"`);
}

const plan = [
  `base branch: ${args.baseBranch}`,
  `feature branch: ${currentBranch}`,
  `main root: ${mainRoot}`,
  `worktree: ${worktreePath}`,
  "owned cleanup: yes",
];

if (args.dryRun) {
  console.log(plan.join("\n"));
  process.exit(0);
}

const finishLock = await acquireWorktreeLock(resolve(gitCommonDir, "codex-finish.lock"), {
  branch: currentBranch,
  worktree: worktreePath,
  mainRoot,
});

try {
  console.log(`Checking out ${args.baseBranch} in main checkout...`);
  runGit(mainRoot, ["checkout", args.baseBranch]);
  console.log(`Pulling latest ${args.baseBranch}...`);
  runGit(mainRoot, ["pull", "--ff-only", "origin", args.baseBranch]);
  console.log(`Merging ${currentBranch} into ${args.baseBranch}...`);
  runGit(mainRoot, ["merge", "--no-ff", "--no-edit", currentBranch]);
  console.log(`Pushing ${args.baseBranch}...`);
  runGit(mainRoot, ["push", "origin", args.baseBranch]);

  console.log(`Removing worktree ${worktreePath}...`);
  try {
    runGit(mainRoot, ["worktree", "remove", "--force", worktreePath]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("Directory not empty")) {
      throw error;
    }
  }
  process.chdir(mainRoot);
  if (existsSync(worktreePath)) {
    await rm(worktreePath, { recursive: true, force: true });
  }
  console.log("Pruning stale worktree metadata...");
  runGit(mainRoot, ["worktree", "prune"]);

  console.log(`Deleting branch ${currentBranch}...`);
  runGit(mainRoot, ["branch", "-d", currentBranch]);
  console.log("Worktree finish complete.");
} finally {
  await finishLock.release();
}
