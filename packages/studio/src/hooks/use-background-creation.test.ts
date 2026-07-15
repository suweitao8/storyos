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
  it("extracts assets before it queues the background script that must reference them", async () => {
    let finishAssetExtraction: (() => void) | undefined;
    fetchJsonMock.mockImplementation((path: string) => {
      if (path.includes("/assets/extract")) {
        return new Promise<void>((resolve) => { finishAssetExtraction = resolve; });
      }
      return Promise.resolve({});
    });

    const postCreation = runPostCreationSteps("short", "cold-ledger");
    await Promise.resolve();

    expect(fetchJsonMock).toHaveBeenCalledWith(
      "/stories/short/cold-ledger/assets/extract",
      { method: "POST" },
    );
    expect(fetchJsonMock).not.toHaveBeenCalledWith(
      "/shorts/cold-ledger/production/script?background=true",
      { method: "POST" },
    );

    finishAssetExtraction?.();
    await postCreation;

    expect(fetchJsonMock).toHaveBeenCalledWith(
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
