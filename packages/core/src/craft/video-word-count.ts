import type { CraftMode, CraftWordCountEstimate } from "../models/craft-profile.js";

function roundToHundred(value: number): number {
  return Math.max(1000, Math.round(value / 100) * 100);
}

function countSourceCharacters(text: string): number {
  const withoutTimestamps = text
    .replace(/\[\s*\d+(?:\.\d+)?\s*s\s*\]/giu, " ")
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/gu, " ");
  return withoutTimestamps.match(/[\p{Script=Han}\p{L}\p{N}]/gu)?.length ?? 0;
}

/**
 * Estimate the prose length needed to adapt a timestamped video into a novel.
 * Spoken subtitles are expanded to cover scene action, setting, interiority,
 * and transitions while keeping the estimate transparent and deterministic.
 */
export function estimateVideoNovelWordCount(
  text: string,
  mode: CraftMode = "general",
  sourceDurationSeconds?: number,
  language: "zh" | "en" = "zh",
): CraftWordCountEstimate {
  const sourceCharacterCount = countSourceCharacters(text);
  const duration = Number.isFinite(sourceDurationSeconds) && sourceDurationSeconds && sourceDurationSeconds > 0
    ? sourceDurationSeconds
    : undefined;
  const durationFallback = duration ? duration / 60 * (language === "zh" ? 260 : 180) : 0;
  const sourceBasis = Math.max(sourceCharacterCount, Math.round(durationFallback));
  const expansionRatio = mode === "ghost-story" ? 1.55 : 1.45;
  const min = roundToHundred(Math.max(1000, sourceBasis * 1.2));
  const max = roundToHundred(Math.max(min, sourceBasis * 1.8));
  const recommended = Math.min(max, Math.max(min, roundToHundred(sourceBasis * expansionRatio)));
  const durationText = duration ? `，视频时长约 ${Math.round(duration / 60)} 分钟` : "";
  const rationale = language === "zh"
    ? `根据字幕有效字数约 ${sourceCharacterCount.toLocaleString()} 字${durationText}，按补充场景、动作、心理和转场后的 ${expansionRatio.toFixed(2)} 倍叙事展开估算。`
    : `Based on about ${sourceCharacterCount.toLocaleString()} source characters${duration ? ` and a ${Math.round(duration / 60)}-minute video` : ""}, expanded ${expansionRatio.toFixed(2)}x for scene action, setting, interiority, and transitions.`;

  return {
    recommended,
    min,
    max,
    sourceCharacterCount,
    ...(duration ? { sourceDurationSeconds: duration } : {}),
    rationale,
  };
}
