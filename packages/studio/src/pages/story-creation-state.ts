import type { ActionPayload } from "@actalk/inkos-core";

export const LONG_STORY_CHAPTERS = 10;
export const SHORT_STORY_CHAPTERS = 1;
export const STORY_WORD_COUNT_OPTIONS = [1_000, 2_000, 5_000, 10_000] as const;

export interface CraftOption {
  readonly id: string;
  readonly sourceName: string;
  readonly mode?: "general" | "ghost-story";
}

export function buildDefaultStoryDirection(
  craft: CraftOption,
  kind: "long" | "short",
  isZh: boolean,
): string {
  if (!isZh) {
    return craft.mode === "ghost-story"
      ? `Create an original ${kind === "long" ? "long-form" : "short"} ghost story using the selected craft's suspense rhythm, supernatural rules, clue escalation, and lingering aftertaste. A night-shift maintenance worker discovers that the elevator stops at a nonexistent 13th floor at 2:17 a.m.; each visit shows a resident who will disappear the next day. The protagonist must obey the rule that the second knock must never be answered and uncover why the building has erased one family from every record. Do not copy the reference work's characters, plot, wording, or scenes.`
      : `Create an original ${kind === "long" ? "long-form" : "short"} story using the selected craft's pacing, viewpoint, conflict escalation, and chapter hooks. A records clerk finds tomorrow's incident reports in a sealed archive and realizes the next report describes a disaster involving someone close to them. They must choose between exposing the system and protecting the person named in the report. Do not copy the reference work's characters, plot, wording, or scenes.`;
  }

  return craft.mode === "ghost-story"
    ? `参考已选写作模式的悬念节奏、灵异规则、线索递进和余味，创作一个完全原创的${kind === "long" ? "长篇" : "短篇"}鬼故事：一名夜班维修员发现，每到凌晨 2 点 17 分，电梯都会停在不存在的 13 楼，监控里出现的住户会在第二天失踪。主角必须遵守“第二次敲门绝不能回应”的规则，并查出整栋楼为何从所有记录中抹去了一个家庭。不得复制参考作品的人物、情节、措辞或场景。`
    : `参考已选写作模式的叙事节奏、视角安排、冲突升级和章节钩子，创作一个完全原创的${kind === "long" ? "长篇" : "短篇"}故事：一名档案员在封存库里发现了明天才会发生的事故报告，并确认下一份报告写着身边重要之人的名字。主角必须在揭露这套系统和保护报告中的人之间作出选择。不得复制参考作品的人物、情节、措辞或场景。`;
}

export interface LongStoryCreationInput {
  readonly title: string;
  readonly genre: string;
  readonly direction: string;
  readonly platform?: "tomato" | "qidian" | "feilu" | "other";
  readonly language: "zh" | "en";
  readonly chapterWordCount: number;
  readonly craftId?: string;
}

export interface ShortStoryCreationInput {
  readonly direction: string;
  readonly chapterWordCount: number;
  readonly craftId?: string;
}

export function buildLongStoryCreationAction(input: LongStoryCreationInput): {
  readonly instruction: string;
  readonly requestedIntent: "create_book";
  readonly actionPayload: ActionPayload;
} {
  const title = input.title.trim();
  const genre = input.genre.trim();
  const direction = input.direction.trim();
  return {
    instruction: [
      `创建长篇故事《${title}》`,
      `题材：${genre}`,
      `故事方向：${direction}`,
      input.craftId ? "使用所选写作模式生成基础设定，并将模式绑定到书籍。" : "不使用额外写作模式。",
    ].join("\n"),
    requestedIntent: "create_book",
    actionPayload: {
      createBook: {
        title,
        genre,
        platform: input.platform ?? "qidian",
        language: input.language,
        targetChapters: LONG_STORY_CHAPTERS,
        chapterWordCount: input.chapterWordCount,
        quick: true,
        ...(input.craftId ? { craftId: input.craftId } : {}),
      },
    },
  };
}

export function buildShortStoryCreationAction(input: ShortStoryCreationInput): {
  readonly instruction: string;
  readonly requestedIntent: "short_run";
  readonly actionPayload: ActionPayload;
} {
  const direction = input.direction.trim();
  return {
    instruction: `生成短篇故事：${direction}${input.craftId ? "，使用所选写作模式提取的世界观、故事大纲和写作手法进行原创仿写，重新设计人物、地点、因果链与结局，不复制原作。" : "。"}`,
    requestedIntent: "short_run",
    actionPayload: {
      shortRun: {
        direction,
        chapters: SHORT_STORY_CHAPTERS,
        charsPerChapter: input.chapterWordCount,
        cover: false,
        quick: true,
        ...(input.craftId ? { craftId: input.craftId } : {}),
      },
    },
  };
}
