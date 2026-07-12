import type { ActionPayload } from "@actalk/inkos-core";

export const LONG_STORY_CHAPTERS = 10;
export const SHORT_STORY_CHAPTERS = 1;
export const STORY_WORD_COUNT_OPTIONS = [1_000, 2_000, 5_000, 10_000] as const;

export interface CraftOption {
  readonly id: string;
  readonly sourceName: string;
  readonly mode?: "general" | "ghost-story";
}

export interface LongStoryCreationInput {
  readonly title: string;
  readonly genre: string;
  readonly direction: string;
  readonly platform: "tomato" | "qidian" | "feilu" | "other";
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
        platform: input.platform,
        language: input.language,
        targetChapters: LONG_STORY_CHAPTERS,
        chapterWordCount: input.chapterWordCount,
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
    instruction: `生成短篇故事：${direction}${input.craftId ? "，使用所选写作模式进行原创仿写。" : "。"}`,
    requestedIntent: "short_run",
    actionPayload: {
      shortRun: {
        direction,
        chapters: SHORT_STORY_CHAPTERS,
        charsPerChapter: input.chapterWordCount,
        cover: false,
        ...(input.craftId ? { craftId: input.craftId } : {}),
      },
    },
  };
}
