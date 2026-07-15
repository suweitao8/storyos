import { describe, expect, it } from "vitest";

import {
  buildStoryAssetExtractionPath,
  latestShortStoryId,
  resolveChatPageSessionKind,
  resolveChatPageStoryWorkspace,
} from "./ChatPage";

describe("ChatPage story workspace integration", () => {
  it("keeps project chat as chat even if an old active session is short", () => {
    expect(resolveChatPageSessionKind({
      mode: "project-chat",
      activeSessionKind: "short",
      activeBookId: undefined,
    })).toBe("chat");
  });

  it("finds the latest created short story id from tool execution details", () => {
    expect(latestShortStoryId([
      { toolExecutions: [{ details: { kind: "short_fiction_created", storyId: "old" } }] },
      { toolExecutions: [{ details: { kind: "short_fiction_created", storyId: "latest" } }] },
    ])).toBe("latest");
    expect(latestShortStoryId([])).toBeNull();
  });

  it("builds the canonical text asset extraction endpoint", () => {
    expect(buildStoryAssetExtractionPath("book", "night harbor")).toBe(
      "/stories/book/night%20harbor/assets/extract",
    );
    expect(buildStoryAssetExtractionPath("short", "short/42")).toBe(
      "/stories/short/short%2F42/assets/extract",
    );
  });

  it("keeps creation visible until a long-story book id is handed off", () => {
    expect(resolveChatPageStoryWorkspace({
      sessionKind: "book-create",
      stage: "settings",
      bookId: null,
      shortId: null,
    })).toMatchObject({
      view: "creation",
      activeStage: "create",
      kind: "book",
      storyId: null,
    });

    expect(resolveChatPageStoryWorkspace({
      sessionKind: "book-create",
      stage: "settings",
      bookId: "night-harbor",
      shortId: null,
    })).toMatchObject({
      view: "settings",
      activeStage: "settings",
      kind: "book",
      storyId: "night-harbor",
    });

    expect(resolveChatPageStoryWorkspace({
      sessionKind: "book-create",
      stage: "list",
      bookId: null,
      shortId: null,
    })).toMatchObject({
      view: "list",
      activeStage: "list",
      kind: "book",
      storyId: null,
    });
  });

  it("routes short-story ids through assets and keeps invalid stages on settings", () => {
    expect(resolveChatPageStoryWorkspace({
      sessionKind: "short",
      stage: "assets",
      bookId: null,
      shortId: "short-42",
    })).toMatchObject({
      view: "assets",
      activeStage: "assets",
      kind: "short",
      storyId: "short-42",
    });

    expect(resolveChatPageStoryWorkspace({
      sessionKind: "short",
      stage: "not-a-stage",
      bookId: null,
      shortId: "short-42",
    })).toMatchObject({
      view: "settings",
      activeStage: "settings",
      kind: "short",
      storyId: "short-42",
    });
  });

  it("opens the shared creation tab for both existing long and short stories", () => {
    expect(resolveChatPageStoryWorkspace({
      sessionKind: "book",
      stage: "create",
      bookId: "long-1",
      shortId: null,
    })).toMatchObject({
      view: "creation",
      activeStage: "create",
      kind: "book",
      storyId: "long-1",
    });

    expect(resolveChatPageStoryWorkspace({
      sessionKind: "short",
      stage: "create",
      bookId: null,
      shortId: "short-1",
    })).toMatchObject({
      view: "creation",
      activeStage: "create",
      kind: "short",
      storyId: "short-1",
    });
  });

  it("keeps non-story sessions in the existing full-width chat view", () => {
    expect(resolveChatPageStoryWorkspace({
      sessionKind: "chat",
      stage: "assets",
      bookId: null,
      shortId: null,
    })).toMatchObject({
      view: "adjust",
      activeStage: "adjust",
      kind: null,
      storyId: null,
    });
  });
});
