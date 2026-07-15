import { describe, expect, it } from "vitest";
import {
  buildStoryDirectionPrompt,
  buildStorySeedPrompt,
  buildStorySeedQualitySystemPrompt,
  detectStorySeedRealityDrift,
  inferCraftRealityLevel,
} from "../agents/craft-prompts.js";
import type { CraftProfile } from "../models/craft-profile.js";
import type { StorySeed } from "../models/story-seed.js";

const profile: CraftProfile = {
  sourceName: "reference",
  analyzedAt: "2026-07-13T00:00:00.000Z",
  language: "zh",
  worldview: "A closed residential block treats repeated sounds as warnings and records disappear after midnight.",
  storyOutline: "A protagonist notices a small rule violation, investigates missing records, faces escalating proof, and pays a personal cost to expose the hidden mechanism.",
  structure: {
    openingPattern: "an abnormal detail in an ordinary routine",
    chapterArc: "clue, pressure, reversal, consequence",
    endingHookType: "a new rule appears after the apparent resolution",
  },
  sceneRhythm: {
    sceneTransitionTechnique: "hard cuts after a new clue",
    pacingCurve: "quiet observation followed by compressed danger",
    conflictEscalation: "each answer creates a more personal cost",
  },
  informationDisclosure: {
    foreshadowingDensity: "high",
    informationReleaseRhythm: "staged reveals",
    suspenseManagement: "withhold the rule behind repeated evidence",
  },
  narrativePerspective: {
    povStrategy: "close third person",
    narrationDialogueRatio: "balanced",
    narrativeDistance: "close to the protagonist",
  },
  exemplars: [],
};

