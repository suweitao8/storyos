import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StorySeedPreview } from "./StorySeedPreview";

describe("StorySeedPreview", () => {
  it("renders the original model output as read-only content after generation", () => {
    const html = renderToStaticMarkup(createElement(StorySeedPreview, {
      streamedContent: "## 故事名称\n\n回声井",
      status: "ready",
      isZh: true,
    }));

    expect(html).toContain("回声井");
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain("<input");
    expect(html).toContain("## 故事名称");
    expect(html).toContain("已生成，确认后创建");
  });

  it("keeps the live markdown visible while generation is in progress", () => {
    const html = renderToStaticMarkup(createElement(StorySeedPreview, {
      streamedContent: "## 故事名称\n\n正在生成",
      status: "generating",
      isZh: true,
    }));

    expect(html).toContain("正在生成");
    expect(html).toContain("正在生成完整故事设定");
  });
});
