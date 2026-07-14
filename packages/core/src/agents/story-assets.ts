import type { LLMMessage, LLMResponse } from "../llm/provider.js";
import { normalizeStoryAssetKind, normalizeStoryAssetName, type StoryAssetDraft } from "../models/story-assets.js";

export interface StoryAssetExtractionSource {
  readonly settings: string;
  readonly outline: string;
  readonly content: string;
}

export interface StoryAssetTextModelOptions {
  readonly temperature?: number;
  readonly maxTokens?: number;
}

export type StoryAssetTextModel = (
  messages: ReadonlyArray<LLMMessage>,
  options?: StoryAssetTextModelOptions,
) => Promise<string | Pick<LLMResponse, "content">>;

export const STORY_ASSET_EXTRACTOR_SYSTEM_PROMPT = `你从故事素材中提取可复用的角色、场景、道具资产信息。

只返回 JSON。顶层对象必须包含 characters、scenes、props 三个数组。每个资产对象必须包含 kind、name、summary、details、imagePrompt、sourceRefs 字段。kind 取值 character / scene / prop，也接受中文别名 人物/角色、场景/地点、道具/物件。

只提取在提供的设定、大纲或正文中有依据的实体，不要为了凑数凭空捏造。不要把长段对话或整段正文复制到任何字段里。名称不必是专有名词：当素材中反复出现某个没有正式名字但可复用的实体时，给它一个简短稳定的功能名。把别名放在 aliases 数组里，便于后续合并同一实体的多次引用。sourceRefs 用简短的来源标签（如 settings、outline、content:chapter-1），不要复制原文。

summary 要简洁可复用。把视觉事实放进 details，imagePrompt 写成一段独立的、可直接用于文生图模型的中文视觉描述。不要生成图片，不要返回 JSON 以外的内容。`;

/**
 * Per-kind image prompt guides (each value is a ready-to-use LLM system
 * prompt produced by {@link buildImagePromptGuides}). When provided, the
 * extractor embeds them into its system prompt so the model generates
 * `imagePrompt` values that follow the detailed Chinese visual norms.
 */
export interface StoryAssetImagePromptGuides {
  readonly character: string;
  readonly scene: string;
  readonly prop: string;
}

export interface StoryAssetExtractorOptions {
  readonly imagePromptGuides?: StoryAssetImagePromptGuides;
}

/**
 * Build the system prompt for the extractor. When image prompt guides are
 * provided, they are appended so the LLM generates per-asset `imagePrompt`
 * values that follow the detailed visual norms for each kind.
 */
export function buildExtractorSystemPrompt(guides?: StoryAssetImagePromptGuides): string {
  if (!guides) return STORY_ASSET_EXTRACTOR_SYSTEM_PROMPT;
  return [
    STORY_ASSET_EXTRACTOR_SYSTEM_PROMPT,
    "",
    "## 图片提示词生成规范（imagePrompt 字段）",
    "",
    "为每个资产生成 imagePrompt 时，必须严格按照以下对应类型的规范输出。imagePrompt 应该是一段独立的、可直接用于文生图模型的中文提示词。",
    "",
    "### 角色资产 (character) 的 imagePrompt 规范",
    guides.character,
    "",
    "### 场景资产 (scene) 的 imagePrompt 规范",
    guides.scene,
    "",
    "### 道具资产 (prop) 的 imagePrompt 规范",
    guides.prop,
  ].join("\n");
}

function sourceBlock(label: string, value: string): string {
  const text = typeof value === "string" ? value : "";
  return `## ${label}\n<source>\n${text}\n</source>`;
}

export function buildStoryAssetExtractionPrompt(source: StoryAssetExtractionSource): string {
  return [
    "Extract character, scene, and prop metadata from all three source blocks.",
    "Use the same asset only once when a name and its aliases refer to the same entity.",
    sourceBlock("STORY SETTINGS", source.settings),
    sourceBlock("STORY OUTLINE", source.outline),
    sourceBlock("STORY CONTENT", source.content),
    "Return the JSON object now.",
  ].join("\n\n");
}

