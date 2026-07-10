# Unified Page Toolbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one consistent top navigation bar to every Studio content page, move global language/theme controls into it, and migrate page-specific tabs to the same visual component.

**Architecture:** Create a presentational `PageToolbar` component with typed tabs, leading content, page actions, and global actions. Render one global toolbar from `App.tsx` based on the current route, while `CraftManager` and `ImportManager` render the same component for their stateful local tabs. Keep existing route/state/API ownership in the current pages.

**Tech Stack:** React, TypeScript, Tailwind utility classes, lucide-react, Vitest, existing `useTheme`, `useI18n`, and `useColors` hooks.

---

### Task 1: Add the shared toolbar contract and tests

**Files:**
- Create: `packages/studio/src/components/PageToolbar.tsx`
- Create: `packages/studio/src/components/PageToolbar.test.tsx`

- [ ] **Step 1: Write failing component contract tests**

Test the exported `PageToolbar` with the existing Studio Vitest/React test setup. Cover:

```tsx
it("renders title, active tab, global actions, and horizontally scrollable tabs", () => {
  render(
    <PageToolbar
      title="写作模式"
      tabs={[
        { id: "list", label: "模式列表" },
        { id: "create", label: "新建模式" },
      ]}
      activeTab="list"
      onTabChange={() => undefined}
      globalActions={<button type="button">EN</button>}
    />,
  );

  expect(screen.getByText("写作模式")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "模式列表" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("button", { name: "EN" })).toBeInTheDocument();
  expect(screen.getByTestId("page-toolbar-tabs")).toHaveClass("overflow-x-auto");
});
```

If the repository test setup does not provide DOM rendering helpers, export and test pure class/selection helpers from the component, then use the existing page contract test style to assert the rendered class names from source-level contracts.

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
pnpm --filter @actalk/inkos-studio exec vitest run src/components/PageToolbar.test.tsx
```

Expected: FAIL because `PageToolbar` and its contract do not exist.

- [ ] **Step 3: Implement the shared toolbar**

Implement typed props:

```ts
export interface PageToolbarTab {
  readonly id: string;
  readonly label: React.ReactNode;
  readonly icon?: React.ReactNode;
  readonly disabled?: boolean;
}

export interface PageToolbarProps {
  readonly title?: React.ReactNode;
  readonly tabs?: ReadonlyArray<PageToolbarTab>;
  readonly activeTab?: string;
  readonly onTabChange?: (id: string) => void;
  readonly leading?: React.ReactNode;
  readonly actions?: React.ReactNode;
  readonly globalActions?: React.ReactNode;
  readonly className?: string;
}
```

Use one border/background treatment for the outer bar, a `data-testid="page-toolbar-tabs"` scroll container for tabs, `aria-current="page"` for the active tab, and `aria-label="页面导航"` on the tab navigation. Active tabs use the existing primary color token and an underline; inactive tabs use muted foreground with hover feedback. Do not add a new color system.

- [ ] **Step 4: Run the focused test and verify it passes**

Run the same Vitest command. Expected: PASS.

- [ ] **Step 5: Commit the shared component**

```bash
git add packages/studio/src/components/PageToolbar.tsx packages/studio/src/components/PageToolbar.test.tsx
git commit -m "feat(studio): add shared page toolbar"
```

### Task 2: Add route titles and the global application toolbar

**Files:**
- Modify: `packages/studio/src/App.tsx`
- Modify: `packages/studio/src/App.test.ts`
- Modify: `packages/studio/src/components/PageToolbar.tsx` only if the global action props need a small typed extension

- [ ] **Step 1: Write failing route-title tests**

Add a pure exported helper in `App.tsx` and test representative routes:

```ts
expect(getRouteToolbarTitle({ page: "services" }, "zh")).toBe("模型配置");
expect(getRouteToolbarTitle({ page: "craft" }, "zh")).toBe("写作模式");
expect(getRouteToolbarTitle({ page: "import" }, "zh")).toBe("导入");
```

Cover book/chapter routes with the existing book id context and the English language branch.

- [ ] **Step 2: Run the App test and verify it fails**

```bash
pnpm --filter @actalk/inkos-studio exec vitest run src/App.test.ts
```

Expected: FAIL because the helper is not defined.

- [ ] **Step 3: Implement the global toolbar in App**

Add `getRouteToolbarTitle(route, lang)` and render `PageToolbar` immediately after the one-pixel divider and before the scrollable main content. Build global actions from existing state:

```tsx
const globalActions = (
  <div className="flex items-center gap-1">
    <button onClick={() => void onLangChange("zh")} aria-pressed={currentLang === "zh"}>中文</button>
    <button onClick={() => void onLangChange("en")} aria-pressed={currentLang === "en"}>EN</button>
    <button onClick={() => setTheme("light")} aria-pressed={theme === "light"}>浅色</button>
    <button onClick={() => setTheme("dark")} aria-pressed={theme === "dark"}>深色</button>
  </div>
);
```

Use the existing `putApi("/project", { language })` and `refetchProject()` logic, with a local saving flag so language buttons cannot race. Keep the toolbar visible on all ready routes, including pages with full-viewport chat layouts.

- [ ] **Step 4: Remove duplicate language/theme controls from ProjectSettings**

Delete only the two general-card rows for language and theme. Keep the rest of the general card and all project settings. The global toolbar becomes the single direct control surface.

- [ ] **Step 5: Run App/settings tests and typecheck**

```bash
pnpm --filter @actalk/inkos-studio exec vitest run src/App.test.ts src/pages/project-settings-model.test.ts
pnpm --filter @actalk/inkos-studio typecheck
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 6: Commit the global toolbar integration**

