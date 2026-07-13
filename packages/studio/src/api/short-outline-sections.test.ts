import { describe, expect, it } from "vitest";

import { splitShortOutlineSections } from "./short-outline-sections";

describe("splitShortOutlineSections", () => {
  it("splits a generated outline into displayable sections and removes wrapper markers", () => {
    const sections = splitShortOutlineSections(
      `=== SHORT_FICTION_PLAN_TITLE ===

《夜班电梯守则》

=== SHORT_FICTION_PLAN ===

## 题材/受众

都市灵异悬疑

## 人物与关系

陈默与老周

## 反转链

| 节点 | 内容 |
| --- | --- |
| 一 | 技术故障转为人为隐瞒 |`,
      "outline/v001.md",
    );

    expect(sections).toEqual([
      expect.objectContaining({ title: "题材/受众", content: "都市灵异悬疑" }),
      expect.objectContaining({ title: "人物与关系", content: "陈默与老周" }),
      expect.objectContaining({ title: "反转链", content: expect.stringContaining("| 一 |") }),
    ]);
    expect(sections.every((section) => section.file.startsWith("outline/v001.md#section-"))).toBe(true);
    expect(sections.map((section) => section.file)).toHaveLength(3);
  });

  it("keeps legacy outline content as one section when no level-two headings exist", () => {
    expect(splitShortOutlineSections("旧版故事提纲", "outline/v001.md")).toEqual([
      { file: "outline/v001.md", title: "故事提纲", content: "旧版故事提纲" },
    ]);
  });
});
