# Model Config Minimal Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `storyos` 的模型配置收敛成一个统一的极简面板，只保留当前可用模型、掩码 API Key、测试连接和自动保存，并尽量复用旧项目 `animcg` 的 provider-card 交互与旧配置迁移能力。

**Architecture:** 前端把文本、图片、语音三类服务都收敛为同一种“服务卡片”交互，卡片状态只关心当前模型、API Key 可见性、保存状态和测试结果。后端继续负责读写 secrets 和配置，但在加载路径上补上一次旧格式迁移，确保老的 `llm.provider/model/apiKey` 以及现有 secrets 能自动进入当前运行时；UI 不再暴露温度、协议、stream 之类的高级项。

**Tech Stack:** TypeScript, React, Vitest, Hono, existing `@actalk/inkos-core` config loader and secrets helpers.

---

## File Structure

- `packages/core/src/llm/config-migration.ts`: 保持旧 LLM 配置迁移逻辑可复用，旧格式 `llm.provider/model/baseUrl/apiKey` 进入当前 `secrets.json`。
- `packages/core/src/utils/config-loader.ts`: 在 Studio 读取项目配置前触发迁移，保证老项目配置先被归一化。
- `packages/core/src/__tests__/config-migration.test.ts`: 覆盖旧格式到新格式的迁移断言。
- `packages/core/src/__tests__/config-loader.test.ts`: 覆盖 `loadProjectConfig()` 会先迁移再读取的行为。
- `packages/studio/src/pages/service-config-card-state.ts`: 提取卡片级状态工具，集中处理单模型选择、掩码 key 状态、自动保存 snapshot 和测试请求 payload。
- `packages/studio/src/components/ServiceConfigCard.tsx`: 复用的服务卡片 UI，负责渲染模型下拉、API Key 掩码切换、编辑、测试按钮和状态提示。
- `packages/studio/src/pages/ServiceListPage.tsx`: 让 cover / voice 改用统一卡片，移除页面级多余说明和重复状态逻辑。
- `packages/studio/src/pages/ServiceDetailPage.tsx`: 把文本服务详情页收敛到同样的卡片模式，移除手动保存和非必要高级控件。
- `packages/studio/src/pages/service-detail-state.ts`: 保留保存/测试的底层接口，但把 payload 收敛到统一卡片协议。
- `packages/studio/src/pages/service-config-card-state.test.ts`: 新增卡片状态单测。
- `packages/studio/src/pages/service-detail-state.test.ts`: 更新文本服务保存/测试断言。
- `packages/studio/src/api/server.test.ts`: 更新 cover / voice / service 相关接口断言，确保返回的配置形状和 key 读写符合新卡片。

### Task 1: Make config migration run before Studio consumes project config

**Files:**
- Modify: `packages/core/src/utils/config-loader.ts`
- Modify: `packages/core/src/llm/config-migration.ts`
- Test: `packages/core/src/__tests__/config-loader.test.ts`
- Test: `packages/core/src/__tests__/config-migration.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("migrates old llm.provider/model/apiKey into secrets before Studio loads config", async () => {
  await writeFile(join(root, "inkos.json"), JSON.stringify({
    llm: {
      provider: "openai",
      model: "gpt-4o",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-old",
    },
  }), "utf-8");

  const config = await loadProjectConfig(root, { consumer: "studio" });

  expect(config.llm).toMatchObject({
    services: [{ service: "openai" }],
    defaultModel: "gpt-4o",
  });

  const secrets = await loadSecrets(root);
  expect(secrets.services.openai).toEqual({ apiKey: "sk-old" });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @actalk/inkos-core vitest run src/__tests__/config-loader.test.ts src/__tests__/config-migration.test.ts -t "migrates old llm.provider/model/apiKey into secrets before Studio loads config"`

Expected: fail because the loader path does not yet guarantee the migration runs before config is consumed.

- [ ] **Step 3: Write the minimal implementation**

