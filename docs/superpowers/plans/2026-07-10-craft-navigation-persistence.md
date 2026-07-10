# Craft Navigation Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the writing-mode navigation persistent and database-backed so the top navigation always exposes list/create/detail and restores the project's most recently selected craft profile.

**Architecture:** Add a small SQLite-backed Studio preference repository at `<projectRoot>/.inkos/studio.db`. Extend the craft API to return and mutate `recentCraftId`, then make `CraftManager` initialize from that value, persist selection changes, keep all three tabs visible, and apply deterministic fallback rules after deletion.

**Tech Stack:** TypeScript, Hono Studio API, React, Vitest, Node 22 built-in `node:sqlite`, Tailwind utility classes.

---

## File Map

- Create: `packages/studio/src/api/studio-preferences-db.ts` — SQLite schema and short-lived CRUD helpers for project-level Studio preferences.
- Create: `packages/studio/src/api/studio-preferences-db.test.ts` — database initialization, round-trip, and cleanup tests.
- Modify: `packages/studio/src/api/server.ts` — return `recentCraftId`, add recent-selection endpoints, and clear the preference when its craft is deleted.
- Modify: `packages/studio/src/api/server.test.ts` — API contract and deletion fallback coverage.
- Create: `packages/studio/src/pages/craft-navigation-state.ts` — pure state-resolution helpers for initial tab and post-delete selection.
- Create: `packages/studio/src/pages/craft-navigation-state.test.ts` — deterministic UI state tests.
- Modify: `packages/studio/src/pages/CraftManager.tsx` — permanent top navigation, database-backed selection, row highlighting, and empty/error states.
- Modify: `packages/studio/src/pages/craft-profile-view.test.ts` — preserve existing detail rendering coverage and add navigation-facing assertions where useful.
- Modify: `packages/studio/vitest.config.ts` only if the new server-side module needs an explicit source alias; prefer no config change unless a test demonstrates the need.

## Task 1: Add SQLite preference repository

**Files:**
- Create: `packages/studio/src/api/studio-preferences-db.ts`
- Test: `packages/studio/src/api/studio-preferences-db.test.ts`

- [ ] **Step 1: Write the failing database tests**

Cover the public helpers with a temporary project root:

```ts
async function makeTempProjectRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "inkos-studio-preferences-"));
}

it("creates the database and returns null before a preference is saved", async () => {
  const root = await makeTempProjectRoot();
  expect(await getRecentCraftId(root)).toBeNull();
  await expect(access(join(root, ".inkos", "studio.db"))).resolves.toBeUndefined();
});

it("round-trips the recent craft id and clears it", async () => {
  const root = await makeTempProjectRoot();
  await setRecentCraftId(root, "craft-1");
  expect(await getRecentCraftId(root)).toBe("craft-1");
  await clearRecentCraftId(root);
  expect(await getRecentCraftId(root)).toBeNull();
});

it("can initialize repeatedly without duplicating the schema", async () => {
  const root = await makeTempProjectRoot();
  await setRecentCraftId(root, "craft-1");
  await setRecentCraftId(root, "craft-2");
  expect(await getRecentCraftId(root)).toBe("craft-2");
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```text
pnpm -C packages/studio exec vitest run src/api/studio-preferences-db.test.ts
```

Expected: FAIL because the repository module and exported helpers do not exist yet.

- [ ] **Step 3: Implement the minimal repository**

Use Node 22's `DatabaseSync` through `createRequire`, create `.inkos` with `mkdir({ recursive: true })`, and close the connection in a `finally` block for every operation. Export exactly:

```ts
export async function getRecentCraftId(projectRoot: string): Promise<string | null>;
export async function setRecentCraftId(projectRoot: string, craftId: string): Promise<void>;
export async function clearRecentCraftId(projectRoot: string): Promise<void>;
```

The table must be created with `CREATE TABLE IF NOT EXISTS studio_preferences (...)`; writes use an `INSERT ... ON CONFLICT(key) DO UPDATE` statement for `recent_craft_id`.

- [ ] **Step 4: Run the focused tests and verify they pass**

Run the same Vitest command. Expected: all repository tests pass and no `studio.db` handle remains open after the test completes.

- [ ] **Step 5: Commit the repository unit**

```text
git add packages/studio/src/api/studio-preferences-db.ts packages/studio/src/api/studio-preferences-db.test.ts
git commit -m "feat(studio): persist recent craft preference"
```

## Task 2: Extend craft API persistence

**Files:**
- Modify: `packages/studio/src/api/server.ts`
- Test: `packages/studio/src/api/server.test.ts`

- [ ] **Step 1: Add failing API tests**

Use the existing `createStudioServer` test fixture and mock craft storage as the surrounding craft tests do. Assert this contract:

```ts
const list = await app.request("http://localhost/api/v1/crafts");
expect(await list.json()).toMatchObject({ recentCraftId: null });

