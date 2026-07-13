import { describe, expect, it } from "vitest";
import {
  deriveActiveBookId,
  deriveStartupGate,
  getRouteToolbarTitle,
  isBookCreateChatRoute,
  resolveActiveStoryTitle,
} from "./App";

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
    expect(getRouteToolbarTitle({ page: "book-create" }, "zh")).toBe("长篇故事");
    expect(getRouteToolbarTitle({ page: "chat" }, "zh", "short")).toBe("短篇故事");
    expect(getRouteToolbarTitle({ page: "chat" }, "zh", "chat")).toBe("聊天");
  });

  it("keeps the page title independent from the active story title", () => {
    expect(getRouteToolbarTitle({ page: "short", shortId: "short-1" }, "zh")).toBe("短篇故事");
    expect(getRouteToolbarTitle({ page: "book", bookId: "book-1" }, "zh")).toBe("写作");
  });

  it("returns English titles without embedding route identifiers", () => {
    expect(getRouteToolbarTitle({ page: "project-settings" }, "en")).toBe("Settings");
    expect(getRouteToolbarTitle({ page: "service-detail", serviceId: "xfyun" }, "en")).toBe("Service Configuration");
    expect(getRouteToolbarTitle({ page: "chapter", bookId: "book-1", chapterNumber: 4 }, "en")).toBe("Chapter Reader");
    expect(getRouteToolbarTitle({ page: "book-create" }, "en")).toBe("Long Novel");
    expect(getRouteToolbarTitle({ page: "chat" }, "en", "short")).toBe("Short Story");
  });

  it("keeps a title for every supported page route", () => {
    const routes = [
      { page: "dashboard" },
      { page: "chat" },
      { page: "book", bookId: "book-1" },
      { page: "book-settings", bookId: "book-1" },
      { page: "book-create" },
      { page: "services" },
      { page: "project-settings" },
      { page: "service-detail", serviceId: "xfyun" },
      { page: "chapter", bookId: "book-1", chapterNumber: 1 },
      { page: "analytics", bookId: "book-1" },
      { page: "truth", bookId: "book-1" },
      { page: "daemon" },
      { page: "logs" },
      { page: "genres" },
      { page: "craft" },
      { page: "import" },
      { page: "radar" },
      { page: "doctor" },
      { page: "play", projectId: "play-1" },
      { page: "film", projectId: "film-1" },
      { page: "flow", projectId: "flow-1" },
      { page: "film-author", projectId: "film-1" },
      { page: "film-studio", projectId: "film-1" },
    ] as const;

    for (const route of routes) {
      expect(getRouteToolbarTitle(route, "zh").trim()).not.toBe("");
      expect(getRouteToolbarTitle(route, "en").trim()).not.toBe("");
    }
  });
});

describe("resolveActiveStoryTitle", () => {
  it("resolves the active short story title on the shared chat route", () => {
    expect(resolveActiveStoryTitle({
      route: { page: "chat" },
      sessionKind: "short",
      activeShortStoryId: "short-1",
      books: [],
      shorts: [{ id: "short-1", title: "鬼吹灯" }],
    })).toBe("鬼吹灯");
  });

  it("does not show a short story title for a normal chat session", () => {
    expect(resolveActiveStoryTitle({
      route: { page: "chat" },
      sessionKind: "chat",
      activeShortStoryId: "short-1",
      books: [],
      shorts: [{ id: "short-1", title: "鬼吹灯" }],
    })).toBeUndefined();
  });
});

describe("deriveStartupGate", () => {
  it("shows startup errors instead of spinning forever before the project is ready", () => {
    expect(deriveStartupGate({ ready: false, projectError: null })).toBe("loading");
    expect(deriveStartupGate({ ready: false, projectError: "bad inkos.json" })).toBe("error");
    expect(deriveStartupGate({ ready: true, projectError: "later refetch failed" })).toBe("ready");
  });
});
