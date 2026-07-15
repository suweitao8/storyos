import type { StorySeed } from "@actalk/inkos-core";

export const STORY_SEED_SECTION_DEFINITIONS = [
  { key: "title", zh: "故事名称", en: "Story title" },
  { key: "genreTone", zh: "类型与风格", en: "Genre and tone" },
  { key: "hook", zh: "一句话简介", en: "One-line summary" },
  { key: "worldview", zh: "世界设定", en: "World and rules" },
  { key: "characters", zh: "角色介绍", en: "Characters" },
  { key: "conflict", zh: "主要矛盾与代价", en: "Main conflict and stakes" },
  { key: "outline", zh: "故事大纲", en: "Story outline" },
  { key: "reversals", zh: "关键转折与伏笔", en: "Key twists and payoffs" },
  { key: "ending", zh: "结局", en: "Ending" },
  { key: "visualAudioMotifs", zh: "画面与氛围", en: "Visuals and mood" },
  { key: "originalizationPlan", zh: "原创要点", en: "Originality notes" },
] as const;

export function serializeStorySeed(seed: StorySeed, language: "zh" | "en" = "zh"): string {
  return STORY_SEED_SECTION_DEFINITIONS
    .map((definition) => {
      const value = seed[definition.key];
      if (!value?.trim()) return null;
      return `## ${language === "en" ? definition.en : definition.zh}\n${value}`;
    })
    .filter((section): section is string => section !== null)
    .join("\n\n");
}

export interface StorySeedGenerationInput {
  readonly craftId?: string;
  readonly kind: "short";
  readonly language: "zh" | "en";
  readonly previousDirection?: string;
}

export interface QueuedStorySeedGeneration {
  readonly craftId: string;
  readonly status: "pending" | "ready" | "error";
}

export type StorySeedGenerationStatus = "idle" | "generating" | "ready" | "error";

export type StorySeedStreamEventName = "start" | "delta" | "complete" | "error";

export interface StorySeedStreamEvent {
  readonly event: StorySeedStreamEventName;
  readonly data: Record<string, unknown>;
}

export type StorySeedStreamHandler = (event: StorySeedStreamEvent) => void;

export function parseStorySeedStreamEvent(block: string): StorySeedStreamEvent | null {
  let event: string | null = null;
  const dataLines: string[] = [];

  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  if (!event || !["start", "delta", "complete", "error"].includes(event) || dataLines.length === 0) {
    return null;
  }

  try {
    const data = JSON.parse(dataLines.join("\n")) as unknown;
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    return { event: event as StorySeedStreamEventName, data: data as Record<string, unknown> };
  } catch {
    return null;
  }
}

function storySeedStreamPath(input: StorySeedGenerationInput): string {
  return input.craftId
    ? `/api/v1/crafts/${encodeURIComponent(input.craftId)}/story-direction/stream`
    : "/api/v1/story-direction/stream";
}

export async function queueStorySeedGeneration(
  input: StorySeedGenerationInput,
  fetchImpl: typeof fetch = fetch,
): Promise<QueuedStorySeedGeneration> {
  if (!input.craftId) {
    throw new Error("A writing mode is required to generate a story foundation in the background");
  }

  const response = await fetchImpl(`/api/v1/crafts/${encodeURIComponent(input.craftId)}/story-seed/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Story seed generation failed (${response.status})`);
  }

  const payload = await response.json() as { craftId?: unknown; status?: unknown };
  const craftId = typeof payload.craftId === "string" ? payload.craftId : input.craftId;
  const status = payload.status;
  if (status !== "pending" && status !== "ready" && status !== "error") {
    throw new Error("Story seed generation returned an invalid status");
  }
  return { craftId, status };
}

export async function streamStorySeed(
  input: StorySeedGenerationInput,
  onEvent: StorySeedStreamHandler,
  fetchImpl: typeof fetch = fetch,
): Promise<StorySeed> {
  const response = await fetchImpl(storySeedStreamPath(input), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Story seed generation failed (${response.status})`);
  }
  if (!response.body) {
    throw new Error("Story seed generation returned no stream");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let candidate: StorySeed | null = null;

  const dispatch = (block: string) => {
    const event = parseStorySeedStreamEvent(block);
    if (!event) return;
    onEvent(event);
    if (event.event === "complete" && event.data.seed && typeof event.data.seed === "object") {
      candidate = event.data.seed as StorySeed;
    }
    if (event.event === "error") {
      const message = typeof event.data.message === "string" ? event.data.message : "Story seed generation failed";
      throw new Error(message);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? "";
    for (const block of blocks) dispatch(block);
    if (done) break;
  }
  if (buffer.trim()) dispatch(buffer);

  if (!candidate) {
    throw new Error("Story seed generation completed without a candidate");
  }
  return candidate;
}
