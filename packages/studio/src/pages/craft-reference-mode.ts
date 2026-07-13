import type { CraftMode } from "@actalk/inkos-core/models/craft-profile";

export type CraftSourceType = "bilibili" | "novel";

export const CRAFT_SOURCE_TYPES: ReadonlyArray<{ value: CraftSourceType; label: string }> = [
  { value: "novel", label: "小说" },
  { value: "bilibili", label: "B站视频" },
];

export const CRAFT_VIDEO_MODES: ReadonlyArray<{
  value: Extract<CraftMode, "bilibili-short-story" | "bilibili-commentary">;
  label: string;
}> = [
  { value: "bilibili-short-story", label: "B站短篇故事" },
  { value: "bilibili-commentary", label: "B站影视解说" },
];

export function craftSourceTypeLabel(sourceType: CraftSourceType | undefined): string {
  if (sourceType === "bilibili") return "B站视频";
  if (sourceType === "novel") return "小说";
  return "来源未记录";
}

export function craftModeLabel(mode: CraftMode | undefined, sourceType?: CraftSourceType): string {
  if (mode === "bilibili-short-story") return "B站短篇故事";
  if (mode === "bilibili-commentary") return "B站影视解说";
  if (sourceType) return craftSourceTypeLabel(sourceType);
  return "";
}

export function craftModeDescription(mode: CraftMode, sourceType: CraftSourceType): string {
  if (mode === "bilibili-short-story") return "提取 B 站短篇故事的钩子、推进、反转和结尾节奏";
  if (mode === "bilibili-commentary") return "提取影视解说的剧情压缩和节奏，用于改编原创短篇故事";
  if (sourceType === "bilibili") return "提取视频的剧情节奏和情绪结构";
  return "提取小说的结构、场景节奏、信息释放与叙事视角";
}
