import { createHash } from "node:crypto";

export type StoryAssetKind = "character" | "scene" | "prop";

export type StoryAssetImageStatus = "missing" | "generating" | "ready" | "error";

export interface StoryAssetImage {
  status: StoryAssetImageStatus;
  path?: string;
  error?: string;
  generatedAt?: string;
}

export interface StoryAsset {
  id: string;
  kind: StoryAssetKind;
  name: string;
  summary: string;
  details: Record<string, string>;
  imagePrompt: string;
  sourceRefs: string[];
  image: StoryAssetImage;
  createdAt: string;
  updatedAt: string;
}

export interface StoryAssetDraft {
  kind: unknown;
  name: unknown;
  summary?: unknown;
  details?: unknown;
  imagePrompt?: unknown;
  sourceRefs?: unknown;
}

export interface StoryAssetManifest {
  version: 1;
  storyId: string;
  updatedAt: string;
  assets: StoryAsset[];
}

const STORY_ASSET_KIND_ALIASES: Readonly<Record<string, StoryAssetKind>> = {
  character: "character",
  char: "character",
  people: "character",
  person: "character",
  人物: "character",
  角色: "character",
  人设: "character",
  scene: "scene",
  scenery: "scene",
  location: "scene",
  place: "scene",
  场景: "scene",
  地点: "scene",
  环境: "scene",
  prop: "prop",
  object: "prop",
  item: "prop",
  物件: "prop",
  物品: "prop",
  道具: "prop",
  器物: "prop",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeKindLookupKey(kind: string): string {
  return kind.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeOptionalString(value: unknown): string | undefined {
  const cleaned = readString(value).trim();
  return cleaned ? cleaned : undefined;
}

function normalizeDetailsValue(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  const details: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    const cleanKey = key.trim();
    if (!cleanKey) {
      continue;
    }
    const cleanValue = normalizeOptionalString(item);
    if (!cleanValue) {
      continue;
    }
    details[cleanKey] = cleanValue;
  }

  return details;
}

function normalizeSourceRefsValue(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(normalizeOptionalString).filter((item): item is string => Boolean(item));
}

function normalizeImageValue(value: unknown): StoryAssetImage | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const status = normalizeStoryAssetImageStatus(value.status);
  if (!status) {
    return undefined;
  }

  const image: StoryAssetImage = { status };
  const path = normalizeOptionalString(value.path);
  const error = normalizeOptionalString(value.error);
  const generatedAt = normalizeOptionalString(value.generatedAt);
  if (path) image.path = path;
  if (error) image.error = error;
  if (generatedAt) image.generatedAt = generatedAt;
  return image;
}

function cloneStoryAssetImage(image: StoryAssetImage): StoryAssetImage {
  return {
    status: image.status,
    path: image.path,
    error: image.error,
    generatedAt: image.generatedAt,
  };
}

function cloneStoryAsset(asset: StoryAsset): StoryAsset {
  return {
    ...asset,
    details: { ...asset.details },
    sourceRefs: [...asset.sourceRefs],
    image: cloneStoryAssetImage(asset.image),
  };
}

function normalizeAssetKey(kind: StoryAssetKind, name: string): string {
  return `${kind}::${name}`;
}

function createStoryAssetId(kind: StoryAssetKind, name: string): string {
  const digest = createHash("sha1").update(`${kind}\0${name}`, "utf8").digest("hex").slice(0, 12);
  return `${kind}_${digest}`;
}

function normalizeStoredStoryAsset(value: unknown): StoryAsset | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const kind = normalizeStoryAssetKind(value.kind);
  if (!kind) {
    return undefined;
  }

  let name: string;
  try {
    name = normalizeStoryAssetName(value.name);
  } catch {
    return undefined;
  }

  const image = normalizeImageValue(value.image);
  if (!image) {
    return undefined;
  }

  const id = normalizeOptionalString(value.id) ?? createStoryAssetId(kind, name);
  const summary = normalizeOptionalString(value.summary) ?? "";
  const imagePrompt = normalizeOptionalString(value.imagePrompt) ?? "";
  const createdAt = normalizeOptionalString(value.createdAt);
  const updatedAt = normalizeOptionalString(value.updatedAt);
  if (!createdAt || !updatedAt) {
    return undefined;
  }

  return {
    id,
    kind,
    name,
    summary,
    details: normalizeDetailsValue(value.details),
    imagePrompt,
    sourceRefs: normalizeSourceRefsValue(value.sourceRefs),
    image,
    createdAt,
    updatedAt,
  };
}

function normalizeStoredManifest(input: unknown): StoryAssetManifest {
  if (!isRecord(input)) {
    throw new Error("Invalid story asset manifest.");
  }

  if (input.version !== 1) {
    throw new Error("Invalid story asset manifest version.");
  }

  const storyId = normalizeOptionalString(input.storyId);
  const updatedAt = normalizeOptionalString(input.updatedAt);
  if (!storyId || !updatedAt) {
    throw new Error("Invalid story asset manifest metadata.");
  }

  const assets = Array.isArray(input.assets)
    ? input.assets.flatMap((asset) => {
        const parsed = normalizeStoredStoryAsset(asset);
        return parsed ? [parsed] : [];
      })
    : [];

  return {
    version: 1,
    storyId,
    updatedAt,
    assets,
  };
}

