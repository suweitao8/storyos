import type { ActionPayload } from "@actalk/inkos-core";

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
  readonly targetChapters: number;
  readonly chapterWordCount: number;
  readonly craftId?: string;
}

export interface ShortStoryCreationInput {
  readonly direction: string;
  readonly chapters: number;
  readonly charsPerChapter: number;
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
        platform: input.platform,
        language: input.language,
        targetChapters: input.targetChapters,
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
    instruction: `生成短篇小说：${direction}${input.craftId ? "，使用所选写作模式进行原创仿写。" : "。"}`,
    requestedIntent: "short_run",
    actionPayload: {
      shortRun: {
        direction,
        chapters: input.chapters,
        charsPerChapter: input.charsPerChapter,
        cover: false,
        ...(input.craftId ? { craftId: input.craftId } : {}),
      },
    },
  };
}
