import { describe, expect, it } from "vitest";

import {
  resolveAfterCraftDelete,
  resolveInitialCraftState,
} from "./craft-navigation-state";

describe("resolveInitialCraftState", () => {
  it("restores a recent craft when it is still available", () => {
    expect(resolveInitialCraftState("craft-2", ["craft-1", "craft-2"])).toEqual({
      tab: "detail",
      selectedCraftId: "craft-2",
    });
  });

  it("falls back to the list when the recent craft is unavailable", () => {
    expect(resolveInitialCraftState("deleted-craft", ["craft-1", "craft-2"])).toEqual({
      tab: "list",
      selectedCraftId: null,
    });
  });

  it("falls back to the list when there is no recent craft or available craft", () => {
    expect(resolveInitialCraftState(null, [])).toEqual({
      tab: "list",
      selectedCraftId: null,
    });
  });
});

describe("resolveAfterCraftDelete", () => {
  it("selects the last remaining craft after deletion", () => {
    expect(resolveAfterCraftDelete("craft-2", ["craft-1", "craft-3"])).toEqual({
      tab: "detail",
      selectedCraftId: "craft-3",
    });
  });

  it("returns to the list after deleting the last craft", () => {
    expect(resolveAfterCraftDelete("craft-1", [])).toEqual({
      tab: "list",
      selectedCraftId: null,
    });
  });
});