function draftValueOrExisting(
  draft: Record<string, unknown>,
  key: "summary" | "details" | "imagePrompt" | "sourceRefs",
  existing: StoryAsset | undefined,
): unknown {
  if (!hasOwn(draft, key)) {
    switch (key) {
      case "summary":
        return existing?.summary;
      case "details":
        return existing?.details;
      case "imagePrompt":
        return existing?.imagePrompt;
      case "sourceRefs":
        return existing?.sourceRefs;
    }
  }

  return draft[key];
}

function normalizeDraftAsset(
  draft: unknown,
  existingByKey: Map<string, StoryAsset>,
  updatedAt: string,
): StoryAsset | undefined {
  if (!isRecord(draft)) {
    return undefined;
  }

  const kind = normalizeStoryAssetKind(draft.kind);
  if (!kind) {
    return undefined;
  }

  let name: string;
  try {
    name = normalizeStoryAssetName(draft.name);
  } catch {
    return undefined;
  }

  const key = normalizeAssetKey(kind, name);
  const existing = existingByKey.get(key);
  const sourceRefsInput = draftValueOrExisting(draft, "sourceRefs", existing);
  const detailsInput = draftValueOrExisting(draft, "details", existing);
  const summaryInput = draftValueOrExisting(draft, "summary", existing);
  const imagePromptInput = draftValueOrExisting(draft, "imagePrompt", existing);

  const image: StoryAssetImage = existing ? cloneStoryAssetImage(existing.image) : { status: "missing" };
  return {
    id: existing?.id ?? createStoryAssetId(kind, name),
    kind,
    name,
    summary: normalizeOptionalString(summaryInput) ?? "",
    details: isRecord(detailsInput) ? normalizeDetailsValue(detailsInput) : existing?.details ? { ...existing.details } : {},
    imagePrompt: normalizeOptionalString(imagePromptInput) ?? "",
    sourceRefs: Array.isArray(sourceRefsInput)
      ? normalizeSourceRefsValue(sourceRefsInput)
      : existing?.sourceRefs
        ? [...existing.sourceRefs]
        : [],
    image,
    createdAt: existing?.createdAt ?? updatedAt,
    updatedAt,
  };
}

export function normalizeStoryAssetKind(kind: unknown): StoryAssetKind | undefined {
  if (typeof kind !== "string") {
    return undefined;
  }

  const raw = kind.trim();
  if (!raw) {
    return undefined;
  }

  return STORY_ASSET_KIND_ALIASES[normalizeKindLookupKey(raw)];
}

export function normalizeStoryAssetImageStatus(status: unknown): StoryAssetImageStatus | undefined {
  if (typeof status !== "string") {
    return undefined;
  }

  const raw = status.trim();
  if (raw === "missing" || raw === "generating" || raw === "ready" || raw === "error") {
    return raw;
  }

  return undefined;
}

export function normalizeStoryAssetName(name: unknown): string {
  if (typeof name !== "string") {
    throw new Error("Story asset name cannot be empty.");
  }

  const normalized = name.replace(/\s+/g, " ").trim();
  if (!normalized) {
    throw new Error("Story asset name cannot be empty.");
  }

  return normalized;
}

export function createEmptyStoryAssetManifest(
  storyId: string,
  updatedAt = new Date().toISOString(),
): StoryAssetManifest {
  return {
    version: 1,
    storyId,
    updatedAt,
    assets: [],
  };
}

export function mergeStoryAssets(
  manifest: unknown,
  drafts: readonly unknown[],
  updatedAt = new Date().toISOString(),
): StoryAssetManifest {
  const safeManifest = normalizeStoredManifest(manifest);
  const assetsByKey = new Map<string, StoryAsset>();
  const orderedKeys: string[] = [];

  for (const asset of safeManifest.assets) {
    const cloned = cloneStoryAsset(asset);
    const key = normalizeAssetKey(cloned.kind, cloned.name);
    if (!assetsByKey.has(key)) {
      orderedKeys.push(key);
    }
    assetsByKey.set(key, cloned);
  }

  for (const draft of Array.isArray(drafts) ? drafts : []) {
    const next = normalizeDraftAsset(draft, assetsByKey, updatedAt);
    if (!next) {
      continue;
    }

    const key = normalizeAssetKey(next.kind, next.name);
    if (!assetsByKey.has(key)) {
      orderedKeys.push(key);
    }
    assetsByKey.set(key, next);
  }

  return {
    version: 1,
    storyId: safeManifest.storyId,
    updatedAt,
    assets: orderedKeys.map((key) => assetsByKey.get(key)).filter((asset): asset is StoryAsset => Boolean(asset)),
  };
}
