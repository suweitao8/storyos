import { describe, expect, it } from "vitest";
import type { LLMMessage, LLMResponse } from "../llm/provider.js";
import {
  CraftAnalyzerAgent,
  splitCraftChapters,
  validateExemplars,
} from "../agents/craft-analyzer.js";
import { buildCraftAnalysisSystemPrompt, buildCraftGuide } from "../agents/craft-prompts.js";

const EMPTY_USAGE = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
};

class StubCraftAnalyzerAgent extends CraftAnalyzerAgent {
  private callIndex = 0;

  constructor(private readonly outputs: ReadonlyArray<string>) {
    super({
      client: {} as never,
      model: "test-model",
      projectRoot: "D:/Github/storyos",
    });
  }

  get calls(): number {
    return this.callIndex;
  }

  protected override async chat(
    _messages: ReadonlyArray<LLMMessage>,
    _options?: { readonly temperature?: number; readonly maxTokens?: number },
  ): Promise<LLMResponse> {
    const content = this.outputs[this.callIndex] ?? this.outputs[this.outputs.length - 1] ?? "";
    this.callIndex += 1;
    return {
      content,
      usage: EMPTY_USAGE,
    };
  }
}

function longExcerpt(seed: string): string {
  return seed.repeat(80);
}

describe("CraftAnalyzerAgent", () => {
  it("splits Chinese chapter markers correctly", () => {
    const chapters = splitCraftChapters([
      "第1章 开局",
      "主角登场。",
      "第2章 变故",
      "冲突升级。",
      "第3章 收束",
      "留下钩子。",
    ].join("\n"));

    expect(chapters).toHaveLength(3);
    expect(chapters[0]).toMatchObject({ title: "第1章", body: "开局\n主角登场。" });
    expect(chapters[1]).toMatchObject({ title: "第2章", body: "变故\n冲突升级。" });
    expect(chapters[2]).toMatchObject({ title: "第3章", body: "收束\n留下钩子。" });
  });

  it("uses a readable Chinese craft-analysis prompt with concrete-output constraints", () => {
    const prompt = buildCraftAnalysisSystemPrompt("zh");

    expect(prompt).toContain("你是一位写作手法分析师");
    expect(prompt).toContain("每个必填字段都必须是具体");
    expect(prompt).toContain("不要输出“未明确说明”");
  });

  it("distinguishes Bilibili commentary from short-story reference material", () => {
    const commentaryPrompt = buildCraftAnalysisSystemPrompt("zh", "bilibili-commentary", "bilibili");
    const shortStoryPrompt = buildCraftAnalysisSystemPrompt("zh", "bilibili-short-story", "bilibili");

    expect(commentaryPrompt).toContain("影视解说");
    expect(commentaryPrompt).toContain("原创短篇故事");
    expect(shortStoryPrompt).toContain("B站短篇故事");
  });

  it("asks for fine-grained modules in the craft-analysis prompt", () => {
    const prompt = buildCraftAnalysisSystemPrompt("zh");

    expect(prompt).toContain("modules");
    expect(prompt).toContain("worldview");
    expect(prompt).toContain("storyOutline");
    expect(prompt).toContain("6-10");
    expect(prompt).toContain("推进章节");
    expect(prompt).toContain("悬念管理");
  });

  it("extracts the complete ghost-story craft contract and exposes it to the writer guide", async () => {
    const prompt = buildCraftAnalysisSystemPrompt("zh", "ghost-story");
    expect(prompt).toContain("ghostStory");
    expect(prompt).toContain("超自然规则");
    expect(prompt).toContain("禁止把原文的独特句子");

    const response = JSON.stringify({
      worldview: "A closed community trades memories for access to forbidden places.",
      storyOutline: "An outsider enters during a crisis, learns the rule, breaks it to save someone, and pays a public cost before the rule is redefined.",
      structure: { openingPattern: "异常先行", chapterArc: "线索递进", endingHookType: "新禁忌" },
      sceneRhythm: { sceneTransitionTechnique: "感官硬切", pacingCurve: "缓慢压迫后骤然收紧", conflictEscalation: "从异常到规则失效" },
      informationDisclosure: { foreshadowingDensity: "每章一个核心线索", informationReleaseRhythm: "逐层揭示", suspenseManagement: "回答旧疑问并制造新疑问" },
      narrativePerspective: { povStrategy: "贴近主角感知", narrationDialogueRatio: "叙述多于对话", narrativeDistance: "近距离" },
      ghostStory: {
        fearCore: "无法确认身边的人是否还是本人",
        supernaturalRules: "异常只在特定时间和声音出现",
        taboos: "不能回应第三次呼唤",
        protagonistVulnerability: "主角必须依赖听觉判断环境",
        clueSystem: "重复物件和声音逐步组成证据链",
        revealCadence: "先确认现象，再延后解释来源",
        scareCadence: "日常细节轻微偏差后短促爆发",
        escalationLadder: "可疑征兆、规则验证、逃生失败、身份反转",
        sensoryMotifs: "水声、旧收音机、潮湿气味",
        endingAftertaste: "真相闭合但规则仍在主角身边运行",
      },
      modules: [],
      exemplars: [],
    });
    const agent = new StubCraftAnalyzerAgent([response]);

    const profile = await agent.analyze("第1章 开始\n异常出现", "鬼故事测试", "zh", undefined, "ghost-story");

    expect(profile.mode).toBe("ghost-story");
    expect(profile.worldview).toContain("closed community");
    expect(profile.storyOutline).toContain("outsider enters");
    const guide = buildCraftGuide(profile);
    expect(guide).toContain("closed community");
    expect(guide).toContain("outsider enters");
    expect(profile.ghostStory?.fearCore).toContain("本人");
    expect(profile.ghostStory?.escalationLadder).toContain("身份反转");
    expect(buildCraftGuide(profile)).toContain("鬼故事仿写约束");
    expect(buildCraftGuide(profile)).toContain("超自然规则");
  });

  it("extracts video rhythm beats, reversals, payoffs, and originalization constraints", async () => {
    const response = JSON.stringify({
      worldview: "A small town hides a rule that trades public safety for private sacrifice.",
      storyOutline: "A newcomer tests an ordinary rule, discovers a hidden cost, and turns the rule against its keeper.",
      structure: { openingPattern: "Immediate anomaly", chapterArc: "Escalating tests", endingHookType: "Reframed threat" },
      sceneRhythm: { sceneTransitionTechnique: "Hard cuts after discoveries", pacingCurve: "Calm, pressure, release, second peak", conflictEscalation: "Each failed escape narrows the options" },
      informationDisclosure: { foreshadowingDensity: "One concrete clue per beat", informationReleaseRhythm: "Question, partial answer, new question", suspenseManagement: "Delay the rule's cost until action is irreversible" },
      narrativePerspective: { povStrategy: "Close first person", narrationDialogueRatio: "Narration leads", narrativeDistance: "Immediate sensory distance" },
      videoStory: {
        logline: "A newcomer enters a town where every rescue creates a debt.",
        audiencePromise: "Fast supernatural mystery with escalating rule-based dread and a final reframe.",
        outline: "Hook the anomaly, establish the rule, force a test, expose the hidden cost, then pay it at the climax.",
        beats: [
          { order: 1, kind: "hook", position: 0.04, timeRange: "00:00-00:18", event: "An impossible warning appears in an ordinary place.", function: "Create an immediate question", emotionalEffect: "Unease", evidence: "warning in an ordinary place" },
          { order: 2, kind: "setup", position: 0.18, timeRange: "00:18-01:20", event: "The protagonist learns a rule and its apparent benefit.", function: "Make the rule usable", emotionalEffect: "Curiosity", evidence: "learns a rule" },
          { order: 3, kind: "reversal", position: 0.54, timeRange: "03:10-03:35", event: "The rescue is revealed to transfer the danger.", function: "Reinterpret earlier clues", emotionalEffect: "Shock", evidence: "transfer the danger" },
          { order: 4, kind: "climax", position: 0.86, timeRange: "05:05-05:40", event: "The protagonist chooses the costly loophole.", function: "Deliver the emotional release", emotionalEffect: "Dread and catharsis", evidence: "costly loophole" },
        ],
        reversals: [
          { order: 1, position: 0.54, trigger: "The rescued person repeats the warning.", apparentTruth: "The rule protects victims.", reveal: "The rule moves the danger to the rescuer.", reinterpretedClues: "The repeated warning and missing time now point to a transfer.", emotionalEffect: "Shock", setupBeatOrders: [1, 2] },
        ],
        payoffs: [
          { order: 1, position: 0.86, setup: "The rule's loophole was planted in the warning.", release: "The protagonist uses the loophole at a personal cost.", costOrConsequence: "The town is safe but the protagonist becomes the new warning.", emotionalEffect: "Catharsis with aftertaste" },
        ],
        pacingCurve: "0-20% hook and question; 20-50% pressure; 50-65% reversal; 65-90% rapid escalation; 90-100% consequence.",
        hookStrategy: "Open on a concrete anomaly before explaining the world.",
        climaxStrategy: "Resolve the rule through a costly choice, not exposition.",
        endingAftertaste: "The answer closes the mystery while leaving the mechanism active.",
        originalizationRules: ["Replace all identities, settings, and supernatural rules.", "Do not reuse the reference's three-event chain or distinctive wording."],
      },
      modules: [],
      exemplars: [],
    });

    const agent = new StubCraftAnalyzerAgent([response]);
    const profile = await agent.analyze("[0.0s-1.0s] warning\n[1.0s-2.0s] rule", "video-test", "en", undefined, "ghost-story", "bilibili");

    expect(profile.videoStory?.beats).toHaveLength(4);
    expect(profile.videoStory?.reversals[0]?.position).toBe(0.54);
    expect(profile.videoStory?.payoffs[0]?.setup).toContain("loophole");
    expect(buildCraftGuide(profile)).toContain("Transfer the reference video's beat functions");
    expect(buildCraftGuide(profile)).toContain("Do not reuse the reference's three-event chain");
  });

  it("normalizes Chinese video rhythm field aliases without losing plot evidence", async () => {
    const response = JSON.stringify({
      worldview: "一个社区把安全建立在集体沉默上。",
      storyOutline: "调查者从异常现场进入群体秘密，最后发现沉默本身就是代价。",
      structure: { openingPattern: "异常先行", chapterArc: "调查升级", endingHookType: "物证悬念" },
      sceneRhythm: { sceneTransitionTechnique: "硬切", pacingCurve: "前快后紧", conflictEscalation: "由现场到群体" },
      informationDisclosure: { foreshadowingDensity: "每段一个线索", informationReleaseRhythm: "逐层揭示", suspenseManagement: "回答旧问题并制造新问题" },
      narrativePerspective: { povStrategy: "近距离观察", narrationDialogueRatio: "叙述主导", narrativeDistance: "冷静克制" },
      videoStory: {
        "一句话梗概": "调查者发现所有证人都在重复同一个不存在的时间。",
        "观看承诺": "快速推进的悬疑调查与连续认知翻转。",
        "视频大纲": "从异常现场开始，经过证词矛盾和物证回收，在最后一次翻转中重写观众对第一幕的理解。",
        "节拍": [
          { "序号": 1, "类型": "hook", "位置": "10%", "时间": "00:00-00:20", "内容": "证人说出不存在的时间", "功能": "开场钩子", "情绪影响": "不安" },
        ],
        "反转点": [
          { "序号": 1, "时间点": "60%", "触发点": "物证与证词同时失效", "表面认知": "证人记错了", "反转内容": "所有证人被同一规则改写", "线索回收": "第一幕的时间标记其实是规则提示", "观众情绪": "震惊", "铺垫节拍": [1] },
        ],
        "爽点": [
          { "序号": 1, "位置": "80%", "铺垫": "主角保留了原始记录", "释放": "用记录反证集体口供", "后果": "主角成为规则的下一个目标", "观众情绪": "释放后不安" },
        ],
        "节奏曲线": "10%钩子，60%反转，80%释放，95%余波",
        "钩子策略": "先给具体异常再解释背景",
        "高潮设计": "用一次有代价的选择完成反证",
        "结尾余韵": "真相闭合但规则仍在运行",
        "原创化约束": ["重写人物、地点、规则和因果链", "不得复用原视频的连续事件顺序"],
      },
      modules: [],
      exemplars: [],
    });
    const agent = new StubCraftAnalyzerAgent([response]);
    const profile = await agent.analyze("[0.0s-1.0s] 字幕", "视频别名测试", "zh", undefined, "general", "bilibili");

    expect(profile.videoStory?.logline).toContain("不存在的时间");
    expect(profile.videoStory?.beats[0]?.event).toContain("证人说出");
    expect(profile.videoStory?.reversals[0]?.position).toBe(0.6);
    expect(profile.videoStory?.reversals[0]?.reveal).toContain("同一规则");
    expect(profile.videoStory?.payoffs[0]?.release).toContain("反证");
    expect(profile.videoStory?.originalizationRules).toHaveLength(2);
  });

  it("fills missing reversal and payoff details from linked beats instead of showing placeholders", async () => {
    const response = JSON.stringify({
      worldview: "规则世界",
      storyOutline: "调查者沿着线索进入更深的秘密。",
      structure: { openingPattern: "异常", chapterArc: "升级", endingHookType: "悬念" },
      sceneRhythm: { sceneTransitionTechnique: "硬切", pacingCurve: "先缓后紧", conflictEscalation: "逐层升级" },
      informationDisclosure: { foreshadowingDensity: "高", informationReleaseRhythm: "逐层", suspenseManagement: "延迟回答" },
      narrativePerspective: { povStrategy: "近景", narrationDialogueRatio: "叙述主导", narrativeDistance: "近" },
      videoStory: {
        beats: [
          { order: 1, kind: "开场钩子", position: 0.1, event: "异常警报响起", function: "制造问题", emotionalEffect: "不安" },
          { order: 2, kind: "铺垫", position: 0.35, event: "主角发现旧记录", function: "埋下线索", emotionalEffect: "好奇" },
          { order: 3, kind: "高潮", position: 0.72, event: "规则反噬主角", function: "完成情绪释放", emotionalEffect: "恐惧" },
          { order: 4, kind: "结尾", position: 0.92, event: "新的警报再次响起", function: "留下余韵", emotionalEffect: "不安延续" },
        ],
        reversals: [
          { order: 1, setupBeatOrders: [1, 2], emotionalEffect: "认知翻转" },
        ],
        payoffs: [
          { order: 1, position: 0.72 },
        ],
      },
      modules: [],
      exemplars: [],
    });
    const agent = new StubCraftAnalyzerAgent([response]);
    const profile = await agent.analyze("[0.0s-1.0s] 字幕", "缺字段测试", "zh", undefined, "general", "bilibili");
    const reversal = profile.videoStory?.reversals[0];
    const payoff = profile.videoStory?.payoffs[0];

    expect(profile.videoStory?.beats[0]?.kind).toBe("hook");
    expect(reversal?.position).toBeGreaterThan(0);
    expect(reversal?.reveal).toContain("规则反噬");
    expect(reversal?.trigger).toContain("旧记录");
    expect(payoff?.release).toContain("规则反噬");
    expect(payoff?.setup).not.toBe("未说明");
    expect(payoff?.emotionalEffect).toContain("恐惧");
    expect(profile.videoStory?.logline).not.toBe("未说明");
    expect(profile.videoStory?.originalizationRules.length).toBeGreaterThan(0);
  });

  it("sanitizes malformed JSON when exemplar objects are missing commas", async () => {
    const malformed = `{
  "structure": {
    "openingPattern": "悬念切入",
    "chapterArc": "递进推进",
    "endingHookType": "反转留钩"
  },
  "sceneRhythm": {
    "sceneTransitionTechnique": "硬切",
    "pacingCurve": "先压后放",
    "conflictEscalation": "层层抬升"
  },
  "informationDisclosure": {
    "foreshadowingDensity": "高",
    "informationReleaseRhythm": "逐步释放",
    "suspenseManagement": "短悬念持续叠加"
  },
  "narrativePerspective": {
    "povStrategy": "近距离第三人称",
    "narrationDialogueRatio": "叙述略多于对话",
    "narrativeDistance": "贴近主角"
  },
  "exemplars": [
    {
      "label": "开篇压迫感",
      "tone": "紧张",
      "excerpt": "${longExcerpt("风声压着窗纸，")}"
    }
    {
      "label": "冲突升级",
      "tone": "高压",
      "excerpt": "${longExcerpt("脚步声越来越近，")}"
    }
  ]
}`;

    const sourceText = [
      "第1章 开局",
      longExcerpt("风声压着窗纸，"),
      "第2章 升级",
      longExcerpt("脚步声越来越近，"),
    ].join("\n");
    const agent = new StubCraftAnalyzerAgent([malformed]);

    const profile = await agent.analyze(sourceText, "测试小说", "zh");

    expect(agent.calls).toBe(1);
    expect(profile.structure.openingPattern).toBe("悬念切入");
    expect(profile.sceneRhythm.conflictEscalation).toBe("层层抬升");
    expect(profile.informationDisclosure.suspenseManagement).toBe("短悬念持续叠加");
    expect(profile.narrativePerspective.povStrategy).toBe("近距离第三人称");
    expect(profile.exemplars.length).toBe(2);
  });

  it("accepts craft section field aliases when the model returns Chinese labels", async () => {
    const aliased = `{
  "structure": {
    "开篇模式": "悬念切入",
    "单章弧线": "起承转合",
    "章末钩子": "反转留钩"
  },
  "sceneRhythm": {
    "场景切换": "硬切",
    "节奏曲线": "前松后紧",
    "冲突升级": "层层推进"
  },
  "informationDisclosure": {
    "伏笔密度": "高",
    "信息释放": "逐步递进",
    "悬念管理": "连续吊点"
  },
  "narrativePerspective": {
    "POV策略": "近距离第三人称",
    "叙述/对话比例": "叙述略多于对话",
    "叙事距离": "贴近主角"
  },
  "exemplars": []
}`;

    const agent = new StubCraftAnalyzerAgent([aliased]);

    const profile = await agent.analyze("第1章 开局\n正文", "别名测试", "zh");

    expect(profile.structure.openingPattern).toBe("悬念切入");
    expect(profile.structure.chapterArc).toBe("起承转合");
    expect(profile.structure.endingHookType).toBe("反转留钩");
    expect(profile.narrativePerspective.narrationDialogueRatio).toBe("叙述略多于对话");
  });

  it("unwraps Chinese writing-craft payloads and maps their top-level section aliases", async () => {
    const response = JSON.stringify({
      写作模式: {
        结构手法: {
          开篇模式: "先抛出异常，再补充背景。",
          单章弧线: "从异常推进到新的线索。",
          章末钩子: "在新疑问处收束。",
        },
        场景与节奏: {
          场景切换: "用动作和感官细节硬切。",
          节奏曲线: "先缓后急。",
          冲突升级: "从试探逐层升级到正面对抗。",
        },
        信息披露: {
          伏笔密度: "每章至少埋下一个可回收线索。",
          信息释放: "先给局部事实，再延后真相。",
          悬念管理: "旧疑问解决时立即引出新疑问。",
        },
        叙事视角: {
          POV策略: "贴近主角感知的第三人称。",
          叙述对话比例: "叙述多于对话。",
          叙事距离: "高压场景贴近，解释段落稍微拉远。",
        },
        拆文模块: [
          { 分类: "悬念", 标题: "疑问递进", 描述: "每次回答只揭开一层信息。" },
        ],
        范例: [{ 标签: "开篇证据", 基调: "紧张", 原文: "异常事件出现。".repeat(12) }],
      },
    });
    const agent = new StubCraftAnalyzerAgent([response]);

    const sourceText = `第1章 开局\n${"异常事件出现。".repeat(12)}`;
    const profile = await agent.analyze(sourceText, "中文字段测试", "zh");

    expect(profile.structure.openingPattern).toBe("先抛出异常，再补充背景。");
    expect(profile.sceneRhythm.pacingCurve).toBe("先缓后急。");
    expect(profile.informationDisclosure.suspenseManagement).toBe("旧疑问解决时立即引出新疑问。");
    expect(profile.narrativePerspective.povStrategy).toBe("贴近主角感知的第三人称。");
    expect(profile.exemplars).toContainEqual({
      label: "开篇证据",
      tone: "紧张",
      excerpt: "异常事件出现。".repeat(12),
    });
    expect(profile.modules).toContainEqual({
      category: "suspense",
      label: "疑问递进",
      summary: "每次回答只揭开一层信息。",
      evidence: undefined,
    });
  });

  it("falls back to a JSON-repair pass when deterministic sanitization is insufficient", async () => {
    const malformed = `{
  "structure": {
    "openingPattern": "悬念切入",
    "chapterArc": "递进推进",
    "endingHookType": "反转留钩"
  },
  "sceneRhythm": {
    "sceneTransitionTechnique": "硬切",
    "pacingCurve": "先压后放",
    "conflictEscalation": "层层抬升"
  },
  "informationDisclosure": {
    "foreshadowingDensity": "高",
    "informationReleaseRhythm": "逐步释放",
    "suspenseManagement": "短悬念持续叠加"
  },
  "narrativePerspective": {
    "povStrategy": "近距离第三人称",
    "narrationDialogueRatio": "叙述略多于对话",
    "narrativeDistance": "贴近主角"
  },
  "exemplars": [
    {
      "label" "开篇压迫感",
      "tone": "紧张",
      "excerpt": "${longExcerpt("风声压着窗纸，")}"
    }
  ]
}`;

    const repaired = `{
  "structure": {
    "openingPattern": "悬念切入",
    "chapterArc": "递进推进",
    "endingHookType": "反转留钩"
  },
  "sceneRhythm": {
    "sceneTransitionTechnique": "硬切",
    "pacingCurve": "先压后放",
    "conflictEscalation": "层层抬升"
  },
  "informationDisclosure": {
    "foreshadowingDensity": "高",
    "informationReleaseRhythm": "逐步释放",
    "suspenseManagement": "短悬念持续叠加"
  },
  "narrativePerspective": {
    "povStrategy": "近距离第三人称",
    "narrationDialogueRatio": "叙述略多于对话",
    "narrativeDistance": "贴近主角"
  },
  "exemplars": [
    {
      "label": "开篇压迫感",
      "tone": "紧张",
      "excerpt": "${longExcerpt("风声压着窗纸，")}"
    }
  ]
}`;

    const sourceText = [
      "第1章 开局",
      longExcerpt("风声压着窗纸，"),
      "第2章 升级",
      longExcerpt("脚步声越来越近，"),
    ].join("\n");
    const agent = new StubCraftAnalyzerAgent([malformed, repaired]);

    const profile = await agent.analyze(sourceText, "测试小说", "zh");

    expect(agent.calls).toBe(2);
    expect(profile.structure.endingHookType).toBe("反转留钩");
    expect(profile.exemplars.length).toBe(1);
  });

  it("retries with a compact repair when the first repair response is still malformed", async () => {
    const malformed = `{
  "structure": {
    "openingPattern": "悬念切入",
    "chapterArc": "递进推进",
    "endingHookType": "反转留钩"
  },
  "sceneRhythm": {
    "sceneTransitionTechnique": "硬切",
    "pacingCurve": "先压后放",
    "conflictEscalation": "层层抬升"
  },
  "informationDisclosure": {
    "foreshadowingDensity": "高",
    "informationReleaseRhythm": "逐步释放",
    "suspenseManagement": "短悬念持续叠加"
  },
  "narrativePerspective": {
    "povStrategy": "近距离第三人称",
    "narrationDialogueRatio": "叙述略多于对话",
    "narrativeDistance": "贴近主角"
  },
  "exemplars": [
    { "label" "开篇", "tone": "紧张", "excerpt": "异常出现，危险正在逼近。" }
  ]
}`;
    const validCompact = JSON.stringify({
      structure: {
        openingPattern: "悬念切入",
        chapterArc: "递进推进",
        endingHookType: "反转留钩",
      },
      sceneRhythm: {
        sceneTransitionTechnique: "硬切",
        pacingCurve: "先压后放",
        conflictEscalation: "层层抬升",
      },
      informationDisclosure: {
        foreshadowingDensity: "高",
        informationReleaseRhythm: "逐步释放",
        suspenseManagement: "短悬念持续叠加",
      },
      narrativePerspective: {
        povStrategy: "近距离第三人称",
        narrationDialogueRatio: "叙述略多于对话",
        narrativeDistance: "贴近主角",
      },
      exemplars: [],
    });
    const agent = new StubCraftAnalyzerAgent([malformed, malformed, validCompact]);

    const profile = await agent.analyze("第1章 开局\n异常出现。", "紧凑修复测试", "zh");

    expect(agent.calls).toBe(3);
    expect(profile.structure.openingPattern).toBe("悬念切入");
  });

  it("retries with a refinement pass when the extracted profile is mostly unspecified", async () => {
    const weak = JSON.stringify({
      structure: {
        openingPattern: "未明确说明",
        chapterArc: "未明确说明",
        endingHookType: "未明确说明",
      },
      sceneRhythm: {
        sceneTransitionTechnique: "未明确说明",
        pacingCurve: "未明确说明",
        conflictEscalation: "未明确说明",
      },
      informationDisclosure: {
        foreshadowingDensity: "未明确说明",
        informationReleaseRhythm: "未明确说明",
        suspenseManagement: "未明确说明",
      },
      narrativePerspective: {
        povStrategy: "未明确说明",
        narrationDialogueRatio: "未明确说明",
        narrativeDistance: "未明确说明",
      },
      exemplars: [],
    });

    const refined = JSON.stringify({
      structure: {
        openingPattern: "常以异常事件或危机瞬间切入，先抛问题再补背景。",
        chapterArc: "单章通常按遭遇异常、试探推进、得到新线索、末尾再翻紧的顺序展开。",
        endingHookType: "多在章末追加新发现或危险逼近，强行把读者带入下一章。",
      },
      sceneRhythm: {
        sceneTransitionTechnique: "以动作或感官触发硬切，少做解释性过渡。",
        pacingCurve: "前段快速抛设定，中段压缩探索，尾段用突发事件陡然拉高张力。",
        conflictEscalation: "常用更诡异的现象或更直接的人身威胁层层加码。",
      },
      informationDisclosure: {
        foreshadowingDensity: "高频埋伏笔，几乎每段异常描写都会挂出后续可回收的信息点。",
        informationReleaseRhythm: "采用小线索连续释放、关键真相延后揭露的节奏。",
        suspenseManagement: "通过只给局部答案、立刻引出新疑点来持续维持悬念。",
      },
      narrativePerspective: {
        povStrategy: "以贴近主角感知的第三人称为主，只展示主角当下能确认的信息。",
        narrationDialogueRatio: "叙述明显多于对话，对话主要承担信息刺点和情绪打断。",
        narrativeDistance: "叙事距离近，频繁进入主角即时感受和本能反应。",
      },
      exemplars: [],
    });

    const sourceText = [
      "第1章 开局",
      "韩非刚推开门，就闻到一股不属于活人的潮气。",
      "第2章 异响",
      "他还没来得及后退，走廊尽头忽然传来金属摩擦声。",
      "第3章 线索",
      "墙上的血字只出现了一瞬，却像故意给他看一样。",
    ].join("\n");
    const agent = new StubCraftAnalyzerAgent([weak, refined]);

    const profile = await agent.analyze(sourceText, "精炼测试", "zh");

    expect(agent.calls).toBe(2);
    expect(profile.structure.openingPattern).toContain("异常事件");
    expect(profile.informationDisclosure.suspenseManagement).toContain("新疑点");
  });

  it("preserves first-pass exemplars when refinement clears the array and the model uses text alias", async () => {
    const firstPass = JSON.stringify({
      structure: {
        openingPattern: "未明确说明",
        chapterArc: "未明确说明",
        endingHookType: "未明确说明",
        exemplar: "第一个结构范例片段".repeat(20),
      },
      sceneRhythm: {
        sceneTransitionTechnique: "未明确说明",
        pacingCurve: "未明确说明",
        conflictEscalation: "未明确说明",
        exemplar: "第一个节奏范例片段".repeat(20),
      },
      informationDisclosure: {
        foreshadowingDensity: "未明确说明",
        informationReleaseRhythm: "未明确说明",
        suspenseManagement: "未明确说明",
        exemplar: "第一个信息范例片段".repeat(20),
      },
      narrativePerspective: {
        povStrategy: "未明确说明",
        narrationDialogueRatio: "未明确说明",
        narrativeDistance: "未明确说明",
        exemplar: "第一个视角范例片段".repeat(20),
      },
      exemplars: [
        {
          label: "首轮代表片段",
          tone: "紧张",
          text: "首轮代表片段正文".repeat(30),
        },
      ],
    });

    const refined = JSON.stringify({
      structure: {
        openingPattern: "常以异常事件切入并快速翻入危机。",
        chapterArc: "先抛异状再递进线索，章末抬高危险。",
        endingHookType: "多用新发现或系统提示把章节挂起。",
        exemplar: "第一个结构范例片段".repeat(20),
      },
      sceneRhythm: {
        sceneTransitionTechnique: "以动作和感官完成硬切。",
        pacingCurve: "前缓后紧，尾段突然抬速。",
        conflictEscalation: "从轻微异常一路升级到直接威胁。",
        exemplar: "第一个节奏范例片段".repeat(20),
      },
      informationDisclosure: {
        foreshadowingDensity: "高频伏笔密集回收。",
        informationReleaseRhythm: "小线索连续抛出，关键真相延后揭露。",
        suspenseManagement: "始终保留缺口并用新问题顶替旧答案。",
        exemplar: "第一个信息范例片段".repeat(20),
      },
      narrativePerspective: {
        povStrategy: "贴近主角即时感知的第三人称。",
        narrationDialogueRatio: "叙述主导，对话负责打点信息。",
        narrativeDistance: "时而贴身感知，时而稍拉远回望。",
        exemplar: "第一个视角范例片段".repeat(20),
      },
      exemplars: [],
    });

    const sourceText = [
      "第1章 开局",
      "首轮代表片段正文".repeat(30),
      "第2章 异响",
      "第一个结构范例片段".repeat(20),
      "第3章 深挖",
      "第一个节奏范例片段".repeat(20),
      "第4章 线索",
      "第一个信息范例片段".repeat(20),
      "第5章 决断",
      "第一个视角范例片段".repeat(20),
    ].join("\n");
    const agent = new StubCraftAnalyzerAgent([firstPass, refined]);

    const profile = await agent.analyze(sourceText, "范例保留测试", "zh");

    expect(agent.calls).toBe(2);
    expect(profile.exemplars).toHaveLength(1);
    expect(profile.exemplars[0]).toMatchObject({
      label: "首轮代表片段",
      tone: "紧张",
    });
    expect(profile.exemplars[0]?.excerpt).toContain("首轮代表片段正文");
  });

  it("backfills exemplars array from validated section exemplars when the array is empty", () => {
    const sourceText = [
      "第1章 开局",
      "结构范例正文".repeat(30),
      "第2章 节奏",
      "节奏范例正文".repeat(30),
      "第3章 披露",
      "信息范例正文".repeat(30),
      "第4章 视角",
      "视角范例正文".repeat(30),
    ].join("\n");

    const profile = validateExemplars({
      sourceName: "兜底测试",
      analyzedAt: new Date().toISOString(),
      language: "zh",
      structure: {
        openingPattern: "结构描述",
        chapterArc: "弧线描述",
        endingHookType: "钩子描述",
        exemplar: "结构范例正文".repeat(30),
      },
      sceneRhythm: {
        sceneTransitionTechnique: "切场描述",
        pacingCurve: "节奏描述",
        conflictEscalation: "升级描述",
        exemplar: "节奏范例正文".repeat(30),
      },
      informationDisclosure: {
        foreshadowingDensity: "伏笔描述",
        informationReleaseRhythm: "释放描述",
        suspenseManagement: "悬念描述",
        exemplar: "信息范例正文".repeat(30),
      },
      narrativePerspective: {
        povStrategy: "视角描述",
        narrationDialogueRatio: "比例描述",
        narrativeDistance: "距离描述",
        exemplar: "视角范例正文".repeat(30),
      },
      exemplars: [],
    }, sourceText);

    expect(profile.exemplars).toHaveLength(4);
    expect(profile.exemplars.map((item) => item.label)).toEqual([
      "结构手法",
      "场景与节奏",
      "信息披露",
      "叙事视角",
    ]);
  });

  it("removes module evidence that is not a verbatim source excerpt", () => {
    const excerpt = "这是一段足够长的原文证据，用来证明一个写作手法如何在具体场景中发生，并且必须能够在原文中完整找到。".repeat(2);
    const profile = validateExemplars({
      sourceName: "证据校验",
      analyzedAt: new Date().toISOString(),
      language: "zh",
      structure: {
        openingPattern: "具体开篇",
        chapterArc: "具体推进",
        endingHookType: "具体收尾",
      },
      sceneRhythm: {
        sceneTransitionTechnique: "具体切换",
        pacingCurve: "具体节奏",
        conflictEscalation: "具体升级",
      },
      informationDisclosure: {
        foreshadowingDensity: "具体伏笔",
        informationReleaseRhythm: "具体释放",
        suspenseManagement: "具体悬念",
      },
      narrativePerspective: {
        povStrategy: "具体视角",
        narrationDialogueRatio: "具体比例",
        narrativeDistance: "具体距离",
      },
      modules: [
        { category: "opening", label: "有效证据", summary: "保留有效证据。", evidence: excerpt },
        { category: "opening", label: "拼接证据", summary: "丢弃拼接证据。", evidence: `${excerpt.slice(0, 60)}……${excerpt.slice(-60)}` },
      ],
      exemplars: [],
    }, excerpt);

    expect(profile.modules).toEqual([
      { category: "opening", label: "有效证据", summary: "保留有效证据。", evidence: excerpt },
      { category: "opening", label: "拼接证据", summary: "丢弃拼接证据。" },
    ]);
  });

  it("derives richer craft breakdown modules from the legacy sections when the model omits them", async () => {
    const sourceText = [
      "第1章 开局",
      "首先把异常事件轻轻抛出来，然后再补背景。",
      "第2章 进展",
      "不是一口气把信息全都说尽，而是一层层逐步上抬。",
      "第3章 悬念",
      "细节再处理，把新疑点持续抛出来。",
      "第4章 视角",
      "叙述和对话双线交织，距离主角非常近。",
    ].join("\n");

    const response = JSON.stringify({
      structure: {
        openingPattern: "先把异常事件轻轻抛出来，再补背景。",
        chapterArc: "单章从异状到加码，再向新信息推进。",
        endingHookType: "往往留下不完整的疑问号。",
      },
      sceneRhythm: {
        sceneTransitionTechnique: "用对话和动作做硬切换。",
        pacingCurve: "先推进压迫，再用撕扯点拉高。",
        conflictEscalation: "围绕核心矛盾一层层升级。",
      },
      informationDisclosure: {
        foreshadowingDensity: "高频埋伏点。",
        informationReleaseRhythm: "不是中心讲解，而是一点一点释放。",
        suspenseManagement: "持续吊着新疑点。",
      },
      narrativePerspective: {
        povStrategy: "贴近主角的第三人称。",
        narrationDialogueRatio: "叙述明显多于对话。",
        narrativeDistance: "视角贴近，代入感强。",
      },
      exemplars: [],
    });
    const agent = new StubCraftAnalyzerAgent([response]);

    const profile = await agent.analyze(sourceText, "测试小说", "zh");

    expect(profile.modules?.length).toBeGreaterThanOrEqual(8);
    expect(profile.modules?.[0]).toMatchObject({
      category: "opening",
      label: "开篇钩子",
    });
    expect(profile.modules?.some((item) => item.label.includes("悬念"))).toBe(true);
  });
});
