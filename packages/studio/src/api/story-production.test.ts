import { describe, expect, it } from "vitest";

import {
  buildSubtitleEntries,
  parseUnifiedScript,
} from "./story-production";
import { buildBookSourceFallbackText, buildAssetsContext } from "./routes/story-production";

describe("unified story production", () => {
  it("can use book settings as script source before chapters exist", () => {
    const source = buildBookSourceFallbackText([
      { title: "故事设定", content: "旧港每晚都会少一个住户。" },
      { title: "故事大纲", content: "主角追查消失的门牌。" },
    ]);
    expect(source).toContain("旧港每晚都会少一个住户。\n\n故事大纲");
    expect(source).toContain("主角追查消失的门牌。");
  });
  it("parses shots embedded in the script", () => {
    const result = parseUnifiedScript(`# 夜班电梯

## 第一场：电梯门口

### 镜头 1
- 画面：老旧电梯停在十三层。
- 台词：旁白：凌晨两点，电梯自己亮了。
- 时长：4秒
- 图像提示词：老旧居民楼电梯，冷色灯光

### 镜头 2
- 字幕：门缝里伸出一只手。
- 时长：3秒`);

    expect(result.title).toBe("夜班电梯");
    expect(result.shots).toHaveLength(2);
    expect(result.shots[0]).toMatchObject({
      scene: "第一场：电梯门口",
      subtitle: "旁白：凌晨两点，电梯自己亮了。",
      durationMs: 4000,
      visual: "老旧电梯停在十三层。",
    });
    expect(result.shots[1]?.subtitle).toBe("门缝里伸出一只手。");
  });

  it("builds timed subtitle entries with stable minimum durations", () => {
    const entries = buildSubtitleEntries([
      { number: 1, scene: "场景", visual: "画面", subtitle: "短句", durationMs: 0 },
      { number: 2, scene: "场景", visual: "画面", subtitle: "第二句", durationMs: 2000 },
    ]);

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ startTimeMs: 0, endTimeMs: 1000, text: "短句" });
    expect(entries[1]).toMatchObject({ startTimeMs: 1200, endTimeMs: 3200, text: "第二句" });
  });

  it("treats 字幕/旁白/台词/对白 as the same narration field", () => {
    const result = parseUnifiedScript(`# 旁白测试

## 场景一

### 镜头 1
- 画面：走廊尽头。
- 旁白：他朝着光走去。

### 镜头 2
- 画面：推开门。
- 字幕：门外是另一片天地。

### 镜头 3
- 画面：他回头看。
- 台词：一切都回不去了。`);

    expect(result.shots).toHaveLength(3);
    // 旁白、字幕、台词都应归入同一个 subtitle 字段
    expect(result.shots[0]?.subtitle).toBe("他朝着光走去。");
    expect(result.shots[1]?.subtitle).toBe("门外是另一片天地。");
    expect(result.shots[2]?.subtitle).toBe("一切都回不去了。");
  });
});

describe("buildAssetsContext", () => {
  it("formats characters, scenes and props into markdown grouped by kind", () => {
    const markdown = buildAssetsContext([
      {
        id: "char-1", kind: "character", name: "林小雨",
        aliases: ["小雨"], summary: "20岁的女大学生，性格内向",
        details: { 外貌: "黑色长发，穿白色连衣裙" },
        imagePrompt: "young woman, black long hair, white dress",
        sourceRefs: [], image: { status: "missing" },
        createdAt: "", updatedAt: "",
      },
      {
        id: "scene-1", kind: "scene", name: "老旧电梯",
        summary: "十三层的废弃居民楼电梯，灯光昏暗",
        details: {}, imagePrompt: "old elevator, dim light",
        sourceRefs: [], image: { status: "missing" },
        createdAt: "", updatedAt: "",
      },
      {
        id: "prop-1", kind: "prop", name: "红色信封",
        summary: "引发整个故事的关键道具",
        details: {}, imagePrompt: "red envelope",
        sourceRefs: [], image: { status: "missing" },
        createdAt: "", updatedAt: "",
      },
    ]);

    // 三个分组都在
    expect(markdown).toContain("### 角色");
    expect(markdown).toContain("### 场景");
    expect(markdown).toContain("### 道具");
    // 角色名、别名、摘要、详情、视觉参考都在
    expect(markdown).toContain("林小雨");
    expect(markdown).toContain("别名：小雨");
    expect(markdown).toContain("20岁的女大学生");
    expect(markdown).toContain("外貌：黑色长发");
    expect(markdown).toContain("young woman");
    // 场景和道具内容在
    expect(markdown).toContain("老旧电梯");
    expect(markdown).toContain("红色信封");
    // 必须包含引用指令
    expect(markdown).toContain("必须引用这些资产");
    expect(markdown).toContain("【资产名】");
  });

  it("returns empty string when no assets", () => {
    expect(buildAssetsContext([])).toBe("");
  });
});
