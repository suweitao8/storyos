import type { ActionPayload, StorySeed } from "@actalk/inkos-core";
import { STORY_SEED_MIN_CREATION_SCORE } from "../../../core/src/models/story-seed-constants";
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
  readonly deletedAt?: string;
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
  const activeCrafts = crafts.filter((craft) => !craft.deletedAt);
  return kind === "short"
    ? activeCrafts.filter((craft) => normalizeStoryCraftMode(craft.mode) === (requiredCraftMode ?? "bilibili-short-story") && craft.sourceType === "bilibili")
    : activeCrafts;
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
  if (resolveStorySeedGenerationStatus(craft) !== "ready") return false;
  // Scoring remains non-blocking while pending, but a completed score below
  // the creation threshold must not send a known-bad contract downstream.
  return !(craft?.storySeedScoreStatus === "ready"
    && typeof craft.storySeedScore === "number"
    && craft.storySeedScore < STORY_SEED_MIN_CREATION_SCORE);
}

export function isStoryFoundationReadyForCreation(
  kind: "long" | "short",
  craft?: CraftOption,
): boolean {
  // Long-form stories may use the default rules when no craft is selected;
  // once a craft is selected, its persisted foundation is part of the input
  // contract just like it is for short stories.
  return kind === "long" && !craft ? true : isStorySeedReadyForCreation(craft);
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
    return `Create a completely original ${kind === "long" ? "long-form" : "short"} story that preserves the selected craft's explicit genre, era, reality level, emotional promise, pacing, viewpoint, conflict escalation, and chapter hooks. Do not introduce science fiction, future technology, AI, or other unsupported unrealistic mechanisms, and do not copy the reference work's characters, plot, wording, or scenes.`;
  }

  return `参考已选写作模式明确的题材、时代、现实层级和情绪承诺，以及叙事节奏、视角安排、冲突升级和章节钩子，创作一个完全原创的${kind === "long" ? "长篇" : "短篇"}故事。不得无依据加入科幻、未来科技、人工智能或其他不现实设定，不得复制参考作品的人物、情节、措辞或场景。`;
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
        // Long-form creation should keep the foundation review enabled. The UI
        // already lets the generation run in the background, so skipping this
        // quality gate only trades away consistency for a wait-time that the
        // user does not need to sit through.
        quick: false,
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
