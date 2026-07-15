import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SourceAlignmentPanel } from "./SourceAlignmentPanel.js";

describe("SourceAlignmentPanel", () => {
  it("shows the original-film label and disables confirmation for a low-confidence suggestion", () => {
    const html = renderToStaticMarkup(createElement(SourceAlignmentPanel, {
      craftId: "craft-1",
      source: {
        sourceType: "bilibili",
        sourceName: "电影解说",
        originalName: "BV1.mp4",
        importedAt: "2026-07-15T00:00:00.000Z",
        files: [{ key: "sourceVideo", fileName: "original-film.mp4", downloadName: "原片.mp4", size: 10, mimeType: "video/mp4" }],
      },
      initialData: {
        timeline: { version: 1, sourceFileKey: "sourceVideo", durationSeconds: 20, scenes: [{ id: "scene-1", startSeconds: 0, endSeconds: 10, thumbnailFile: "frames/scene-0001.jpg", visualSummary: "地下室入口" }] },
        anchors: [{ id: "anchor-1", commentaryStartSeconds: 0, commentaryEndSeconds: 4, text: "主角推门" }],
        matches: [{ id: "match-1", anchorId: "anchor-1", sceneId: "scene-1", sourceStartSeconds: 2, sourceEndSeconds: 7, confidence: 0.4, reason: "证据不足", status: "suggested" }],
      },
    }));
    expect(html).toContain("原片素材");
    expect(html).toContain("仅供建议");
    expect(html).toContain("disabled");
    expect(html).not.toContain("解说视频作为画面");
  });
});
