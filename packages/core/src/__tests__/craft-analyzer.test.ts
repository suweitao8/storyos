import { describe, expect, it } from "vitest";
import type { LLMMessage, LLMResponse } from "../llm/provider.js";
import { CraftAnalyzerAgent } from "../agents/craft-analyzer.js";

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
    },
    {
      "label": "冲突升级",
      "tone": "高压",
      "excerpt": "${longExcerpt("脚步声越来越近，")}"
    }
  ]
}`;

    const sourceText = [
      "第1章",
      longExcerpt("风声压着窗纸，"),
      longExcerpt("脚步声越来越近，"),
    ].join("\n");
    const agent = new StubCraftAnalyzerAgent([malformed, repaired]);

    const profile = await agent.analyze(sourceText, "测试小说", "zh");

    expect(agent.calls).toBe(1);
    expect(profile.structure.openingPattern).toBe("悬念切入");
    expect(profile.sceneRhythm.conflictEscalation).toBe("层层抬升");
    expect(profile.informationDisclosure.suspenseManagement).toBe("短悬念持续叠加");
    expect(profile.narrativePerspective.povStrategy).toBe("近距离第三人称");
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
      "第1章",
      longExcerpt("风声压着窗纸，"),
      longExcerpt("脚步声越来越近，"),
    ].join("\n");
    const agent = new StubCraftAnalyzerAgent([malformed, repaired]);

    const profile = await agent.analyze(sourceText, "测试小说", "zh");

    expect(agent.calls).toBe(2);
    expect(profile.structure.endingHookType).toBe("反转留钩");
    expect(profile.exemplars.length).toBe(1);
  });
});
