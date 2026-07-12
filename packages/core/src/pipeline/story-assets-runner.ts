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

export type StoryAssetStoryType = "book" | "short";
export type StoryAssetStoryTypeInput = StoryAssetStoryType | "long" | "short-fiction";

export interface StoryAssetManifestStore {
  readManifest(path: string): Promise<unknown | null | undefined>;
  writeManifest(path: string, manifest: StoryAssetManifest): Promise<void>;
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
