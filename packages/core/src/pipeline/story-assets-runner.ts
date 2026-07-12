import { assertSafeBookId } from "../utils/book-id.js";
import {
  createEmptyStoryAssetManifest,
  mergeStoryAssets,
  type StoryAssetDraft,
  type StoryAssetManifest,
} from "../models/story-assets.js";
import {
  StoryAssetExtractorAgent,
  type StoryAssetExtractionSource,
  type StoryAssetTextModel,
} from "../agents/story-assets.js";
import type { StoryAssetImage } from "../models/story-assets.js";

export type StoryAssetStoryType = "book" | "short";
export type StoryAssetStoryTypeInput = StoryAssetStoryType | "long" | "short-fiction";

export interface StoryAssetManifestStore {
  readManifest(path: string): Promise<unknown | null | undefined>;
  writeManifest(path: string, manifest: StoryAssetManifest): Promise<void>;
}

export interface StoryAssetImageRuntime {
  generateImage(prompt: string): Promise<{
    readonly buffer: Uint8Array;
    readonly extension: string;
  }>;
}

export interface StoryAssetFileWriter {
  writeFile(path: string, data: Uint8Array): Promise<void>;
}

export type StoryAssetClock = () => string;

export type StoryAssetImageGenerationStatus = "ready" | "error" | "skipped";

export interface StoryAssetImageGenerationResult {
  readonly assetId: string;
  readonly status: StoryAssetImageGenerationStatus;
  readonly path?: string;
  readonly error?: string;
}

export interface ExtractStoryAssetsInput extends StoryAssetExtractionSource {
  readonly storyId: string;
  readonly storyType: StoryAssetStoryTypeInput;
  readonly textModel: StoryAssetTextModel;
  readonly manifestStore: StoryAssetManifestStore;
  readonly updatedAt?: string;
}

export interface ExtractStoryAssetsResult {
  readonly path: string;
  readonly drafts: readonly StoryAssetDraft[];
  readonly manifest: StoryAssetManifest;
}

export interface GenerateStoryAssetImageInput {
  readonly storyId: string;
  readonly storyType: StoryAssetStoryTypeInput;
  readonly assetId: string;
  readonly manifestStore: StoryAssetManifestStore;
  readonly imageRuntime: StoryAssetImageRuntime;
  readonly fileWriter: StoryAssetFileWriter;
  readonly clock?: StoryAssetClock;
  readonly now?: StoryAssetClock;
}

export type GenerateMissingStoryAssetImagesInput = Omit<GenerateStoryAssetImageInput, "assetId">;

export function normalizeStoryAssetStoryType(value: StoryAssetStoryTypeInput): StoryAssetStoryType {
  if (value === "book" || value === "long") return "book";
  if (value === "short" || value === "short-fiction") return "short";
  throw new Error(`Invalid story asset storyType: ${String(value)}`);
}

export function storyAssetManifestPath(storyType: StoryAssetStoryTypeInput, storyId: string): string {
  const safeStoryId = assertSafeBookId(storyId, "storyId");
  const root = normalizeStoryAssetStoryType(storyType) === "book" ? "books" : "shorts";
  return `${root}/${safeStoryId}/assets/manifest.json`;
}

const SAFE_STORY_ASSET_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/u;
const SAFE_STORY_ASSET_IMAGE_EXTENSION_RE = /^(?:png|jpg|jpeg|webp)$/u;

class UnsafeStoryAssetImagePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeStoryAssetImagePathError";
  }
}

function assertSafeStoryAssetId(assetId: string): string {
  if (!SAFE_STORY_ASSET_ID_RE.test(assetId)) {
    throw new UnsafeStoryAssetImagePathError(`Unsafe story asset id: ${JSON.stringify(assetId)}`);
  }
  return assetId;
}

function assertSafeStoryAssetImageExtension(extension: string): string {
  const normalized = extension.trim().toLowerCase();
  if (!SAFE_STORY_ASSET_IMAGE_EXTENSION_RE.test(normalized)) {
    throw new UnsafeStoryAssetImagePathError(`Unsafe story asset image extension: ${JSON.stringify(extension)}`);
  }
  return normalized;
}

export function storyAssetImagePath(
  storyType: StoryAssetStoryTypeInput,
  storyId: string,
  assetId: string,
  extension: string,
): string {
  const manifestPath = storyAssetManifestPath(storyType, storyId);
  const safeAssetId = assertSafeStoryAssetId(assetId);
  const safeExtension = assertSafeStoryAssetImageExtension(extension);
  return manifestPath.replace(/\/assets\/manifest\.json$/u, `/assets/images/${safeAssetId}.${safeExtension}`);
}

