import type { LLMMessage, LLMImagePart, LLMTextPart } from "@actalk/inkos-core";
import type { NarrationAnchor, SourceMatch } from "@actalk/inkos-core";

export interface SourceAlignmentCandidate {
  readonly id: string;
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly thumbnailDataUrl: string;
  readonly visualSummary?: string;
}

export interface SubtitleForAlignment {
  readonly from: number;
  readonly to: number;
  readonly content: string;
}

export interface SourceAlignmentMessageInput {
  readonly anchor: NarrationAnchor;
  readonly candidates: ReadonlyArray<SourceAlignmentCandidate>;
}

export interface ParsedSourceMatch {
  readonly sceneId: string;
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly confidence: number;
  readonly reason: string;
}

const MAX_ANCHOR_CHARS = 180;
const MAX_SUBTITLE_GAP_SECONDS = 1.2;

export function groupNarrationAnchors(entries: ReadonlyArray<SubtitleForAlignment>): NarrationAnchor[] {
  const sorted = entries
    .filter((entry) => Number.isFinite(entry.from) && Number.isFinite(entry.to) && entry.to > entry.from && entry.content.trim())
    .map((entry) => ({ ...entry, content: entry.content.trim() }))
    .sort((a, b) => a.from - b.from);
  const anchors: NarrationAnchor[] = [];
  for (const entry of sorted) {
    const previous = anchors.at(-1);
    const combinedText = previous ? `${previous.text} ${entry.content}` : entry.content;
    if (previous && entry.from - previous.commentaryEndSeconds <= MAX_SUBTITLE_GAP_SECONDS && combinedText.length <= MAX_ANCHOR_CHARS) {
      anchors[anchors.length - 1] = {
        ...previous,
        commentaryEndSeconds: entry.to,
        text: combinedText,
      };
      continue;
    }
    anchors.push({
      id: `anchor-${anchors.length + 1}`,
      commentaryStartSeconds: entry.from,
      commentaryEndSeconds: entry.to,
      text: entry.content,
    });
  }
  return anchors;
}

export function buildSourceAlignmentMessages(input: SourceAlignmentMessageInput): LLMMessage[] {
  if (input.candidates.length === 0) throw new Error("At least one original-film candidate is required");
  const candidateText = input.candidates.map((candidate) => JSON.stringify({
    id: candidate.id,
    startSeconds: candidate.startSeconds,
    endSeconds: candidate.endSeconds,
    visualSummary: candidate.visualSummary ?? "",
  })).join("\n");
  const content: Array<LLMTextPart | LLMImagePart> = [
    {
      type: "text",
      text: [
        "请把解说锚点对应到原片候选画面。候选图片全部来自用户提供的原片，不得使用解说视频画面。",
        "只能选择下面列出的 sceneId，不能编造时间；startSeconds 和 endSeconds 必须落在对应候选窗口内。",
        "如果没有足够证据，返回空 matches。只返回 JSON：{\"matches\":[{\"sceneId\":\"...\",\"startSeconds\":0,\"endSeconds\":1,\"confidence\":0.0,\"reason\":\"...\"}]}。",
        `解说锚点（${input.anchor.commentaryStartSeconds}-${input.anchor.commentaryEndSeconds}s）：${input.anchor.text}`,
        "候选窗口：",
        candidateText,
      ].join("\n"),
    },
  ];
  for (const candidate of input.candidates) {
    assertImageDataUrl(candidate.thumbnailDataUrl);
    content.push({
      type: "text",
      text: `候选 ${candidate.id}（${candidate.startSeconds}-${candidate.endSeconds}s）`,
    });
    content.push({
      type: "image_url",
      image_url: { url: candidate.thumbnailDataUrl, detail: "low" },
    });
  }
  return [
    {
      role: "system",
      content: "你是影视素材对齐助手。你只做候选选择和时间范围校验，不做剧情改写，不从解说视频截图中取材。",
    },
    { role: "user", content },
  ];
}

export function parseSourceMatches(raw: string, candidates: ReadonlyArray<SourceAlignmentCandidate>): ParsedSourceMatch[] {
  const candidateMap = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const parsed = parseJsonObject(raw);
  if (!parsed || !Array.isArray(parsed.matches)) return [];
  const matches: ParsedSourceMatch[] = [];
  for (const item of parsed.matches) {
    if (!isRecord(item)) continue;
    const sceneId = typeof item.sceneId === "string" ? item.sceneId : undefined;
    const startSeconds = item.startSeconds;
    const endSeconds = item.endSeconds;
    const confidence = item.confidence;
    const reason = item.reason;
    const candidate = sceneId ? candidateMap.get(sceneId) : undefined;
    if (!sceneId || !candidate || typeof startSeconds !== "number" || typeof endSeconds !== "number" || typeof confidence !== "number" || typeof reason !== "string") continue;
    if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds) || !Number.isFinite(confidence)) continue;
    if (startSeconds < candidate.startSeconds || endSeconds > candidate.endSeconds || startSeconds >= endSeconds) continue;
    if (confidence < 0 || confidence > 1) continue;
    matches.push({ sceneId, startSeconds, endSeconds, confidence, reason: reason.trim() });
  }
  return matches;
}

export function toSuggestedSourceMatches(anchor: NarrationAnchor, matches: ReadonlyArray<ParsedSourceMatch>): SourceMatch[] {
  return matches.map((match, index) => ({
    id: `${anchor.id}-${match.sceneId}-${index + 1}`,
    anchorId: anchor.id,
    sceneId: match.sceneId,
    sourceStartSeconds: match.startSeconds,
    sourceEndSeconds: match.endSeconds,
    confidence: match.confidence,
    reason: match.reason,
    status: "suggested",
  }));
}

function parseJsonObject(raw: string): Record<string, unknown> | undefined {
  const normalized = raw.trim().replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "");
  try {
    const value: unknown = JSON.parse(normalized);
    return isRecord(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function assertImageDataUrl(value: string): void {
  if (!/^data:image\/(?:jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/u.test(value)) {
    throw new Error("Original-film thumbnails must be base64 image data URLs");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