Add the migration call in `packages/core/src/utils/config-loader.ts` so Studio reads always pass through `migrateConfig(projectRoot)` first, then keep the existing `loadProjectConfig()` behavior unchanged for already-migrated configs.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @actalk/inkos-core vitest run src/__tests__/config-loader.test.ts src/__tests__/config-migration.test.ts`

Expected: pass with the old-format config migrating once and remaining idempotent on the second load.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/utils/config-loader.ts packages/core/src/llm/config-migration.ts packages/core/src/__tests__/config-loader.test.ts packages/core/src/__tests__/config-migration.test.ts
git commit -m "feat(core): migrate legacy llm config on load"
```

### Task 2: Extract a shared service-card state layer and UI shell

**Files:**
- Create: `packages/studio/src/pages/service-config-card-state.ts`
- Create: `packages/studio/src/components/ServiceConfigCard.tsx`
- Test: `packages/studio/src/pages/service-config-card-state.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("resolves a single available model and keeps the only choice selected", () => {
  expect(resolveSingleModel(
    { defaultModel: "Kimi K2.6", models: ["Kimi K2.6"] },
    "",
    "gpt-image-2",
  )).toBe("Kimi K2.6");
});

it("treats a masked key snapshot as unchanged until the user types a new key", () => {
  expect(buildSecretSnapshot({
    service: "kkaiapi",
    model: "gpt-image-2",
    apiKey: "********",
  })).not.toBe(buildSecretSnapshot({
    service: "kkaiapi",
    model: "gpt-image-2",
    apiKey: "sk-new",
  }));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @actalk/inkos-studio vitest run src/pages/service-config-card-state.test.ts`

Expected: fail because the shared helper file does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