export class StoryAssetParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoryAssetParseError";
  }
}

interface InternalDraft {
  kind: "character" | "scene" | "prop";
  name: string;
  aliases: string[];
  summary: string;
  details: Record<string, string>;
  imagePrompt: string;
  sourceRefs: string[];
}

const CATEGORY_KIND_ALIASES: Record<string, "character" | "scene" | "prop"> = {
  character: "character",
  characters: "character",
  people: "character",
  person: "character",
  人物: "character",
  角色: "character",
  scene: "scene",
  scenes: "scene",
  scenery: "scene",
  location: "scene",
  place: "scene",
  场景: "scene",
  地点: "scene",
  环境: "scene",
  prop: "prop",
  props: "prop",
  object: "prop",
  item: "prop",
  道具: "prop",
  物件: "prop",
  物品: "prop",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readText(value: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const text = asText(value[key]);
    if (text) return text;
  }
  return "";
}

function readTextList(value: unknown): string[] {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return values.map(asText).filter(Boolean);
}

function readDetails(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => [key.trim(), asText(item)] as const)
      .filter(([key, item]) => Boolean(key && item)),
  );
}

function normalizeName(value: unknown): string {
  try {
    return normalizeStoryAssetName(value);
  } catch {
    return "";
  }
}

function nameKey(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

function normalizeCategory(value: unknown): "character" | "scene" | "prop" | undefined {
  return normalizeStoryAssetKind(value) ?? (typeof value === "string" ? CATEGORY_KIND_ALIASES[value.trim().toLocaleLowerCase()] : undefined);
}

function parseEntry(value: unknown, categoryKind?: "character" | "scene" | "prop"): InternalDraft | undefined {
  if (!isRecord(value)) return undefined;

  const kind = normalizeCategory(value.kind ?? value.type ?? value.category) ?? categoryKind;
  const name = normalizeName(value.canonicalName ?? value.name ?? value.title ?? value.label);
  if (!kind || !name) return undefined;

  const aliases = readTextList(value.aliases ?? value.alias ?? value.alternateNames)
    .map(normalizeName)
    .filter((alias) => alias && nameKey(alias) !== nameKey(name));

  return {
    kind,
    name,
    aliases,
    summary: readText(value, ["summary", "description", "简介", "摘要"]),
    details: readDetails(value.details ?? value.attributes ?? value.visualDetails ?? value.详细设定),
    imagePrompt: readText(value, ["imagePrompt", "image_prompt", "visualPrompt", "图片提示词", "视觉提示"]),
    sourceRefs: readTextList(value.sourceRefs ?? value.source_refs ?? value.references ?? value.来源),
  };
}

function mergeInternalDraft(target: InternalDraft, incoming: InternalDraft): void {
  if (incoming.name && nameKey(incoming.name) !== nameKey(target.name)) {
    target.aliases = Array.from(new Set([...target.aliases, incoming.name]));
  }
  target.aliases = Array.from(new Set([...target.aliases, ...incoming.aliases]));
  target.summary = incoming.summary || target.summary;
  target.details = { ...target.details, ...incoming.details };
  target.imagePrompt = incoming.imagePrompt || target.imagePrompt;
  target.sourceRefs = Array.from(new Set([...target.sourceRefs, ...incoming.sourceRefs]));
}

function coalesceDrafts(entries: readonly InternalDraft[]): StoryAssetDraft[] {
  const groups: Array<InternalDraft & { active: boolean }> = [];
  const aliases = new Map<string, InternalDraft & { active: boolean }>();

  for (const entry of entries) {
    const keys = [entry.name, ...entry.aliases].map((value) => `${entry.kind}::${nameKey(value)}`);
    const matches = Array.from(new Set(keys.map((key) => aliases.get(key)).filter((group): group is InternalDraft & { active: boolean } => Boolean(group && group.active))));
    const target = matches[0] ?? { ...entry, aliases: [...entry.aliases], active: true };
    if (!matches.length) groups.push(target);
    for (const match of matches.slice(1)) {
      mergeInternalDraft(target, match);
      match.active = false;
    }
    if (matches.length) mergeInternalDraft(target, entry);
    for (const alias of [target.name, ...target.aliases]) {
      aliases.set(`${target.kind}::${nameKey(alias)}`, target);
    }
  }

  return groups.filter((group) => group.active).map(({ active: _active, ...draft }) => draft);
}

function findBalancedJsonCandidates(input: string): string[] {
  const candidates: string[] = [];
  for (let start = 0; start < input.length; start += 1) {
    if (input[start] !== "{" && input[start] !== "[") continue;
    const stack: string[] = [];
    let inString = false;
    let escaped = false;
    for (let index = start; index < input.length; index += 1) {
      const char = input[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') {
        inString = true;
      } else if (char === "{" || char === "[") {
        stack.push(char);
      } else if (char === "}" || char === "]") {
        const expected = char === "}" ? "{" : "[";
        if (stack.pop() !== expected) break;
        if (!stack.length) {
          candidates.push(input.slice(start, index + 1));
          break;
        }
      }
    }
  }
  return candidates;
}

function parseJsonPayload(response: string): unknown {
  const trimmed = response.replace(/^\uFEFF/u, "").trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/iu)?.[1]?.trim();
  const candidates = [fenced ?? trimmed, ...findBalancedJsonCandidates(fenced ?? trimmed)];
  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch (error) {
      lastError = error;
    }
  }
  const detail = lastError instanceof Error ? ` ${lastError.message}` : "";
  throw new StoryAssetParseError(`Failed to parse story asset JSON.${detail}`);
}