describe("story direction prompt", () => {
  it("injects worldview and story outline as reference", () => {
    const prompt = buildStoryDirectionPrompt(profile, "short", "zh", "old direction");

    expect(prompt.user).toContain(profile.worldview);
    expect(prompt.user).toContain(profile.storyOutline);
    expect(prompt.user).toContain("old direction");
    expect(prompt.user).toContain("一篇单章节短篇故事");
  });

  it("does NOT inject technical craft mechanics (pacing, POV, rhythm)", () => {
    const prompt = buildStoryDirectionPrompt(profile, "short", "zh");

    // Technical jargon from the craft profile must not leak into the prompt
    expect(prompt.user).not.toContain("openingPattern");
    expect(prompt.user).not.toContain("pacingCurve");
    expect(prompt.user).not.toContain("povStrategy");
    expect(prompt.user).not.toContain("narrativeDistance");
  });

  it("asks for plain, conversational language", () => {
    const directionPrompt = buildStoryDirectionPrompt(profile, "short", "zh");
    const seedPrompt = buildStorySeedPrompt(profile, "short", "zh");

    // The system prompt should encourage natural storytelling, not analysis
    expect(directionPrompt.system).toContain("朋友");
    expect(seedPrompt.system).toContain("朋友");
  });

  it("requests a complete creation contract instead of a three-field synopsis", () => {
    const prompt = buildStorySeedPrompt(profile, "short", "zh");

    for (const section of [
      "故事名称",
      "类型与基调",
      "一句话故事钩子",
      "世界观与运行规则",
      "角色与关系",
      "核心冲突、代价与 stakes",
      "分段故事大纲",
      "关键反转与线索回收",
      "结局与情绪余味",
      "画面与声音母题",
      "原创化改编方案",
    ]) {
      expect(prompt.user).toContain(section);
    }
    expect(prompt.system).toContain("创作契约");
    expect(prompt.user).toContain("不得只换名字");
  });

  it("forbids thinking and analysis output", () => {
    const prompt = buildStorySeedPrompt(profile, "short", "zh");

    expect(prompt.system).toContain("Do not output <think>");
  });

  it("can build a direct-output seed prompt without a selected craft", () => {
    const prompt = buildStorySeedPrompt(undefined, "short", "en");

    expect(prompt.user).toContain("Story title");
    expect(prompt.user).toContain("short story seed");
  });

  it("keeps the framework but swaps specific elements", () => {
    const prompt = buildStorySeedPrompt(profile, "short", "zh");

    expect(prompt.system).toContain("同框架");
    expect(prompt.system).toContain("替换");
  });

  it("inherits realistic suspense and horror boundaries instead of inventing science fiction", () => {
    const prompt = buildStorySeedPrompt({
      ...profile,
      mode: "bilibili-commentary",
      videoStory: {
        logline: "一个普通维修工发现楼道里有人被悄悄抹去。",
        audiencePromise: "在熟悉的城市生活里逐步发现一个无法解释的悬疑真相。",
        outline: "从日常异常开始，经过调查和误导，在现实关系中揭开代价。",
        beats: [],
        reversals: [],
        payoffs: [],
        pacingCurve: "前慢后紧，线索连续收紧",
        hookStrategy: "用一个日常中不对劲的细节开场",
        climaxStrategy: "让主角在现实代价面前做选择",
        endingAftertaste: "真相落地但留下不安",
        originalizationRules: [],
      },
    }, "short", "zh");

    expect(prompt.user).toContain("题材、时代、现实层级和情绪承诺");
    expect(prompt.user).toContain("禁止主动加入科幻");
    expect(prompt.user).toContain("观众承诺");
    expect(prompt.system).toContain("不是题材和现实层级");
    expect(prompt.system).not.toContain("末班地铁");
  });

  it("adds a reality-level lock that keeps realistic stories in the same contemporary domain", () => {
    const prompt = buildStorySeedPrompt({
      ...profile,
      mode: "bilibili-short-story",
      worldview: "普通网约车司机在深夜接到一单异常行程，车里留下了可验证的血迹。",
      storyOutline: "司机通过订单、监控和乘客关系查找真相，最后承担现实后果。",
    }, "short", "zh");

    expect(prompt.user).toContain("现实层级锁");
    expect(prompt.user).toContain("同一类当代生活领域");
    expect(prompt.user).toContain("不要从普通城市故事跳到跨时代旧案");
    expect(prompt.user).toContain("不要突然宣布“其实是鬼”");
  });

  it("classifies source reality level before generating a new story", () => {
    expect(inferCraftRealityLevel(profile)).toBe("realistic");
    expect(inferCraftRealityLevel({ ...profile, mode: "ghost-story" })).toBe("supernatural");
    expect(inferCraftRealityLevel({ ...profile, worldview: "未来城市由人工智能管理" })).toBe("science-fiction");
    expect(inferCraftRealityLevel({ ...profile, worldview: "A haunted house leaves evidence after midnight." })).toBe("supernatural");
    expect(inferCraftRealityLevel({ ...profile, worldview: "A science fiction city uses future technology." })).toBe("science-fiction");
  });

  it("detects unsupported supernatural and science-fiction drift in realistic seeds", () => {
    const driftedSeed: StorySeed = {
      title: "末班车",
      worldview: "车站会在夜里重置现场。",
      outline: "主角调查车站，并发现一条无法解释的记录。",
      ending: "最后确认是鬼魂在时间循环里反复附身。",
      reversals: "人工智能控制着平行宇宙入口。",
    };

    expect(detectStorySeedRealityDrift(profile, driftedSeed)).toEqual([
      "unsupported supernatural mechanism",
      "unsupported science-fiction mechanism",
    ]);
    expect(detectStorySeedRealityDrift({ ...profile, mode: "ghost-story" }, driftedSeed)).toEqual([]);
  });

  it("keeps ghost-story supernatural horror without allowing a sci-fi drift", () => {
    const prompt = buildStoryDirectionPrompt({
      ...profile,
      mode: "ghost-story",
      ghostStory: {
        fearCore: "熟悉的家中空间逐渐变得不可信",
        supernaturalRules: "回应第三次敲门会失去一段记忆",
        taboos: "不能在门后叫出名字",
        protagonistVulnerability: "主角害怕忘记家人",
        clueSystem: "声音和门牌变化构成线索",
        revealCadence: "先给异常，再解释代价",
        scareCadence: "少量惊吓，持续压迫",
        escalationLadder: "从听见到看见，再到被规则锁定",
        sensoryMotifs: "敲门声和坏掉的灯",
        endingAftertaste: "解决眼前问题但留下记忆缺口",
      },
    }, "short", "zh");

    expect(prompt.user).toContain("这是恐怖鬼故事模式");
    expect(prompt.user).toContain("超自然规则");
    expect(prompt.user).toContain("不能改成科幻悬疑");
  });

  it("makes the background score check mode fidelity and reality level", () => {
    const qualityPrompt = buildStorySeedQualitySystemPrompt(profile, "zh");

    expect(qualityPrompt).toContain("题材与现实感一致性");
    expect(qualityPrompt).toContain("科幻");
    expect(qualityPrompt).toContain("参考现实层级");
    expect(qualityPrompt).toContain("59");
    expect(qualityPrompt).toContain(profile.worldview);
    expect(qualityPrompt).toContain(profile.storyOutline);
  });
});
