import { describe, expect, it } from "vitest";

import {
  buildSubtitleEntries,
  parseUnifiedScript,
} from "./story-production";
import { buildBookSourceFallbackText } from "./routes/story-production";

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