const save = await app.request("http://localhost/api/v1/crafts/recent", {
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ craftId: existingCraftId }),
});
expect(save.status).toBe(200);

const savedList = await app.request("http://localhost/api/v1/crafts");
expect((await savedList.json()).recentCraftId).toBe(existingCraftId);
```

Also cover a nonexistent ID returning 404, deletion clearing the matching preference, and deletion of a different ID preserving it.

- [ ] **Step 2: Run the focused API tests and verify they fail**

Run:

```text
pnpm -C packages/studio exec vitest run src/api/server.test.ts
```

Expected: the new recent-selection assertions fail because the list response has no preference and the endpoints are absent.

- [ ] **Step 3: Implement the API changes**

Import the three repository helpers. In `GET /api/v1/crafts`, return `{ crafts, recentCraftId }` and degrade database-read failures to `null` with `logger.warn`. Register `PUT /api/v1/crafts/recent` before `GET /api/v1/crafts/:id`; verify `loadCraft(craftId)` returns a profile before saving. Register `DELETE /api/v1/crafts/recent` to clear the key. In the existing craft delete handler, clear the key when the deleted ID equals the stored recent ID.

- [ ] **Step 4: Run the focused API tests and verify they pass**

Run the same command. Expected: existing craft API tests plus all new persistence tests pass.

- [ ] **Step 5: Commit the API unit**

```text
git add packages/studio/src/api/server.ts packages/studio/src/api/server.test.ts
git commit -m "feat(studio): expose recent craft selection API"
```

## Task 3: Isolate navigation state rules

**Files:**
- Create: `packages/studio/src/pages/craft-navigation-state.ts`
- Test: `packages/studio/src/pages/craft-navigation-state.test.ts`

- [ ] **Step 1: Write failing pure-function tests**

Define the expected behavior without React or network calls:

```ts
it("opens detail when the persisted craft still exists", () => {
  expect(resolveInitialCraftState("craft-2", ["craft-1", "craft-2"])).toEqual({
    tab: "detail",
    selectedCraftId: "craft-2",
  });
});

it("falls back to the newest available craft after deleting the recent one", () => {
  expect(resolveAfterCraftDelete("craft-2", ["craft-1"])).toEqual({
    tab: "detail",
    selectedCraftId: "craft-1",
  });
});

it("returns the list state when no craft remains", () => {
  expect(resolveAfterCraftDelete("craft-1", [])).toEqual({
    tab: "list",
    selectedCraftId: null,
  });
});
```

- [ ] **Step 2: Run the focused state tests and verify they fail**

```text
pnpm -C packages/studio exec vitest run src/pages/craft-navigation-state.test.ts
```

Expected: FAIL because the state helpers do not exist.

- [ ] **Step 3: Implement pure state helpers**

Export `CraftTab`, `resolveInitialCraftState(recentCraftId, availableCraftIds)`, and `resolveAfterCraftDelete(deletedCraftId, remainingCraftIds)`. The helpers must only accept IDs and ordered craft IDs; choose the last remaining ID for fallback, and never return a detail state with an ID that is absent from the available list.

- [ ] **Step 4: Run the focused state tests and verify they pass**

Run the same command. Expected: all state-resolution cases pass.

- [ ] **Step 5: Commit the state unit**

```text
git add packages/studio/src/pages/craft-navigation-state.ts packages/studio/src/pages/craft-navigation-state.test.ts
git commit -m "test(studio): define craft navigation state rules"
```

## Task 4: Update CraftManager navigation and persistence

**Files:**
- Modify: `packages/studio/src/pages/CraftManager.tsx`
- Modify: `packages/studio/src/pages/craft-profile-view.test.ts`

- [ ] **Step 1: Add failing component-model assertions**

Extend the existing detail-model tests or add pure exported view helpers so the test suite asserts that the three tab labels are always represented and that a recent craft row is marked selected. Keep API calls out of the pure helper tests.

- [ ] **Step 2: Run the focused Studio page tests and verify the new assertions fail**

```text
pnpm -C packages/studio exec vitest run src/pages/craft-navigation-state.test.ts src/pages/craft-profile-view.test.ts
```

Expected: the new navigation assertions fail against the conditional detail tab and non-highlighted list rows.

- [ ] **Step 3: Implement the UI behavior**

Change `CraftManager` as follows:

```tsx
interface CraftListResponse {
  readonly crafts: ReadonlyArray<CraftMeta>;
  readonly recentCraftId: string | null;
}