Implement `resolveSingleModel()`, `buildSecretSnapshot()`, and the small request/response helpers in `packages/studio/src/pages/service-config-card-state.ts`, then render them through `ServiceConfigCard.tsx` with only these controls: current model, API Key, show/hide, edit, test connection, and autosave status.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @actalk/inkos-studio vitest run src/pages/service-config-card-state.test.ts`

Expected: pass, and the helper should be reusable from both the list page and the detail page.

- [ ] **Step 5: Commit**

```bash
git add packages/studio/src/pages/service-config-card-state.ts packages/studio/src/components/ServiceConfigCard.tsx packages/studio/src/pages/service-config-card-state.test.ts
git commit -m "feat(studio): add shared model config card state"
```

### Task 3: Rebuild the cover and voice settings around the shared card

**Files:**
- Modify: `packages/studio/src/pages/ServiceListPage.tsx`
- Modify: `packages/studio/src/api/server.ts`
- Test: `packages/studio/src/api/server.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("returns one usable model per cover service and preserves the saved apiKey", async () => {
  loadSecretsMock.mockResolvedValue({
    services: {
      "cover:grsai": { apiKey: "sk-cover" },
      "voice:bailian": { apiKey: "sk-voice" },
    },
  });

  const cover = await app.request("http://localhost/api/v1/cover/config");
  const voice = await app.request("http://localhost/api/v1/voice/config");

  const coverBody = await cover.json() as { service?: string; providers?: Array<{ models?: string[] }> };
  const voiceBody = await voice.json() as { service?: string; providers?: Array<{ models?: string[] }> };

  expect(coverBody).toMatchObject({
    service: "grsai",
    providers: expect.any(Array),
  });
  expect(coverBody.providers?.every((provider) => (provider.models?.length ?? 0) === 1)).toBe(true);
  expect(voiceBody).toMatchObject({
    service: "bailian",
    providers: expect.any(Array),
  });
  expect(voiceBody.providers?.every((provider) => (provider.models?.length ?? 0) === 1)).toBe(true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @actalk/inkos-studio vitest run src/api/server.test.ts -t "returns one usable model per cover service and preserves the saved apiKey"`

Expected: fail until the UI and payload shape are aligned with the single-model card contract and every provider collapses to one practical model.

- [ ] **Step 3: Write the minimal implementation**

Refactor `ServiceListPage.tsx` so the cover and voice sections are thin wrappers around `ServiceConfigCard`, keep only the current model for each service, default to the one returned by the backend, and remove the page-level “模型配置” title plus any extra controls not needed for key/model/test. Update `server.ts` only as needed to keep the cover and voice config payloads consistent with the new card contract.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @actalk/inkos-studio vitest run src/api/server.test.ts -t "cover config|voice config"`

Expected: pass, with the endpoints still round-tripping the saved secrets and only one practical model per service.

- [ ] **Step 5: Commit**

```bash
git add packages/studio/src/pages/ServiceListPage.tsx packages/studio/src/api/server.ts packages/studio/src/api/server.test.ts
git commit -m "feat(studio): simplify cover and voice model cards"
```

### Task 4: Simplify the text-service detail page to the same card contract

**Files:**
- Modify: `packages/studio/src/pages/ServiceDetailPage.tsx`
- Modify: `packages/studio/src/pages/service-detail-state.ts`
- Modify: `packages/studio/src/pages/service-detail-state.test.ts`
- Modify: `packages/studio/src/lib/error-copy.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("auto-saves the selected model and apiKey without exposing advanced controls", async () => {
   const result = await saveServiceConfig({
    effectiveServiceId: "openai",
    serviceId: "openai",
    isCustom: false,
    resolvedCustomName: "",
    apiKey: "sk-live",
    baseUrl: "",
    apiFormat: "chat",
    stream: true,
    temperature: "0.7",
    detectedModel: "gpt-4o",
    fetchJsonImpl: fetchJsonImpl as never,
  });

  expect(fetchJsonImpl).toHaveBeenCalledWith("/services/openai/secret", expect.any(Object));
  expect(fetchJsonImpl).toHaveBeenCalledWith("/services/config", expect.any(Object));
  expect(result.status.state).toBe("connected");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @actalk/inkos-studio vitest run src/pages/service-detail-state.test.ts -t "auto-saves the selected model and apiKey without exposing advanced controls"`

Expected: fail while the page still exposes the old manual-save / advanced-config workflow.

- [ ] **Step 3: Write the minimal implementation**

Strip `ServiceDetailPage.tsx` down to the same model card contract used by the list page: keep the current model selector, mask-and-edit API Key, test connection, and autosave; hide the manual save button and the advanced transport controls from the visible UI. In `service-detail-state.ts`, keep the persistence path compatible with the existing backend but remove any UI-facing assumptions that require users to edit temperature, stream, or protocol fields. Update `error-copy.ts` only if the page still references the old “模型配置” wording in user-facing errors.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @actalk/inkos-studio vitest run src/pages/service-detail-state.test.ts`

Expected: pass, and the page should render only the minimal controls required by the spec.

- [ ] **Step 5: Commit**

```bash
git add packages/studio/src/pages/ServiceDetailPage.tsx packages/studio/src/pages/service-detail-state.ts packages/studio/src/pages/service-detail-state.test.ts packages/studio/src/lib/error-copy.ts
git commit -m "feat(studio): align text config page with minimal card"
```

### Task 5: Verify the end-to-end UI and clean up the development branch

**Files:**
- Review: `packages/studio/src/App.tsx`
- Review: `packages/studio/src/hooks/use-i18n.ts`
- Review: `packages/studio/src/components/ServiceConfigCard.tsx`
- Review: `packages/studio/src/pages/ServiceListPage.tsx`
- Review: `packages/studio/src/pages/ServiceDetailPage.tsx`

- [ ] **Step 1: Run the targeted verification commands**

Run:

```bash
pnpm --filter @actalk/inkos-studio vitest run src/pages/service-config-card-state.test.ts src/pages/service-detail-state.test.ts src/api/server.test.ts
```

Run:

```bash
pnpm --filter @actalk/inkos-studio exec tsc --noEmit src/pages/ServiceListPage.tsx src/pages/ServiceDetailPage.tsx src/components/ServiceConfigCard.tsx
```

Expected: all targeted tests pass and the modified pages typecheck.

- [ ] **Step 2: Verify in the browser**

Open `http://127.0.0.1:4567/#/settings` and confirm:

- The panel no longer shows an extra “模型配置” title block.
- Each service only exposes one current model.
- API Key opens masked by default and can be revealed and edited.
- The test connection button still works.
- Autosave updates the card state without a manual save click.

- [ ] **Step 3: Commit the final branch state and remove the isolation worktree if one was used**

```bash
git add -A
git commit -m "feat(studio): ship minimal model config cards"
```

If the work was done in an isolated worktree, merge it back to `master`/main, push the branch, and delete the worktree after the merge is confirmed.
