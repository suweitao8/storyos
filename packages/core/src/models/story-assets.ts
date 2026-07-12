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
  kind: string;
  name: string;
  summary?: string;
  details?: Record<string, string>;
  imagePrompt?: string;
  sourceRefs?: string[];
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

function normalizeKindLookupKey(kind: string): string {
  return kind.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => readString(item).trim())
    .filter((item) => item.length > 0);
}

function readDetails(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const details: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    const cleanKey = key.trim();
    if (!cleanKey) {
      continue;
    }
    const cleanValue = readString(item).trim();
    if (!cleanValue) {
      continue;
    }
    details[cleanKey] = cleanValue;
  }

  return details;
}

function normalizeAssetKey(kind: StoryAssetKind, name: string): string {
  return `${kind}::${name}`;
}

function createStoryAssetId(kind: StoryAssetKind, name: string): string {
  const safeName = name
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_");
  return `${kind}_${safeName}`;
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

function cloneReadyImage(image: StoryAssetImage): StoryAssetImage {
  return {
    status: image.status,
    path: image.path,
    error: image.error,
    generatedAt: image.generatedAt,
  };
}

function normalizeManifestAsset(asset: StoryAsset, updatedAt: string): StoryAsset {
  return {
    ...asset,
    name: normalizeStoryAssetName(asset.name),
    details: readDetails(asset.details),
    sourceRefs: readStringArray(asset.sourceRefs),
    image: cloneReadyImage(asset.image),
    updatedAt,
  };
}

function draftToStoryAsset(
  draft: StoryAssetDraft,
  existing: StoryAsset | undefined,
  updatedAt: string,
): StoryAsset | undefined {
  const kind = normalizeStoryAssetKind(draft.kind);
  if (!kind) {
    return undefined;
  }

  const name = normalizeStoryAssetName(draft.name);
  const previous = existing && normalizeAssetKey(existing.kind, existing.name) === normalizeAssetKey(kind, name)
    ? existing
    : undefined;
  const image: StoryAssetImage = previous?.image.status === "ready"
    ? cloneReadyImage(previous.image)
    : previous
      ? cloneReadyImage(previous.image)
      : { status: "missing" };
  const createdAt = previous?.createdAt ?? updatedAt;

  return {
    id: previous?.id ?? createStoryAssetId(kind, name),
    kind,
    name,
    summary: readString(draft.summary).trim() || previous?.summary || "",
    details: readDetails(draft.details) || previous?.details || {},
    imagePrompt: readString(draft.imagePrompt).trim() || previous?.imagePrompt || "",
    sourceRefs: readStringArray(draft.sourceRefs) || previous?.sourceRefs || [],
    image,
    createdAt,
    updatedAt,
  };
}

export function mergeStoryAssets(
  manifest: StoryAssetManifest,
  drafts: readonly StoryAssetDraft[],
  updatedAt = new Date().toISOString(),
): StoryAssetManifest {
  const assetsByKey = new Map<string, StoryAsset>();
  const orderedKeys: string[] = [];

  for (const asset of manifest.assets) {
    const normalized = normalizeManifestAsset(asset, asset.updatedAt ?? updatedAt);
    const key = normalizeAssetKey(normalized.kind, normalized.name);
    if (!assetsByKey.has(key)) {
      orderedKeys.push(key);
    }
    assetsByKey.set(key, normalized);
  }

  for (const draft of drafts) {
    const next = draftToStoryAsset(draft, assetsByKey.get(normalizeAssetKey(
      normalizeStoryAssetKind(draft.kind) ?? "character",
      (() => {
        try {
          return normalizeStoryAssetName(draft.name);
        } catch {
          return "";
        }
      })(),
    )), updatedAt);

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
    storyId: manifest.storyId,
    updatedAt,
    assets: orderedKeys.map((key) => assetsByKey.get(key)).filter((asset): asset is StoryAsset => Boolean(asset)),
  };
}
