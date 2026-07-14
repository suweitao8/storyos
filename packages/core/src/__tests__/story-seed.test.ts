import { describe, expect, it } from "vitest";
import {
  StorySeedParseError,
  isStorySeed,
  isStorySeedWithOriginalizationPlan,
  parseStorySeed,
  serializeStorySeed,
  type StorySeed,
} from "../models/story-seed.js";

const COMPLETE_SEED_MARKDOWN = `## 故事名称
凌晨两点十七分

## 类型与基调
都市灵异悬疑，冷峻压迫

## 一句话故事钩子
守夜维修员接到已故邻居的来电，必须在第二次敲门前找回一户被抹掉的人。

## 世界观与运行规则
老楼会在固定时间抹去一户人的存在，回应电话会丢失一条相关记忆。

## 角色与关系
周砚是害怕被遗忘的维修员；林槐只能通过电话留下痕迹。

## 核心冲突、代价与 stakes
周砚要找回林槐一家，但每次接听都会牺牲自己的记忆。

## 分段故事大纲
开场发现电话；中段调查门牌；转折发现自己已忘记林槐；高潮在第二次敲门前选择回应；结局留下代价。

## 关键反转与线索回收
门牌变化不是诅咒的结果，而是周砚主动参与抹除的记录。

## 结局与情绪余味
周砚救回一个孩子，却忘记了孩子的名字，楼道恢复安静。

## 画面与声音母题
坏掉的电子钟、重复的敲门声和逐渐熄灭的感应灯。
`;

const COMPLETE_SEED: StorySeed = {
  title: "凌晨两点十七分",
  genreTone: "都市灵异悬疑，冷峻压迫",
  hook: "守夜维修员接到已故邻居的来电，必须在第二次敲门前找回一户被抹掉的人。",
  worldview: "老楼会在固定时间抹去一户人的存在，回应电话会丢失一条相关记忆。",
  characters: "周砚是害怕被遗忘的维修员；林槐只能通过电话留下痕迹。",
  conflict: "周砚要找回林槐一家，但每次接听都会牺牲自己的记忆。",
  outline: "开场发现电话；中段调查门牌；转折发现自己已忘记林槐；高潮在第二次敲门前选择回应；结局留下代价。",
  reversals: "门牌变化不是诅咒的结果，而是周砚主动参与抹除的记录。",
  ending: "周砚救回一个孩子，却忘记了孩子的名字，楼道恢复安静。",
  visualAudioMotifs: "坏掉的电子钟、重复的敲门声和逐渐熄灭的感应灯。",
};

const ORIGINALIZED_SEED_MARKDOWN = `${COMPLETE_SEED_MARKDOWN.trim()}

## 原创化改编方案
把封闭住宅替换为高压写字楼，把邻里关系重建为项目组与物业的利益关系，重新设计因果链和结局代价。`;

describe("short story seed", () => {
  it("recognizes complete seeds and rejects incomplete runtime values", () => {
    expect(isStorySeed(COMPLETE_SEED)).toBe(true);
    expect(isStorySeed({ ...COMPLETE_SEED, ending: "" })).toBe(false);
    expect(isStorySeed({ ...COMPLETE_SEED, outline: 42 })).toBe(false);
    expect(isStorySeed(null)).toBe(false);
  });

  it("parses all required story sections from Markdown", () => {
    expect(parseStorySeed(COMPLETE_SEED_MARKDOWN)).toEqual(COMPLETE_SEED);
  });

  it("strips an optional Markdown code fence before parsing", () => {
    expect(parseStorySeed(`\`\`\`markdown\n${COMPLETE_SEED_MARKDOWN}\n\`\`\``)).toEqual(COMPLETE_SEED);
  });

  it("accepts bare and bold section labels from direct-output models", () => {
    const directOutput = COMPLETE_SEED_MARKDOWN
      .replace(/^##\s+/gmu, "")
      .replace(/^(核心冲突、代价与 stakes|画面与声音母题)$/gmu, "**$1**:");
    expect(parseStorySeed(directOutput)).toEqual(COMPLETE_SEED);
  });

  it("reports the missing required section instead of returning a partial seed", () => {
    expect(() => parseStorySeed(COMPLETE_SEED_MARKDOWN.replace("## 结局与情绪余味\n周砚救回一个孩子，却忘记了孩子的名字，楼道恢复安静。\n\n", ""))).toThrowError(
      new StorySeedParseError(["ending"]),
    );
  });

  it("serializes a seed in stable section order", () => {
    expect(serializeStorySeed(COMPLETE_SEED)).toBe(COMPLETE_SEED_MARKDOWN.trim());
  });

  it("parses and serializes the optional originality transformation plan", () => {
    const seed = parseStorySeed(ORIGINALIZED_SEED_MARKDOWN);

    expect(seed.originalizationPlan).toContain("高压写字楼");
    expect(serializeStorySeed(seed)).toContain("## 原创化改编方案");
    expect(serializeStorySeed(seed)).toContain("重新设计因果链");
  });

  it("keeps legacy ten-section story seeds valid without a transformation plan", () => {
    const seed = parseStorySeed(COMPLETE_SEED_MARKDOWN);

    expect(seed.originalizationPlan).toBeUndefined();
    expect(isStorySeed(seed)).toBe(true);
    expect(isStorySeedWithOriginalizationPlan(seed)).toBe(false);
  });

  it("requires an originality transformation plan for newly generated seeds", () => {
    expect(isStorySeedWithOriginalizationPlan({
      ...COMPLETE_SEED,
      originalizationPlan: "重新设计空间、身份、关系、因果链和结局。",
    })).toBe(true);
    expect(isStorySeedWithOriginalizationPlan(COMPLETE_SEED)).toBe(false);
  });
});
