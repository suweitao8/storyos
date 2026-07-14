import { describe, expect, it } from "vitest";

import {
  buildSubtitleEntries,
  parseUnifiedScript,
} from "./story-production";

describe("unified story production", () => {
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
});