const [tab, setTab] = useState<CraftTab>("list");
const [selectedCraftId, setSelectedCraftId] = useState<string | null>(null);
const { data: craftsData, loading, refetch } = useApi<CraftListResponse>("/crafts");

useEffect(() => {
  if (loading || !craftsData) return;
  const initial = resolveInitialCraftState(
    craftsData.recentCraftId,
    craftsData.crafts.map((craft) => craft.id),
  );
  setSelectedCraftId(initial.selectedCraftId);
  setTab(initial.tab);
}, [craftsData, loading]);
```

Use `putApi("/crafts/recent", { craftId })` after a list selection and after a successful create. Render all three `TabButton`s unconditionally. The detail tab uses the selected ID and shows an empty state when it is null. Add a selected-row class based on `craft.id === selectedCraftId`; do not use positional selectors. After deletion, refetch the list, call `resolveAfterCraftDelete`, update the selected ID/tab, and clear the database when no ID remains. Preserve existing profile detail rendering and module localization.

- [ ] **Step 4: Run focused page tests and typecheck**

```text
pnpm -C packages/studio exec vitest run src/pages/craft-navigation-state.test.ts src/pages/craft-profile-view.test.ts
pnpm --filter @actalk/inkos-studio typecheck
```

Expected: all focused tests pass and both Studio TypeScript passes complete with exit code 0.

- [ ] **Step 5: Commit the UI unit**

```text
git add packages/studio/src/pages/CraftManager.tsx packages/studio/src/pages/craft-profile-view.test.ts
git commit -m "feat(studio): keep craft detail navigation available"
```

## Task 5: Full verification and runtime acceptance

**Files:**
- No source changes expected.

- [ ] **Step 1: Run the full relevant test suites**

```text
pnpm -C packages/studio exec vitest run src/api/studio-preferences-db.test.ts src/api/server.test.ts src/pages/craft-navigation-state.test.ts src/pages/craft-profile-view.test.ts
pnpm --filter @actalk/inkos-core build
pnpm --filter @actalk/inkos-core test -- --run
pnpm --filter @actalk/inkos-studio typecheck
git diff --check
```

Expected: all selected Studio tests, all core tests, the core build, and typecheck pass with exit code 0.

- [ ] **Step 2: Verify the browser workflow**

With Studio running on ports 4567/4569, verify:

1. Enter writing mode and confirm all three top tabs are visible.
2. Open a craft profile, refresh, and confirm detail remains selected.
3. Switch to another profile and confirm its row is highlighted and survives another refresh.
4. Delete the selected profile and confirm the newest remaining profile opens, or the list empty state appears when none remain.
5. Confirm the UI has no new browser console errors.

- [ ] **Step 3: Confirm repository state before finish**

```text
git status --short
git log --oneline -5
git worktree list
```

Expected: only intentional committed changes exist in the worktree; no generated `.inkos/studio.db` or Studio logs are tracked.

- [ ] **Step 4: Commit any final test-only adjustments**

```text
git add packages/studio/src packages/studio/vitest.config.ts
git commit -m "test(studio): verify persistent craft navigation"
```

Run this only if the preceding verification exposed a test adjustment that is required by the implementation; do not create an empty commit.

- [ ] **Step 5: Finish the worktree**

From the worktree run:

```text
node scripts/finish-worktree.mjs --base master
```

If Windows returns `EBUSY` while removing the worktree, verify the merge and push first from `D:\Github\storyos`, remove only `D:\Github\storyos\.worktrees\craft-navigation-persistence`, delete the merged branch, and run `git worktree prune`. Restart Studio after the merge and re-run the browser workflow against the main checkout.
