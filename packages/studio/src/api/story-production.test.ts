import { describe, expect, it } from "vitest";

import {
  buildSubtitleEntries,
  formatScriptIssues,
  parseUnifiedScript,
  validateScriptQuality,
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
      // 旁白在逗号处断句换行
      subtitle: "旁白：凌晨两点，\n电梯自己亮了。",
      durationMs: 4000,
      visual: "老旧电梯停在十三层。",
    });
    // 句号处也会换行（句末标点后跟换行，但 trim 掉尾换行）
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

  it("numbers shots per-scene starting from 1", () => {
    const result = parseUnifiedScript(`# 多场景编号测试

## 场景 A

### 镜头 1
- 画面：A1
- 旁白：第一句。

### 镜头 2
- 画面：A2
- 旁白：第二句。

## 场景 B

### 镜头 3
- 画面：B1
- 旁白：第三句。

### 镜头 4
- 画面：B2
- 旁白：第四句。`);

    // 场景 A 的两个镜头编号 1、2，场景 B 的两个镜头重新从 1、2 开始
    expect(result.shots.map((s) => s.number)).toEqual([1, 2, 1, 2]);
    expect(result.shots.map((s) => s.scene)).toEqual(["场景 A", "场景 A", "场景 B", "场景 B"]);
  });

  it("splits long narration at commas and periods for readability", () => {
    const result = parseUnifiedScript(`# 断句测试

## 场景

### 镜头 1
- 旁白：天色暗了下来，路灯亮了，她终于走到了门口。`);

    // 逗号和句号后插入换行，句末尾换行被 trim
    expect(result.shots[0]?.subtitle).toBe("天色暗了下来，\n路灯亮了，\n她终于走到了门口。");
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

describe("validateScriptQuality", () => {
  const goodShot = {
    number: 1, scene: "场景一",
    visual: "走廊尽头站着一个女人【林小雨】。",
    camera: "中景",
    subtitle: "她终于来了。",
    durationMs: 3000,
    imagePrompt: "年轻女人穿白色连衣裙站在昏暗走廊尽头，冷蓝色调，侧光，中景，悬疑氛围",
  };

  it("passes a well-formed shot without issues", () => {
    const issues = validateScriptQuality([goodShot], ["林小雨"]);
    expect(issues).toHaveLength(0);
  });

  it("detects missing narration", () => {
    const issues = validateScriptQuality([{ ...goodShot, subtitle: "" }], ["林小雨"]);
    expect(issues.some((i) => i.type === "missing_narration" && i.shot === 1)).toBe(true);
  });

  it("detects missing camera", () => {
    const issues = validateScriptQuality([{ ...goodShot, camera: undefined }], ["林小雨"]);
    expect(issues.some((i) => i.type === "missing_camera" && i.shot === 1)).toBe(true);
  });

  it("detects thin image prompt", () => {
    const issues = validateScriptQuality([{ ...goodShot, imagePrompt: "女人" }], ["林小雨"]);
    expect(issues.some((i) => i.type === "thin_image_prompt" && i.shot === 1)).toBe(true);
  });

  it("detects untracked asset name referenced in visual", () => {
    const issues = validateScriptQuality(
      [{ ...goodShot, visual: "走廊尽头站着一个女人【不存在的角色】。" }],
      ["林小雨"],
    );
    expect(issues.some((i) => i.type === "untracked_asset_name" && i.message.includes("不存在的角色"))).toBe(true);
  });

  it("does not flag asset names when no asset names provided", () => {
    const issues = validateScriptQuality([goodShot], []);
    expect(issues.some((i) => i.type === "untracked_asset_name")).toBe(false);
  });

  it("formatScriptIssues returns null when no issues", () => {
    expect(formatScriptIssues([])).toBeNull();
  });

  it("formatScriptIssues groups issues by type in readable text", () => {
    const issues = validateScriptQuality([
      { number: 1, scene: "s", visual: "v", subtitle: "", durationMs: 0 },
      { number: 2, scene: "s", visual: "v【张三】", camera: "特写", subtitle: "旁白", durationMs: 0, imagePrompt: "详细的提示词描述" },
    ], []);
    const formatted = formatScriptIssues(issues);
    expect(formatted).not.toBeNull();
    expect(formatted!).toContain("剧本质量校验发现问题");
    expect(formatted!).toContain("缺少旁白");
  });
});
