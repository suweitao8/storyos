# Story Workspace List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a story-list workspace tab for long and short stories, show the active story beside the page title, and remove story collections from the left operation bar while keeping writing modes as their own navigation row.

**Architecture:** Keep story selection in the existing hash routes and reuse the existing `/books`, `/shorts`, and `/crafts` data sources. Extend the shared story workspace stage model with a `list` stage, render one focused list panel for the current content type, and make each list item navigate through the existing `nav` callbacks. The left sidebar keeps only three independent creation/navigation rows and no story collection sections.

**Tech Stack:** React, TypeScript, Vitest, existing PageToolbar/usePageToolbar, existing Studio API hooks and hash routes.

---

### Task 1: Extend Workspace Navigation

**Files:**
- Modify: `packages/studio/src/pages/story-workspace-state.ts`
- Test: `packages/studio/src/pages/story-workspace-state.test.ts`

- [ ] **Step 1: Write failing tests**

Add assertions that the shared workspace tab builder includes a first `list` tab labelled `故事列表`/`Story list`, and that `resolveStoryWorkspaceStage("list")` returns `list` while unknown values still fall back to `settings`.

- [ ] **Step 2: Run the focused test and confirm failure**

Run `pnpm --filter @actalk/inkos-studio exec vitest run src/pages/story-workspace-state.test.ts` and expect the new `list` assertions to fail before implementation.

- [ ] **Step 3: Implement the stage**

Add `list` to `StoryWorkspaceStage`, labels, stage order, and `buildStoryWorkspaceTabs`. Keep `script`, `storyboard`, and `video` disabled exactly as they are today.

- [ ] **Step 4: Run the focused test and confirm it passes**

Run the same Vitest command and expect all assertions to pass.

### Task 2: Render Story Lists And Active Story Context

**Files:**
- Create: `packages/studio/src/pages/StoryListPanel.tsx`
- Test: `packages/studio/src/pages/StoryListPanel.test.tsx`
- Modify: `packages/studio/src/pages/ChatPage.tsx`
- Modify: `packages/studio/src/App.tsx`

- [ ] **Step 1: Write failing component tests**

Cover long and short story lists, including current-item highlighting and empty state. Writing modes keep their existing dedicated list page and sidebar row rather than being duplicated inside the story workspace.

- [ ] **Step 2: Run the focused test and confirm failure**

Run `pnpm --filter @actalk/inkos-studio exec vitest run src/pages/StoryListPanel.test.tsx` and expect the missing panel/import failures.

- [ ] **Step 3: Implement the list panel**

Create a focused panel with a responsive card/list layout, current-item highlight, title, brief metadata, and empty state. Keep API loading/error states explicit. Accept `kind`, data, current id, and navigation callbacks as props so it does not own routing or duplicate fetch logic.

- [ ] **Step 4: Integrate the panel and title context**

Load the existing books and shorts data in the owning page flow, render `StoryListPanel` when the workspace stage is `list`, and add the selected story title to the right side of the page toolbar context without changing the existing route title. Long and short routes must keep their current story id active after navigation.

- [ ] **Step 5: Run focused tests**

Run the workspace-state and StoryListPanel tests together and expect all to pass.

### Task 3: Simplify The Left Operation Bar

**Files:**
- Modify: `packages/studio/src/components/Sidebar.tsx`
- Test: `packages/studio/src/components/Sidebar.test.tsx` if an existing sidebar test surface exists; otherwise add a focused render test beside the component.

- [ ] **Step 1: Write failing sidebar assertions**

Assert that the create/navigation area exposes three separate rows labelled `长篇故事`, `短篇故事`, and `写作模式`, while story collection headings/items are absent from the left sidebar.

- [ ] **Step 2: Run the focused test and confirm failure**

Run the sidebar-focused Vitest command and confirm the current two-column/create-plus-collection structure does not satisfy the assertions.

- [ ] **Step 3: Implement the sidebar layout**

Remove the visible long-story and short-story collection sections from the left operation bar. Render the three requested entries as independent full-width rows, keeping existing active states and navigation handlers. Do not delete internal session state needed by chat continuity.

- [ ] **Step 4: Run the focused test and confirm it passes**

Run the sidebar-focused Vitest command and expect all assertions to pass.

### Task 4: Regression Verification And Delivery

**Files:**
- Modify: only files required by Tasks 1-3.

- [ ] **Step 1: Run Studio tests**

Run `pnpm --filter @actalk/inkos-studio test` and require all Studio tests to pass.

- [ ] **Step 2: Run typecheck/build and diff checks**

Run `pnpm typecheck`, `pnpm build`, and `git diff --check` from the worktree. Existing chunk-size warnings are acceptable; typecheck, build, and diff checks must complete successfully.

- [ ] **Step 3: Verify the running UI**

Restart Studio on ports `4567` and `4569`, open the current short-story route in the Codex built-in browser, and verify: the workspace has a story-list tab, the selected story title is visible beside the page title, clicking a list item changes the hash route, and the left bar has no story collection section.

- [ ] **Step 4: Commit and clean up**

Commit the implementation on `codex/story-workspace-list`, run `node scripts/finish-worktree.mjs --base master`, restart Studio after the merge, and confirm only the user-owned untracked `shorts/` data remains in the main checkout.