```bash
git add packages/studio/src/App.tsx packages/studio/src/App.test.ts packages/studio/src/pages/ProjectSettings.tsx
git commit -m "feat(studio): add global page toolbar actions"
```

### Task 3: Migrate CraftManager and ImportManager tabs

**Files:**
- Modify: `packages/studio/src/pages/CraftManager.tsx`
- Modify: `packages/studio/src/pages/ImportManager.tsx`
- Modify: `packages/studio/src/pages/craft-profile-view.test.ts`
- Create or modify: `packages/studio/src/pages/import-navigation.test.ts`

- [ ] **Step 1: Add navigation contract tests**

Assert that both pages use the shared toolbar contract, preserve their tab labels, and expose active state:

```ts
expect(CRAFT_TABS).toEqual(["list", "create", "detail"]);
expect(IMPORT_TABS).toEqual(["chapters", "canon", "fanfic", "spinoff"]);
expect(PAGE_TOOLBAR_TAB_TEST_IDS).toContain("page-toolbar-tabs");
```

Keep existing selection/persistence tests unchanged except for the shared class/label contract.

- [ ] **Step 2: Run the focused navigation tests and verify the new contract fails**

```bash
pnpm --filter @actalk/inkos-studio exec vitest run src/pages/craft-profile-view.test.ts src/pages/craft-navigation-state.test.ts src/pages/import-navigation.test.ts
```

Expected: FAIL only for the new shared-toolbar contract until migration is complete.

- [ ] **Step 3: Replace CraftManager's local tab markup**

Import `PageToolbar`, pass `title={t("craft.title")}` or the existing translated page label, map each `tabConfig` entry to `PageToolbarTab`, and keep `openList`, `openCreate`, and `openDetailTab` as the handlers. Remove `CRAFT_LAYOUT_CLASSES.tabBar` and `TabButton` after no longer used. Preserve deletion, recent-selection, and detail rendering behavior.

- [ ] **Step 4: Replace ImportManager's local tab markup**

Export `IMPORT_TABS` for test visibility, map the existing icon/label list to `PageToolbar`, and keep the existing `setTab`/`setStatus` behavior. Remove the `w-fit` pill container so the tabs occupy the shared scrollable navigation region. Preserve all import request handlers and their loading/error states.

- [ ] **Step 5: Run focused tests and verify they pass**

```bash
pnpm --filter @actalk/inkos-studio exec vitest run src/pages/craft-profile-view.test.ts src/pages/craft-navigation-state.test.ts src/pages/import-navigation.test.ts
```

Expected: PASS, including the existing recent-selection behavior.

- [ ] **Step 6: Commit the page tab migration**

```bash
git add packages/studio/src/pages/CraftManager.tsx packages/studio/src/pages/ImportManager.tsx packages/studio/src/pages/craft-profile-view.test.ts packages/studio/src/pages/import-navigation.test.ts
git commit -m "feat(studio): standardize craft and import navigation"
```

### Task 4: Full verification and visual acceptance

**Files:**
- No additional source files expected.

- [ ] **Step 1: Run Studio full tests and builds**

```bash
pnpm --filter @actalk/inkos-studio test
pnpm --filter @actalk/inkos-studio typecheck
pnpm --filter @actalk/inkos-studio build
git diff --check
```

Expected: all tests pass, typecheck/build exit successfully, and `git diff --check` is clean. Existing Vite chunk-size and Node deprecation warnings are non-blocking if no new errors appear.

- [ ] **Step 2: Verify the running UI in the in-app browser**

Check `#/chat`, `#/settings`, `#/craft`, `#/import`, `#/services`, and `#/doctor`. For each page confirm the toolbar is present, language/theme controls are visible, active controls have stable highlighting, and the page body does not jump horizontally. On Craft and Import, click each local tab and confirm the active underline changes without losing page state.

- [ ] **Step 3: Verify repository hygiene**

```bash
git status --short
git worktree list
```

Expected: only intended source changes before commit, then a clean main checkout after finish-worktree cleanup.

- [ ] **Step 4: Commit any final test-only correction and finish the worktree**

Use `node scripts/finish-worktree.mjs --base master` from the feature worktree. If Windows returns `EBUSY` while removing the worktree, remove only the exact `.worktrees/unified-page-toolbar` directory after verifying it is inside the project worktree root, run `git branch -d codex/unified-page-toolbar`, and run `git worktree prune`.

- [ ] **Step 5: Restart Studio after merge**

Kill only the Studio processes listening on ports `4567` and `4569`, run `pnpm install --frozen-lockfile` and the core build from the main checkout, clear `packages/studio/node_modules/.vite/deps`, start API on `4569` and Vite on `4567` with logs under `.studio-live/`, then verify both ports are listening.
