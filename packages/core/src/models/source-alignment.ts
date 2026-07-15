export type SourceFileKey = "commentaryVideo" | "sourceVideo";

export type SourceMatchStatus = "suggested" | "confirmed" | "rejected";

export interface SourceScene {
  readonly id: string;
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly thumbnailFile: string;
  readonly visualSummary: string;
  readonly ocrText?: string;
}

export interface SourceTimeline {
  readonly version: 1;
  readonly sourceFileKey: "sourceVideo";
  readonly durationSeconds: number;
  readonly scenes: ReadonlyArray<SourceScene>;
}

export interface NarrationAnchor {
  readonly id: string;
  readonly commentaryStartSeconds: number;
  readonly commentaryEndSeconds: number;
  readonly text: string;
  readonly beatOrder?: number;
}

export interface SourceMatch {
  readonly id: string;
  readonly anchorId: string;
  readonly sceneId: string;
  readonly sourceStartSeconds: number;
  readonly sourceEndSeconds: number;
  readonly confidence: number;
  readonly reason: string;
  readonly status: SourceMatchStatus;
}

export interface SourceSegmentRef {
  readonly matchId: string;
  readonly sourceFileKey: "sourceVideo";
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly status: "confirmed";
}

export type SourceSegmentValidation = { readonly ok: true } | { readonly ok: false; readonly reason: string };

export function validateSourceSegmentRef(ref: unknown, durationSeconds: number): SourceSegmentValidation {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return { ok: false, reason: "durationSeconds must be a positive finite number" };
  }
  if (!isRecord(ref)) {
    return { ok: false, reason: "source segment reference must be an object" };
  }
  if (typeof ref.matchId !== "string" || ref.matchId.trim().length === 0) {
    return { ok: false, reason: "matchId is required" };
  }
  if (ref.sourceFileKey !== "sourceVideo") {
    return { ok: false, reason: "source segment must reference the original source video" };
  }
  if (ref.status !== "confirmed") {
    return { ok: false, reason: "source segment must be confirmed before use" };
  }
  const startSeconds = ref.startSeconds;
  const endSeconds = ref.endSeconds;
  if (typeof startSeconds !== "number" || typeof endSeconds !== "number" || !Number.isFinite(startSeconds) || !Number.isFinite(endSeconds)) {
    return { ok: false, reason: "source segment range must contain finite numbers" };
  }
  if (startSeconds < 0 || endSeconds > durationSeconds || startSeconds >= endSeconds) {
    return { ok: false, reason: "source segment range is outside the original video" };
  }
  return { ok: true };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
