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

const STORY_ASSET_KIND_ALIASES = Object.create(null) as Record<string, StoryAssetKind>;
STORY_ASSET_KIND_ALIASES.character = "character";
STORY_ASSET_KIND_ALIASES.char = "character";
STORY_ASSET_KIND_ALIASES.people = "character";
STORY_ASSET_KIND_ALIASES.person = "character";
STORY_ASSET_KIND_ALIASES.人物 = "character";
STORY_ASSET_KIND_ALIASES.角色 = "character";
STORY_ASSET_KIND_ALIASES.人设 = "character";
STORY_ASSET_KIND_ALIASES.scene = "scene";
STORY_ASSET_KIND_ALIASES.scenery = "scene";
STORY_ASSET_KIND_ALIASES.location = "scene";
STORY_ASSET_KIND_ALIASES.place = "scene";
STORY_ASSET_KIND_ALIASES.场景 = "scene";
STORY_ASSET_KIND_ALIASES.地点 = "scene";
STORY_ASSET_KIND_ALIASES.环境 = "scene";
STORY_ASSET_KIND_ALIASES.prop = "prop";
STORY_ASSET_KIND_ALIASES.object = "prop";
STORY_ASSET_KIND_ALIASES.item = "prop";
STORY_ASSET_KIND_ALIASES.物件 = "prop";
STORY_ASSET_KIND_ALIASES.物品 = "prop";
STORY_ASSET_KIND_ALIASES.道具 = "prop";
STORY_ASSET_KIND_ALIASES.器物 = "prop";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeKindLookupKey(kind: string): string {
  return kind.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function hasStoryAssetKindAlias(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(STORY_ASSET_KIND_ALIASES, key);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeOptionalString(value: unknown): string | undefined {
  const cleaned = readString(value).trim();
  return cleaned ? cleaned : undefined;
}

function normalizeRequiredString(value: unknown, label: string): string {
  const cleaned = normalizeOptionalString(value);
  if (!cleaned) {
    throw new Error(`Invalid ${label}.`);
  }

  return cleaned;
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

function normalizeDraftStringField(
  draft: Record<string, unknown>,
  key: "summary" | "imagePrompt",
  existing: StoryAsset | undefined,
): string {
  if (!hasOwn(draft, key)) {
    return existing?.[key] ?? "";
  }

  const raw = draft[key];
  if (raw === null || raw === undefined) {
    return existing?.[key] ?? "";
  }

  if (typeof raw !== "string") {
    return existing?.[key] ?? "";
  }

  return raw.trim();
}

function normalizeDraftDetailsField(
  draft: Record<string, unknown>,
  existing: StoryAsset | undefined,
): Record<string, string> {
  if (!hasOwn(draft, "details")) {
    return existing ? { ...existing.details } : {};
  }

  const raw = draft.details;
  if (raw === null || raw === undefined) {
    return existing ? { ...existing.details } : {};
  }

  if (!isRecord(raw)) {
    return existing ? { ...existing.details } : {};
  }

  return normalizeDetailsValue(raw);
}

function normalizeDraftSourceRefsField(
  draft: Record<string, unknown>,
  existing: StoryAsset | undefined,
): string[] {
  if (!hasOwn(draft, "sourceRefs")) {
    return existing ? [...existing.sourceRefs] : [];
  }

  const raw = draft.sourceRefs;
  if (raw === null || raw === undefined) {
    return existing ? [...existing.sourceRefs] : [];
  }

  if (!Array.isArray(raw)) {
    return existing ? [...existing.sourceRefs] : [];
  }

  return normalizeSourceRefsValue(raw);
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

function createCollisionStoryAssetId(baseId: string, assetKey: string, occurrenceIndex: number): string {
  const digest = createHash("sha1")
    .update(`${baseId}\0${assetKey}\0${occurrenceIndex}`, "utf8")
    .digest("hex")
    .slice(0, 10);
  return `${baseId}__${digest}`;
}

function allocateUniqueStoryAssetId(
  baseId: string,
  assetKey: string,
  occurrenceIndex: number,
  usedIds: Set<string>,
): string {
  if (!usedIds.has(baseId)) {
    usedIds.add(baseId);
    return baseId;
  }

  let candidate = createCollisionStoryAssetId(baseId, assetKey, occurrenceIndex);
  let salt = 1;
  while (usedIds.has(candidate)) {
    candidate = createCollisionStoryAssetId(baseId, `${assetKey}:${salt}`, occurrenceIndex + salt);
    salt += 1;
  }

  usedIds.add(candidate);
  return candidate;
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

  const storyId = normalizeRequiredString(input.storyId, "story asset manifest storyId");
  const updatedAt = normalizeRequiredString(input.updatedAt, "story asset manifest updatedAt");

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
  const summary = normalizeDraftStringField(draft, "summary", existing);
  const imagePrompt = normalizeDraftStringField(draft, "imagePrompt", existing);
  const details = normalizeDraftDetailsField(draft, existing);
  const sourceRefs = normalizeDraftSourceRefsField(draft, existing);

  const image: StoryAssetImage = existing ? cloneStoryAssetImage(existing.image) : { status: "missing" };
  return {
    id: existing?.id ?? createStoryAssetId(kind, name),
    kind,
    name,
    summary,
    details,
    imagePrompt,
    sourceRefs,
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

  const lookup = normalizeKindLookupKey(raw);
  return hasStoryAssetKindAlias(lookup) ? STORY_ASSET_KIND_ALIASES[lookup] : undefined;
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
  const safeStoryId = normalizeRequiredString(storyId, "story asset manifest storyId");
  const safeUpdatedAt = normalizeRequiredString(updatedAt, "story asset manifest updatedAt");
  return {
    version: 1,
    storyId: safeStoryId,
    updatedAt: safeUpdatedAt,
    assets: [],
  };
}

function assignUniqueAssetIds(assets: StoryAsset[]): StoryAsset[] {
  const usedIds = new Set<string>();
  const seenBaseIds = new Map<string, number>();

  return assets.map((asset) => {
    const baseId = normalizeOptionalString(asset.id) ?? createStoryAssetId(asset.kind, asset.name);
    const occurrenceIndex = seenBaseIds.get(baseId) ?? 0;
    seenBaseIds.set(baseId, occurrenceIndex + 1);

    const id = allocateUniqueStoryAssetId(baseId, normalizeAssetKey(asset.kind, asset.name), occurrenceIndex, usedIds);
    return {
      ...asset,
      id,
    };
  });
}

export function mergeStoryAssets(
  manifest: unknown,
  drafts: readonly unknown[],
  updatedAt = new Date().toISOString(),
): StoryAssetManifest {
  const safeUpdatedAt = normalizeRequiredString(updatedAt, "story asset manifest updatedAt");
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
    const next = normalizeDraftAsset(draft, assetsByKey, safeUpdatedAt);
    if (!next) {
      continue;
    }

    const key = normalizeAssetKey(next.kind, next.name);
    if (!assetsByKey.has(key)) {
      orderedKeys.push(key);
    }
    assetsByKey.set(key, next);
  }

  const assets = assignUniqueAssetIds(
    orderedKeys.map((key) => assetsByKey.get(key)).filter((asset): asset is StoryAsset => Boolean(asset)),
  );

  return {
    version: 1,
    storyId: safeManifest.storyId,
    updatedAt: safeUpdatedAt,
    assets,
  };
}