function resolveStoryAssetClock(input: GenerateStoryAssetImageInput): StoryAssetClock {
  return input.clock ?? input.now ?? (() => new Date().toISOString());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function readStoryAssetManifestForImages(
  store: StoryAssetManifestStore,
  path: string,
  storyId: string,
): Promise<StoryAssetManifest> {
  const value = await store.readManifest(path);
  if (!isRecord(value) || value.version !== 1 || value.storyId !== storyId || !Array.isArray(value.assets)) {
    throw new Error(`Invalid story asset manifest for story ${storyId}.`);
  }
  return value as unknown as StoryAssetManifest;
}

function updateStoryAssetImage(
  manifest: StoryAssetManifest,
  assetId: string,
  image: StoryAssetImage,
  updatedAt: string,
): StoryAssetManifest {
  let found = false;
  const assets = manifest.assets.map((asset) => {
    if (asset.id !== assetId) return asset;
    found = true;
    return { ...asset, image, updatedAt };
  });
  if (!found) {
    throw new Error(`Story asset not found: ${assetId}`);
  }
  return { ...manifest, updatedAt, assets };
}

function imageGenerationErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  const message = String(error);
  return message && message !== "[object Object]" ? message : "Story asset image generation failed.";
}

export async function generateStoryAssetImage(
  input: GenerateStoryAssetImageInput,
): Promise<StoryAssetImageGenerationResult> {
  const path = storyAssetManifestPath(input.storyType, input.storyId);
  const safeAssetId = assertSafeStoryAssetId(input.assetId);
  const clock = resolveStoryAssetClock(input);
  const manifest = await readStoryAssetManifestForImages(input.manifestStore, path, input.storyId);
  const asset = manifest.assets.find((candidate) => candidate.id === safeAssetId);
  if (!asset) {
    throw new Error(`Story asset not found: ${safeAssetId}`);
  }

  const generatingManifest = updateStoryAssetImage(manifest, safeAssetId, { status: "generating" }, clock());
  await input.manifestStore.writeManifest(path, generatingManifest);

  try {
    const generated = await input.imageRuntime.generateImage(asset.imagePrompt);
    if (!isRecord(generated) || !(generated.buffer instanceof Uint8Array) || typeof generated.extension !== "string") {
      throw new Error("Image runtime returned an invalid image result.");
    }
    const imagePath = storyAssetImagePath(input.storyType, input.storyId, safeAssetId, generated.extension);
    await input.fileWriter.writeFile(imagePath, generated.buffer);
    const generatedAt = clock();
    const readyManifest = updateStoryAssetImage(
      generatingManifest,
      safeAssetId,
      { status: "ready", path: imagePath, generatedAt },
      generatedAt,
    );
    await input.manifestStore.writeManifest(path, readyManifest);
    return { assetId: safeAssetId, status: "ready", path: imagePath };
  } catch (error) {
    const message = imageGenerationErrorMessage(error);
    const errorManifest = updateStoryAssetImage(
      generatingManifest,
      safeAssetId,
      { status: "error", error: message },
      clock(),
    );
    await input.manifestStore.writeManifest(path, errorManifest);
    if (error instanceof UnsafeStoryAssetImagePathError) throw error;
    return { assetId: safeAssetId, status: "error", error: message };
  }
}

export async function generateMissingStoryAssetImages(
  input: GenerateMissingStoryAssetImagesInput,
): Promise<StoryAssetImageGenerationResult[]> {
  const path = storyAssetManifestPath(input.storyType, input.storyId);
  const manifest = await readStoryAssetManifestForImages(input.manifestStore, path, input.storyId);
  for (const asset of manifest.assets) {
    assertSafeStoryAssetId(asset.id);
  }

  const results: StoryAssetImageGenerationResult[] = [];
  for (const asset of manifest.assets) {
    if (asset.image.status === "ready") {
      results.push({ assetId: asset.id, status: "skipped", path: asset.image.path });
      continue;
    }
    results.push(await generateStoryAssetImage({ ...input, assetId: asset.id }));
  }
  return results;
}

export async function extractStoryAssets(input: ExtractStoryAssetsInput): Promise<ExtractStoryAssetsResult> {
  const path = storyAssetManifestPath(input.storyType, input.storyId);
  const updatedAt = input.updatedAt ?? new Date().toISOString();
  const existing = await input.manifestStore.readManifest(path);
  const baseManifest = existing == null
    ? createEmptyStoryAssetManifest(input.storyId, updatedAt)
    : existing;
  const drafts = await new StoryAssetExtractorAgent(input.textModel).extract({
    settings: input.settings,
    outline: input.outline,
    content: input.content,
  });
  const manifest = mergeStoryAssets(baseManifest, drafts, updatedAt);
  if (manifest.storyId !== input.storyId) {
    throw new Error(`Story asset manifest storyId mismatch: expected ${input.storyId}.`);
  }
  await input.manifestStore.writeManifest(path, manifest);
  return { path, drafts, manifest };
}
