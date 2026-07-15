import { describe, expect, it } from "vitest";
import {
  deriveActiveBookId,
  deriveStartupGate,
  getAppPageLayoutClass,
  getRouteToolbarTitle,
  isBookCreateChatRoute,
  resolveActiveShortStoryId,
  resolveActiveStoryTitle,
  resolveActiveCraftTitle,
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

describe("getAppPageLayoutClass", () => {
  it("uses a wide work area for ordinary tool pages", () => {
    expect(getAppPageLayoutClass("services")).toContain("max-w-[1440px]");
    expect(getAppPageLayoutClass("dashboard")).toContain("max-w-[1440px]");
  });

  it("gives craft management an extra-wide work area", () => {
    expect(getAppPageLayoutClass("craft")).toContain("max-w-[1600px]");
  });
});

describe("getRouteToolbarTitle", () => {
  it("returns stable Chinese titles for primary pages", () => {
    expect(getRouteToolbarTitle({ page: "services" }, "zh")).toBe("模型配置");
    expect(getRouteToolbarTitle({ page: "craft" }, "zh")).toBe("写作模式");
    expect(getRouteToolbarTitle({ page: "import" }, "zh")).toBe("导入");
    expect(getRouteToolbarTitle({ page: "book", bookId: "book-1" }, "zh")).toBe("写作");
    expect(getRouteToolbarTitle({ page: "book-create" }, "zh")).toBe("长篇小说");
    expect(getRouteToolbarTitle({ page: "film-commentary" }, "zh")).toBe("影视解说");
    expect(getRouteToolbarTitle({ page: "chat" }, "zh", "short")).toBe("聊天");
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
    expect(getRouteToolbarTitle({ page: "chat" }, "en", "short")).toBe("Chat");
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
  it("does not resolve a short-story title on the chat route", () => {
    expect(resolveActiveStoryTitle({
      route: { page: "chat" },
      sessionKind: "short",
      activeShortStoryId: "short-1",
      books: [],
      shorts: [{ id: "short-1", title: "鬼吹灯" }],
    })).toBeUndefined();
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

  it("shows no content when the short-story surface has no current story", () => {
    expect(resolveActiveStoryTitle({
      route: { page: "short", shortId: "missing-short" },
      lang: "zh",
      books: [],
      shorts: [],
    })).toBe("无内容");

    expect(resolveActiveStoryTitle({
      route: { page: "short" },
      lang: "zh",
      books: [],
      shorts: [],
    })).toBeUndefined();
  });

  it("uses the active or first book for long-story pages only", () => {
    const books = [
      { id: "book-1", title: "第一本书" },
      { id: "book-2", title: "第二本书" },
    ];

    expect(resolveActiveStoryTitle({
      route: { page: "book-create" },
      activeBookId: "book-2",
      lang: "zh",
      books,
      shorts: [],
    })).toBe("第二本书");

    expect(resolveActiveStoryTitle({
      route: { page: "craft" },
      lang: "zh",
      books,
      shorts: [],
    })).toBe("无内容");
  });

  it("shows no content when long-story has no books", () => {
    expect(resolveActiveStoryTitle({
      route: { page: "book-create" },
      lang: "zh",
      books: [],
      shorts: [],
    })).toBe("无内容");

    expect(resolveActiveStoryTitle({
      route: { page: "craft" },
      lang: "en",
      books: [],
      shorts: [],
    })).toBe("No content");
  });
});

describe("resolveActiveCraftTitle", () => {
  it("uses the recent craft or first available craft and falls back to no content", () => {
    expect(resolveActiveCraftTitle({
      recentCraftId: "craft-2",
      crafts: [
        { id: "craft-1", sourceName: "第一个模式" },
        { id: "craft-2", sourceName: "当前模式" },
      ],
      lang: "zh",
    })).toBe("当前模式");

    expect(resolveActiveCraftTitle({
      recentCraftId: null,
      crafts: [{ id: "craft-1", sourceName: "第一个模式" }],
      lang: "zh",
    })).toBe("第一个模式");

    expect(resolveActiveCraftTitle({
      recentCraftId: null,
      crafts: [],
      lang: "zh",
    })).toBe("无内容");
  });
});

describe("resolveActiveShortStoryId", () => {
  const shorts = [
    { id: "short-1", title: "第一个故事" },
    { id: "short-2", title: "第二个故事" },
  ];

  it("uses the route selection only on a short-story route", () => {
    expect(resolveActiveShortStoryId({
      route: { page: "short", shortId: "short-2" },
      activeShortStoryId: "short-1",
      recentShortStoryId: "short-1",
      shorts,
    })).toBe("short-2");

    expect(resolveActiveShortStoryId({
      route: { page: "short" },
      activeShortStoryId: "short-2",
      recentShortStoryId: "short-1",
      shorts,
    })).toBe("short-1");
  });

  it("falls back to the recent available story, then the first story", () => {
    expect(resolveActiveShortStoryId({
      route: { page: "short" },
      recentShortStoryId: "short-2",
      shorts,
    })).toBe("short-2");

    expect(resolveActiveShortStoryId({
      route: { page: "short" },
      recentShortStoryId: "deleted-short",
      shorts,
    })).toBe("short-1");
  });

  it("does not select a short story outside a short-story surface", () => {
    expect(resolveActiveShortStoryId({
      route: { page: "chat" },
      sessionKind: "short",
      recentShortStoryId: "short-1",
      shorts,
    })).toBeNull();
  });
});

describe("deriveStartupGate", () => {
  it("shows startup errors instead of spinning forever before the project is ready", () => {
    expect(deriveStartupGate({ ready: false, projectError: null })).toBe("loading");
    expect(deriveStartupGate({ ready: false, projectError: "bad storyos.json" })).toBe("error");
    expect(deriveStartupGate({ ready: true, projectError: "later refetch failed" })).toBe("ready");
  });
});
