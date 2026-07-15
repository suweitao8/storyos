import type { ActionPayload } from "@actalk/inkos-core";
import type { StorySeed } from "@actalk/inkos-core";
import type { CraftMode } from "@actalk/inkos-core/models/craft-profile";
import {
  serializeStorySeed,
  type StorySeedGenerationStatus,
} from "./story-seed-stream";

export const LONG_STORY_CHAPTERS = 10;
export const SHORT_STORY_CHAPTERS = 1;
export const STORY_WORD_COUNT_STEP = 5_000;
export const STORY_WORD_COUNT_OPTIONS = [5_000, 10_000, 15_000, 20_000, 25_000, 30_000] as const;

export function normalizeStoryWordCount(value: number): number {
  return Math.max(STORY_WORD_COUNT_STEP, Math.round(value / STORY_WORD_COUNT_STEP) * STORY_WORD_COUNT_STEP);
}

export function buildStoryWordCountOptions(recommendedWordCount?: number): number[] {
  return Array.from(new Set([
    ...STORY_WORD_COUNT_OPTIONS,
    ...(recommendedWordCount && recommendedWordCount > 0 ? [normalizeStoryWordCount(recommendedWordCount)] : []),
  ])).sort((left, right) => left - right);
}

export function resolveDefaultStoryWordCount(recommendedWordCount?: number): number {
  return recommendedWordCount && recommendedWordCount > 0 ? normalizeStoryWordCount(recommendedWordCount) : 10_000;
}

export function formatStoryWordCount(value: number, language: "zh" | "en"): string {
  const count = Math.max(0, Math.round(value));
  if (language === "en") return `${count.toLocaleString("en-US")} words`;
  if (count > 0 && count % 10_000 === 0) return `${count / 10_000}万字`;
  return `${count.toLocaleString("en-US")}字`;
}

export interface CraftOption {
  readonly id: string;
  readonly sourceName: string;
  readonly mode?: CraftMode;
  readonly sourceType?: "bilibili" | "novel";
  readonly recommendedWordCount?: number;
  readonly storySeed?: StorySeed;
  readonly storySeedStatus?: "pending" | "ready" | "error";
  readonly storySeedError?: string;
  readonly storySeedGenerationId?: string;
  readonly storySeedScore?: number;
  readonly storySeedScoreNote?: string;
  readonly storySeedScoreStatus?: "pending" | "ready" | "error";
  readonly storySeedScoreError?: string;
}

export type StoryCraftMode = Extract<CraftMode, "bilibili-short-story" | "bilibili-commentary">;

function normalizeStoryCraftMode(mode: CraftMode | undefined): StoryCraftMode | undefined {
  if (mode === "bilibili-review") return "bilibili-commentary";
  return mode === "bilibili-short-story" || mode === "bilibili-commentary" ? mode : undefined;
}

export function filterCraftOptionsForStoryKind(
  kind: "long" | "short",
  crafts: ReadonlyArray<CraftOption>,
  requiredCraftMode?: StoryCraftMode,
): ReadonlyArray<CraftOption> {
  return kind === "short"
    ? crafts.filter((craft) => normalizeStoryCraftMode(craft.mode) === (requiredCraftMode ?? "bilibili-short-story") && craft.sourceType === "bilibili")
    : crafts;
}

export function resolveDefaultCreationCraftId(
  crafts: ReadonlyArray<CraftOption>,
  recentCraftId: string | null | undefined,
): string {
  if (recentCraftId && crafts.some((craft) => craft.id === recentCraftId)) return recentCraftId;
  return crafts[0]?.id ?? "";
}

export function shouldAutoGenerateShortStorySeed(storySeed?: StorySeed): boolean {
  void storySeed;
  return false;
}

export function resolveStorySeedGenerationStatus(craft?: CraftOption): StorySeedGenerationStatus {
  if (craft?.storySeedStatus === "pending") return "generating";
  if (craft?.storySeedStatus === "error") return "error";
  if (craft?.storySeed) return "ready";
  return "idle";
}

export function isStorySeedReadyForCreation(craft?: CraftOption): boolean {
  return resolveStorySeedGenerationStatus(craft) === "ready"
    && craft?.storySeedScoreStatus !== "pending"
    && craft?.storySeedScoreStatus !== "error";
}

export function buildDefaultStoryDirection(
  craft: CraftOption,
  kind: "long" | "short",
  isZh: boolean,
): string {
  if (craft.storySeed) {
    return serializeStorySeed(craft.storySeed, isZh ? "zh" : "en");
  }

  if (normalizeStoryCraftMode(craft.mode) === "bilibili-commentary") {
    return isZh
      ? `参考这条 B 站影视解说提取出的悬念、剧情骨架、反转和节奏，先创作一个全新的原创电影或故事，再用影视解说的角度讲述它，形成一个${kind === "long" ? "原创长篇故事" : "原创短篇故事"}并最终制作成视频。影视解说只提供结构参考，不要继续解说原电影；必须重新设计人物、场景、因果链和结局，不得复制原影视作品或解说内容。`
      : `Use the selected Bilibili commentary's plot skeleton, reversals, and pacing as structural reference to create a completely original ${kind === "long" ? "long-form story" : "short story"}. Redesign the characters, setting, causal chain, and ending; do not copy the film, series, or commentary.`;
  }

  if (craft.mode === "bilibili-short-story") {
    return isZh
      ? `参考这条 B 站短篇故事提取出的钩子、推进、反转和结尾节奏，创作一个${kind === "long" ? "原创长篇故事" : "原创短篇故事"}。重新设计人物、场景、因果链和结局，不得复制参考视频的人物、情节、措辞或场景。`
      : `Use the selected Bilibili short story's hook, progression, reversals, and ending rhythm as reference to create a completely original ${kind === "long" ? "long-form story" : "short story"}. Redesign the characters, setting, causal chain, and ending; do not copy the reference video's characters, plot, wording, or scenes.`;
  }

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
  readonly requiredCraftMode?: StoryCraftMode;
  readonly quality?: "standard" | "quick";
}

export interface StoryDirectionGenerationInput {
  readonly craftId: string;
  readonly kind: "long" | "short";
  readonly language: "zh" | "en";
  readonly previousDirection?: string;
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
      `创建长篇小说《${title}》`,
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
  if (!input.craftId) {
    throw new Error("短篇故事必须选择短篇故事写作模式。");
  }
  const requiredCraftMode = input.requiredCraftMode ?? "bilibili-short-story";
  return {
    instruction: `生成短篇故事：${direction}，使用所选写作模式的原创化改编方案和节奏功能作为参考，重新设计故事空间、身份、关系、因果链、关键事件与结局，不复制原作，并继续生成对应剧本和视频制作资产。`,
    requestedIntent: "short_run",
    actionPayload: {
      shortRun: {
        direction,
        chapters: SHORT_STORY_CHAPTERS,
        charsPerChapter: input.chapterWordCount,
        cover: false,
        quick: input.quality === "quick",
        craftId: input.craftId,
        requiredCraftMode,
      },
    },
  };
}
