import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  buildStoryListItems,
  resolveStoryListStatus,
  StoryListPanel,
  type StoryListRecord,
} from "./StoryListPanel";

describe("StoryListPanel model", () => {
  it("normalizes long stories and highlights the current item", () => {
    const onSelect = vi.fn();
    const records: ReadonlyArray<StoryListRecord> = [
      { id: "book-1", title: "夜港账本", genre: "悬疑", status: "writing", chaptersWritten: 3 },
      { id: "book-2", title: "雾中车站", genre: "奇幻", status: "draft", chaptersWritten: 0 },
    ];

    const items = buildStoryListItems("book", records, "book-1", onSelect);

    expect(items.map(({ id, title, meta, active }) => ({ id, title, meta, active }))).toEqual([
      { id: "book-1", title: "夜港账本", meta: "3 章", active: true },
      { id: "book-2", title: "雾中车站", meta: "0 章", active: false },
    ]);
    items[0].onSelect();
    expect(onSelect).toHaveBeenCalledWith("book-1");
  });

  it("normalizes short stories and writing modes with their own metadata", () => {
    const onSelect = vi.fn();
    expect(buildStoryListItems("short", [
      { id: "short-1", title: "凌晨来电", status: "ready", chaptersWritten: 1, wordCount: 2400 },
    ], null, onSelect)[0]).toMatchObject({
      id: "short-1",
      title: "凌晨来电",
      meta: "2,400 字",
      active: false,
    });
    expect(buildStoryListItems("craft", [
      { id: "craft-1", sourceName: "悬疑节奏", mode: "general" },
    ], "craft-1", onSelect)[0]).toMatchObject({
      id: "craft-1",
      title: "悬疑节奏",
      meta: "通用",
      active: true,
    });
  });

  it("keeps loading, error, empty, and ready states explicit", () => {
    expect(resolveStoryListStatus({ loading: true, error: null, records: [] })).toBe("loading");
    expect(resolveStoryListStatus({ loading: false, error: "network", records: [] })).toBe("error");
    expect(resolveStoryListStatus({ loading: false, error: null, records: [] })).toBe("empty");
    expect(resolveStoryListStatus({ loading: false, error: null, records: [{ id: "book-1", title: "夜港账本" }] })).toBe("ready");
  });

  it("does not repeat the page title inside the story list", () => {
    const markup = renderToStaticMarkup(React.createElement(StoryListPanel, {
      kind: "book",
      records: [{ id: "book-1", title: "夜港账本", chaptersWritten: 3 }],
      activeId: "book-1",
      isZh: true,
      onSelect: vi.fn(),
    }));

    expect(markup).not.toContain("选择内容");
    expect(markup).not.toContain("长篇故事");
    expect(markup).toContain("1 项");
    expect(markup).toContain("夜港账本");
  });
});
