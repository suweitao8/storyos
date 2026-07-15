import type { ActionPayload } from "@actalk/inkos-core";
import type { CraftMode } from "@actalk/inkos-core/models/craft-profile";

export type VideoCreationType = "film-commentary" | "review-commentary";

export interface VideoCreationInput {
  readonly type: VideoCreationType;
  readonly title: string;
  readonly direction: string;
  readonly craftId: string;
  readonly episodeDuration: string;
  readonly language: "zh" | "en";
}

const VIDEO_CRAFT_MODES: Record<VideoCreationType, Extract<CraftMode, "bilibili-commentary" | "bilibili-review">> = {
  "film-commentary": "bilibili-commentary",
  "review-commentary": "bilibili-review",
};

const VIDEO_LABELS: Record<VideoCreationType, string> = {
  "film-commentary": "影视解说",
  "review-commentary": "评论调侃",
};

export function requiredCraftModeForVideoCreation(type: VideoCreationType): "bilibili-commentary" | "bilibili-review" {
  return VIDEO_CRAFT_MODES[type];
}

export function buildVideoCreationAction(input: VideoCreationInput): {
  readonly instruction: string;
  readonly requestedIntent: "script_create";
  readonly actionPayload: ActionPayload;
} {
  const title = input.title.trim();
  const direction = input.direction.trim();
  const episodeDuration = input.episodeDuration.trim();
  if (!title || !direction || !input.craftId || !episodeDuration) {
    throw new Error("请补齐标题、创作方向、视频时长，并选择对应的写作模式。");
  }

  const label = VIDEO_LABELS[input.type];
  const requiredCraftMode = requiredCraftModeForVideoCreation(input.type);
  const requirements = input.type === "film-commentary"
    ? "以旁白驱动影视解说视频：每段旁白都要对应可见画面、字幕节奏和必要的原片素材提示；不要复述影视解说视频本身的画面处理。"
    : "以轻松、通俗、可传播的评论调侃视频为目标：观点清楚，笑点和吐槽有依据，旁白、画面提示和字幕节奏要能直接用于视频制作。";

  return {
    instruction: [
      `创建${label}视频《${title}》`,
      `创作方向：${direction}`,
      `单条视频时长：${episodeDuration}`,
      `使用对应的${label}写作模式，输出可继续制作的视频脚本。`,
    ].join("\n"),
    requestedIntent: "script_create",
    actionPayload: {
      scriptCreate: {
        title,
        sourceKind: `${label}写作模式`,
        targetFormat: "general_script",
        sourceText: direction,
        requirements,
        episodeCount: 1,
        episodeDuration,
        craftId: input.craftId,
        requiredCraftMode,
        outDir: "dramas",
      },
    },
  };
}