function collectEntries(payload: unknown): InternalDraft[] {
  if (Array.isArray(payload)) {
    return payload.map((entry) => parseEntry(entry)).filter((entry): entry is InternalDraft => Boolean(entry));
  }
  if (!isRecord(payload)) {
    throw new StoryAssetParseError("Failed to parse story asset JSON: expected an object or array.");
  }

  const entries: InternalDraft[] = [];
  const direct = parseEntry(payload);
  if (direct) entries.push(direct);
  for (const [key, value] of Object.entries(payload)) {
    const categoryKind = CATEGORY_KIND_ALIASES[key.trim().toLocaleLowerCase()];
    if (!categoryKind || !Array.isArray(value)) continue;
    for (const entry of value) {
      const parsed = parseEntry(entry, categoryKind);
      if (parsed) entries.push(parsed);
    }
  }
  if (Array.isArray(payload.assets)) {
    for (const entry of payload.assets) {
      const parsed = parseEntry(entry);
      if (parsed) entries.push(parsed);
    }
  }
  return entries;
}

export function parseStoryAssetExtractionResponse(response: string): StoryAssetDraft[] {
  if (typeof response !== "string" || !response.trim()) {
    throw new StoryAssetParseError("Failed to parse story asset JSON: model response was empty.");
  }
  return coalesceDrafts(collectEntries(parseJsonPayload(response)));
}

export class StoryAssetExtractorAgent {
  constructor(
    private readonly textModel: StoryAssetTextModel,
    private readonly options?: StoryAssetExtractorOptions,
  ) {}

  async extract(source: StoryAssetExtractionSource): Promise<StoryAssetDraft[]> {
    const systemPrompt = buildExtractorSystemPrompt(this.options?.imagePromptGuides);
    const response = await this.textModel(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: buildStoryAssetExtractionPrompt(source) },
      ],
      { temperature: 0.1, maxTokens: 4096 },
    );
    const content = typeof response === "string" ? response : response.content;
    return parseStoryAssetExtractionResponse(content);
  }
}
