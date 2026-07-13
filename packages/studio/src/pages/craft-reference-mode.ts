import type { CraftMode } from "@actalk/inkos-core/models/craft-profile";

export type CraftSourceType = "bilibili" | "novel";

export const CRAFT_SOURCE_TYPES: ReadonlyArray<{ value: CraftSourceType; label: string }> = [
  { value: "bilibili", label: "视频解析" },
  { value: "novel", label: "小说解析" },
];

export function craftSourceTypeLabel(sourceType: CraftSourceType | undefined): string {
  if (sourceType === "bilibili") return "视频解析";
  if (sourceType === "novel") return "小说解析";
  return "来源未记录";
}

export function craftModeLabel(_mode: CraftMode | undefined, sourceType?: CraftSourceType): string {
  if (sourceType) return craftSourceTypeLabel(sourceType);
  return "";
}

export function craftModeDescription(_mode: CraftMode, sourceType: CraftSourceType): string {
  if (sourceType === "bilibili") return "提取视频的剧情节奏和情绪结构";
  return "提取小说的结构、场景节奏、信息释放与叙事视角";
}
