import { describe, expect, it } from "vitest";
import { deriveActiveBookId, deriveStartupGate, getRouteToolbarTitle, isBookCreateChatRoute } from "./App";

describe("deriveActiveBookId", () => {
  it("returns the current book across book-centered routes", () => {
    expect(deriveActiveBookId({ page: "book", bookId: "alpha" })).toBe("alpha");
    expect(deriveActiveBookId({ page: "chapter", bookId: "beta", chapterNumber: 3 })).toBe("beta");
    expect(deriveActiveBookId({ page: "truth", bookId: "gamma" })).toBe("gamma");
    expect(deriveActiveBookId({ page: "analytics", bookId: "delta" })).toBe("delta");
    expect(deriveActiveBookId({ page: "book-settings", bookId: "epsilon" })).toBe("epsilon");
  });

  it("returns undefined for non-book routes", () => {
    expect(deriveActiveBookId({ page: "dashboard" })).toBeUndefined();
    expect(deriveActiveBookId({ page: "services" })).toBeUndefined();
    expect(deriveActiveBookId({ page: "craft" })).toBeUndefined();
  });
});

describe("isBookCreateChatRoute", () => {
  it("routes new-book creation through chat instead of the standalone form page", () => {
    expect(isBookCreateChatRoute({ page: "book-create" })).toBe(true);
    expect(isBookCreateChatRoute({ page: "book", bookId: "alpha" })).toBe(false);
  });
});

describe("getRouteToolbarTitle", () => {
  it("returns stable Chinese titles for primary pages", () => {
    expect(getRouteToolbarTitle({ page: "services" }, "zh")).toBe("模型配置");
    expect(getRouteToolbarTitle({ page: "craft" }, "zh")).toBe("写作模式");
    expect(getRouteToolbarTitle({ page: "import" }, "zh")).toBe("导入");
    expect(getRouteToolbarTitle({ page: "book", bookId: "book-1" }, "zh")).toBe("写作");
  });

  it("returns English titles without embedding route identifiers", () => {
    expect(getRouteToolbarTitle({ page: "project-settings" }, "en")).toBe("Settings");
    expect(getRouteToolbarTitle({ page: "service-detail", serviceId: "xfyun" }, "en")).toBe("Service Configuration");
    expect(getRouteToolbarTitle({ page: "chapter", bookId: "book-1", chapterNumber: 4 }, "en")).toBe("Chapter Reader");
  });
});

describe("deriveStartupGate", () => {
  it("shows startup errors instead of spinning forever before the project is ready", () => {
    expect(deriveStartupGate({ ready: false, projectError: null })).toBe("loading");
    expect(deriveStartupGate({ ready: false, projectError: "bad inkos.json" })).toBe("error");
    expect(deriveStartupGate({ ready: true, projectError: "later refetch failed" })).toBe("ready");
  });
});
