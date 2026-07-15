import { describe, expect, it, vi } from "vitest";

const { fetchJsonMock } = vi.hoisted(() => ({
  fetchJsonMock: vi.fn(),
}));

vi.mock("./use-api", () => ({
  fetchJson: fetchJsonMock,
  invalidateApiPaths: vi.fn(),
}));

vi.mock("./use-sse", () => ({
  useNewSSEMessages: vi.fn(),
}));

import { productionTaskInvalidationPaths, runPostCreationSteps } from "./use-background-creation";

describe("runPostCreationSteps", () => {
  it("starts one server-owned post-creation chain and does not let the browser sequence stages", async () => {
    fetchJsonMock.mockResolvedValue({ task: { status: "running" } });

    await runPostCreationSteps("short", "cold-ledger");

    expect(fetchJsonMock).toHaveBeenCalledWith(
      "/stories/short/cold-ledger/assets/extract?background=true",
      { method: "POST" },
    );
    expect(fetchJsonMock).not.toHaveBeenCalledWith(
      "/shorts/cold-ledger/production/script?background=true",
      { method: "POST" },
    );
  });

  it("invalidates the exact open panel when a background production task finishes", () => {
    expect(productionTaskInvalidationPaths({
      kind: "script",
      storyId: "cold-ledger",
      storyKind: "short",
    })).toEqual(["/api/v1/shorts/cold-ledger/production"]);

    expect(productionTaskInvalidationPaths({
      kind: "asset-extract",
      storyId: "night harbor",
      storyKind: "book",
    })).toEqual(["/api/v1/stories/book/night%20harbor/assets"]);
  });
});
