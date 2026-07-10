import { describe, expect, it } from "vitest";
import type { LLMMessage, LLMResponse } from "../llm/provider.js";
import {
  CraftAnalyzerAgent,
  splitCraftChapters,
  validateExemplars,
} from "../agents/craft-analyzer.js";
import { buildCraftAnalysisSystemPrompt } from "../agents/craft-prompts.js";

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

  it("asks for fine-grained modules in the craft-analysis prompt", () => {
    const prompt = buildCraftAnalysisSystemPrompt("zh");

    expect(prompt).toContain("modules");
    expect(prompt).toContain("6-10");
    expect(prompt).toContain("推进章节");
    expect(prompt).toContain("悬念管理");
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
