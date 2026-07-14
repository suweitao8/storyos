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
  it("builds story cards with summaries and word counts", () => {
    const onSelect = vi.fn();
    const records: ReadonlyArray<StoryListRecord> = [
      {
        id: "book-1",
        title: "Night Harbor",
        summary: "A ledger pulls a washed-up fixer back into an old case.",
        wordCount: 12345,
      },
    ];

    const items = buildStoryListItems("book", records, "book-1", onSelect);

    expect(items[0]).toMatchObject({
      id: "book-1",
      title: "Night Harbor",
      summary: "A ledger pulls a washed-up fixer back into an old case.",
      wordCountLabel: "12,345 字",
      active: true,
    });
    items[0]?.onSelect();
    expect(onSelect).toHaveBeenCalledWith("book-1");
  });

  it("uses a visible fallback when a story has no summary", () => {
    const item = buildStoryListItems("short", [
      { id: "short-1", title: "The Extra Floor", wordCount: 2400 },
    ], null, vi.fn())[0];

    expect(item).toMatchObject({
      summary: "暂无故事概述",
      wordCountLabel: "2,400 字",
    });
  });

  it("renders cards without an item count and exposes a top-right delete action", () => {
    const markup = renderToStaticMarkup(React.createElement(StoryListPanel, {
      kind: "book",
      records: [{
        id: "book-1",
        title: "Night Harbor",
        summary: "A concise story summary.",
        wordCount: 1200,
      }],
      activeId: "book-1",
      isZh: true,
      onSelect: vi.fn(),
      onDelete: vi.fn(),
    }));

    expect(markup).not.toContain("项");
    expect(markup).not.toMatch(/>\d+ items</);
    expect(markup).toContain("Night Harbor");
    expect(markup).toContain("A concise story summary.");
    expect(markup).toContain("1,200 字");
    expect(markup).toContain('aria-label="删除故事"');
  });

  it("keeps loading, error, empty, and ready states explicit", () => {
    expect(resolveStoryListStatus({ loading: true, error: null, records: [] })).toBe("loading");
    expect(resolveStoryListStatus({ loading: false, error: "network", records: [] })).toBe("error");
    expect(resolveStoryListStatus({ loading: false, error: null, records: [] })).toBe("empty");
    expect(resolveStoryListStatus({ loading: false, error: null, records: [{ id: "book-1", title: "Night Harbor" }] })).toBe("ready");
  });

  it("renders trash records as disabled items with a restore action", () => {
    const markup = renderToStaticMarkup(React.createElement(StoryListPanel, {
      kind: "book",
      records: [{
        id: "deleted-book",
        title: "Deleted book",
        deletedAt: "2026-07-10T00:00:00.000Z",
      }],
      isZh: true,
      onSelect: vi.fn(),
      onDelete: vi.fn(),
      onRestore: vi.fn(),
    }));

    expect(markup).toContain("垃圾桶");
    expect(markup).toContain("恢复");
    expect(markup).toContain("disabled");
  });
});
