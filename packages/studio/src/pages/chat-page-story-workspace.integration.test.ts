import { describe, expect, it } from "vitest";

import { resolveChatPageStoryWorkspace } from "./ChatPage";

describe("ChatPage story workspace integration", () => {
  it("keeps creation visible until a long-story book id is handed off", () => {
    expect(resolveChatPageStoryWorkspace({
      sessionKind: "book-create",
      stage: "settings",
      bookId: null,
      shortId: null,
    })).toMatchObject({
      view: "creation",
      activeStage: "settings",
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
