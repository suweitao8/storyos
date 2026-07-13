import type { CraftMode, CraftWordCountEstimate } from "../models/craft-profile.js";

function roundToThousand(value: number): number {
  return Math.max(1000, Math.round(value / 1000) * 1000);
}

function countSourceCharacters(text: string): number {
  const withoutTimestamps = text
    .replace(/\[\s*\d+(?:\.\d+)?\s*s\s*\]/giu, " ")
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/gu, " ");
  return withoutTimestamps.match(/[\p{Script=Han}\p{L}\p{N}]/gu)?.length ?? 0;
}

/**
 * Estimate the prose length needed to adapt a timestamped video into a novel.
 * The source length is used as the target rather than being expanded by a
 * fixed multiplier. The reference video controls rhythm and density; it is
 * not silently turned into a longer adaptation.
 */
export function estimateVideoNovelWordCount(
  text: string,
  _mode: CraftMode = "general",
  sourceDurationSeconds?: number,
  language: "zh" | "en" = "zh",
): CraftWordCountEstimate {
  const sourceCharacterCount = countSourceCharacters(text);
  const duration = Number.isFinite(sourceDurationSeconds) && sourceDurationSeconds && sourceDurationSeconds > 0
    ? sourceDurationSeconds
    : undefined;
  const durationFallback = duration ? duration / 60 * (language === "zh" ? 260 : 180) : 0;
  const sourceBasis = sourceCharacterCount > 0
    ? sourceCharacterCount
    : Math.round(durationFallback);
  const recommended = roundToThousand(Math.max(1000, sourceBasis));
  const durationText = duration ? `，视频时长约 ${Math.round(duration / 60)} 分钟` : "";
  const basisText = sourceCharacterCount > 0
    ? `根据字幕有效字数约 ${sourceCharacterCount.toLocaleString()} 字${durationText}`
    : `字幕没有有效字数，按${durationText ? durationText.slice(1) : "视频内容"}估算`;
  const rationale = language === "zh"
    ? `${basisText}，不额外使用扩写倍率；目标字数按千字四舍五入，用于控制原创短篇篇幅，实际情节以完整节奏为准。`
    : `${sourceCharacterCount > 0 ? `Based on about ${sourceCharacterCount.toLocaleString()} source characters${duration ? ` and a ${Math.round(duration / 60)}-minute video` : ""}` : "Estimated from the video duration because no usable subtitles were found"}. No expansion multiplier is applied; the target is rounded to the nearest thousand for the original short story.`;

  return {
    recommended,
    sourceCharacterCount,
    ...(duration ? { sourceDurationSeconds: duration } : {}),
    rationale,
  };
}
