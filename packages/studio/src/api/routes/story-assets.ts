import type { Context } from "hono";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import {
  chatCompletion,
  extractStoryAssets,
  generateMissingStoryAssetImages,
  generatePlayImage,
  generateStoryAssetImage,
  storyAssetImagePath,
  storyAssetManifestPath,
  buildImagePromptGuides,
  PipelineRunner,
  type ArtStyle,
  type StoryAsset,
  type StoryAssetFileWriter,
  type StoryAssetImageRuntime,
  type StoryAssetImagePromptGuides,
  type StoryAssetManifest,
  type StoryAssetManifestStore,
  type StoryAssetTextModel,
} from "@actalk/inkos-core";
import { ApiError } from "../errors.js";
import { isSafeBookId } from "../safety.js";
import {
  errorResponse,
  normalizeRelativePath,
} from "./boundary.js";
import type { StudioRouteContext } from "./context.js";
import { resolveStoryArtStyle } from "../story-art-style.js";

type StoryAssetRouteKind = "book" | "short";

const STORY_ASSET_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/u;
const STORY_ASSET_IMAGE_CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

function storyAssetErrorResponse(c: Context, error: unknown): Response {
  if (!(error instanceof ApiError)) console.error("[studio] Unexpected story asset error", error);
  return errorResponse(c, error);
}

function assertStoryAssetKind(value: unknown): StoryAssetRouteKind {
  if (value === "book" || value === "short") return value;
  throw new ApiError(400, "INVALID_STORY_KIND", "Story kind must be book or short.");
}

function assertStoryAssetId(value: unknown): string {
  if (typeof value !== "string" || !isSafeBookId(value)) {
    throw new ApiError(400, "INVALID_STORY_ID", `Invalid story ID: "${String(value)}"`);
  }
  return value;
}

function assertStoryAssetAssetId(value: unknown): string {
  if (typeof value !== "string" || !STORY_ASSET_ID_RE.test(value)) {
    throw new ApiError(400, "INVALID_STORY_ASSET_ID", `Invalid story asset ID: "${String(value)}"`);
  }
  return value;
}

function storyAssetCollection(kind: StoryAssetRouteKind): "books" | "shorts" {
  return kind === "book" ? "books" : "shorts";
}

function resolveStoryAssetProjectPath(root: string, rawPath: string, code = "INVALID_STORY_ASSET_PATH"): { readonly relativePath: string; readonly resolved: string } {
  const relativePath = normalizeRelativePath(rawPath, { code, message: "Invalid story asset path." });
  const projectRoot = resolve(root);
  const resolved = resolve(projectRoot, relativePath);
  const inside = relative(projectRoot, resolved).replace(/\\/gu, "/");
  if (!inside || inside === ".." || inside.startsWith("../") || isAbsolute(inside)) {
    throw new ApiError(400, code, "Invalid story asset path.");
  }
  return { relativePath: inside, resolved };
}

function storyAssetManifestRelativePath(kind: StoryAssetRouteKind, storyId: string): string {
  const expected = `${storyAssetCollection(kind)}/${storyId}/assets/manifest.json`;
  const actual = normalizeRelativePath(storyAssetManifestPath(kind, storyId));
  if (actual !== expected) throw new ApiError(400, "INVALID_STORY_ASSET_PATH", "Invalid story asset manifest path.");
  return expected;
}

function storyAssetImageRelativePath(kind: StoryAssetRouteKind, storyId: string, assetId: string, extension: string): string {
  const normalizedExtension = extension.trim().toLowerCase();
  if (!STORY_ASSET_IMAGE_CONTENT_TYPES[normalizedExtension]) {
    throw new ApiError(400, "UNSAFE_STORY_ASSET_IMAGE_PATH", "Unsupported story asset image extension.");
  }
  const expected = `${storyAssetCollection(kind)}/${storyId}/assets/images/${assetId}.${normalizedExtension}`;
  const actual = normalizeRelativePath(storyAssetImagePath(kind, storyId, assetId, normalizedExtension));
  if (actual !== expected) throw new ApiError(400, "UNSAFE_STORY_ASSET_IMAGE_PATH", "Invalid story asset image path.");
  return expected;
}

function createStoryAssetManifestStore(root: string, expectedPath: string): StoryAssetManifestStore {
  return {
    async readManifest(path: string): Promise<unknown | null> {
      const target = resolveStoryAssetProjectPath(root, path);
      if (target.relativePath !== expectedPath) throw new ApiError(400, "INVALID_STORY_ASSET_PATH", "Invalid story asset manifest path.");
      try {
        return JSON.parse(await readFile(target.resolved, "utf-8")) as unknown;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        if (error instanceof SyntaxError) throw new ApiError(400, "INVALID_STORY_ASSET_MANIFEST", "Story asset manifest is not valid JSON.");
        throw error;
      }
    },
    async writeManifest(path: string, manifest: StoryAssetManifest): Promise<void> {
      const target = resolveStoryAssetProjectPath(root, path);
      if (target.relativePath !== expectedPath) throw new ApiError(400, "INVALID_STORY_ASSET_PATH", "Invalid story asset manifest path.");
      await mkdir(dirname(target.resolved), { recursive: true });
      const temporaryPath = `${target.resolved}.${process.pid}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporaryPath, JSON.stringify(manifest, null, 2), "utf-8");
        await rename(temporaryPath, target.resolved);
      } finally {
        await rm(temporaryPath, { force: true }).catch(() => undefined);
      }
    },
  };
}

function createStoryAssetFileWriter(root: string, kind: StoryAssetRouteKind, storyId: string): StoryAssetFileWriter {
  const imageRoot = `${storyAssetCollection(kind)}/${storyId}/assets/images/`;
  return {
    async writeFile(path: string, data: Uint8Array): Promise<void> {
      const target = resolveStoryAssetProjectPath(root, path);
      if (!target.relativePath.startsWith(imageRoot)) throw new ApiError(400, "INVALID_STORY_ASSET_PATH", "Story asset images must remain in the story assets directory.");
      const fileName = target.relativePath.slice(imageRoot.length);
      const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
      const assetId = fileName.slice(0, -(extension.length + 1));
      if (!STORY_ASSET_ID_RE.test(assetId) || !STORY_ASSET_IMAGE_CONTENT_TYPES[extension]) {
        throw new ApiError(400, "UNSAFE_STORY_ASSET_IMAGE_PATH", "Invalid story asset image path.");
      }
      await mkdir(dirname(target.resolved), { recursive: true });
      await writeFile(target.resolved, data);
    },
  };
}

async function readOptionalStoryAssetText(path: string): Promise<string> {
  return await readFile(path, "utf-8").catch(() => "");
}

async function readStoryAssetChapterText(directory: string): Promise<string> {
  const files = await readdir(directory).catch(() => [] as string[]);
  const markdownFiles = files.filter((file) => file.endsWith(".md")).sort();
  const contents = await Promise.all(markdownFiles.map((file) => readOptionalStoryAssetText(join(directory, file))));
  return contents.filter((content) => content.trim()).join("\n\n---\n\n");
}

async function readStoryAssetSources(root: string, kind: StoryAssetRouteKind, storyId: string): Promise<{ readonly settings: string; readonly outline: string; readonly content: string; readonly hasSource: boolean }> {
  const storyRoot = join(root, storyAssetCollection(kind), storyId);
  if (kind === "book") {
    const storyDir = join(storyRoot, "story");
    const settingsNew = await readOptionalStoryAssetText(join(storyDir, "outline", "story_frame.md"));
    const settings = settingsNew.trim() ? settingsNew : await readOptionalStoryAssetText(join(storyDir, "story_bible.md"));
    const outlineNew = await readOptionalStoryAssetText(join(storyDir, "outline", "volume_map.md"));
    const outline = outlineNew.trim() ? outlineNew : await readOptionalStoryAssetText(join(storyDir, "volume_outline.md"));
    const content = await readStoryAssetChapterText(join(storyRoot, "chapters"));
    return { settings, outline, content, hasSource: Boolean(settings.trim() || outline.trim() || content.trim()) };
  }
  const outlineV2 = await readOptionalStoryAssetText(join(storyRoot, "outline", "v002.md"));
  const outline = outlineV2.trim() ? outlineV2 : await readOptionalStoryAssetText(join(storyRoot, "outline", "v001.md"));
  const settings = await readOptionalStoryAssetText(join(storyRoot, "final", "sales-package.md"));
  const full = await readOptionalStoryAssetText(join(storyRoot, "final", "full.md"));
  const content = full.trim() ? full : await readStoryAssetChapterText(join(storyRoot, "final", "chapters"));
  return { settings, outline, content, hasSource: Boolean(settings.trim() || outline.trim() || content.trim()) };
}

function assertStoryAssetManifest(value: unknown, storyId: string): StoryAssetManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError(400, "INVALID_STORY_ASSET_MANIFEST", "Story asset manifest must be an object.");
  const manifest = value as Partial<StoryAssetManifest>;
  if (manifest.version !== 1 || manifest.storyId !== storyId || !Array.isArray(manifest.assets)) throw new ApiError(400, "INVALID_STORY_ASSET_MANIFEST", `Invalid story asset manifest for story ${storyId}.`);
  return manifest as StoryAssetManifest;
}

async function createStoryAssetImageRuntime(root: string, assetId: string): Promise<StoryAssetImageRuntime> {
  const tmpRoot = join(root, "tmp");
  await mkdir(tmpRoot, { recursive: true });
  return {
    async generateImage(prompt: string, size?: string): Promise<{ readonly buffer: Uint8Array; readonly extension: string }> {
      const runDir = await mkdtemp(join(tmpRoot, "story-asset-image-"));
      try {
        const result = await generatePlayImage({ root, runDir, key: assetId, prompt, size });
        if (result.status !== "ready" || typeof result.file !== "string") throw new Error(result.error || "Story asset image generation failed.");
        const fileName = result.file;
        const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
        if (!STORY_ASSET_IMAGE_CONTENT_TYPES[extension] || fileName.includes("/") || fileName.includes("\\") || fileName.includes("..")) throw new Error("Generated story asset image has an unsafe file name.");
        return { buffer: new Uint8Array(await readFile(join(runDir, "images", fileName))), extension };
      } finally {
        await rm(runDir, { recursive: true, force: true });
      }
    },
  };
}

export function registerStoryAssetRoutes(context: StudioRouteContext): void {
  const { app, root, getProjectConfig, buildPipelineConfig, broadcast } = context;
  const storyAssetContext = (kindValue: unknown, storyIdValue: unknown) => {
    const kind = assertStoryAssetKind(kindValue);
    const storyId = assertStoryAssetId(storyIdValue);
    const manifestPath = storyAssetManifestRelativePath(kind, storyId);
    return { kind, storyId, manifestPath, manifestStore: createStoryAssetManifestStore(root, manifestPath), fileWriter: createStoryAssetFileWriter(root, kind, storyId) };
  };
  const loadStoryAssetManifest = async (kindValue: unknown, storyIdValue: unknown) => {
    const current = storyAssetContext(kindValue, storyIdValue);
    const value = await current.manifestStore.readManifest(current.manifestPath);
    if (value == null) throw new ApiError(404, "STORY_ASSET_MANIFEST_NOT_FOUND", `Story asset manifest not found for ${current.storyId}.`);
    return { ...current, manifest: assertStoryAssetManifest(value, current.storyId) };
  };
  const broadcastStoryAssetError = (kind: StoryAssetRouteKind, storyId: string, operation: string, error: unknown) => {
    broadcast("story-assets:error", { kind, storyId, operation, error: error instanceof ApiError ? error.message : "Unexpected server error." });
  };
  const getStoryAssetManifest = async (c: Context, kindValue: unknown, storyIdValue: unknown) => {
    try { return c.json((await loadStoryAssetManifest(kindValue, storyIdValue)).manifest); }
    catch (error) {
      if (error instanceof ApiError && error.code === "STORY_ASSET_MANIFEST_NOT_FOUND") {
        const current = storyAssetContext(kindValue, storyIdValue);
        return c.json({ version: 1, storyId: current.storyId, updatedAt: new Date(0).toISOString(), assets: [] });
      }
      return storyAssetErrorResponse(c, error);
    }
  };
  app.get("/api/v1/stories/:kind/:id/assets", async (c) => getStoryAssetManifest(c, c.req.param("kind"), c.req.param("id")));
  app.get("/api/v1/books/:id/assets", async (c) => getStoryAssetManifest(c, "book", c.req.param("id")));
  app.get("/api/v1/shorts/:id/assets", async (c) => getStoryAssetManifest(c, "short", c.req.param("id")));

  const extractRoute = async (c: Context, kindValue: unknown, storyIdValue: unknown) => {
    let kind: StoryAssetRouteKind; let storyId: string;
    try { kind = assertStoryAssetKind(kindValue); storyId = assertStoryAssetId(storyIdValue); } catch (error) { return storyAssetErrorResponse(c, error); }
    broadcast("story-assets:start", { kind, storyId, operation: "extract" });
    try {
      const current = storyAssetContext(kind, storyId);
      const sources = await readStoryAssetSources(root, kind, storyId);
      if (!sources.hasSource) throw new ApiError(404, "STORY_NOT_FOUND", `Story not found for ${storyId}.`);
      const config = await getProjectConfig({ requireApiKey: false });
      const pipeline = await buildPipelineConfig({ currentConfig: config, ...(kind === "book" ? { bookIdForSettings: storyId } : {}) });
      const textModel: StoryAssetTextModel = async (messages, options) => (await chatCompletion(pipeline.client, pipeline.model, messages, { ...options, retry: false })).content;

      // Resolve the selected craft style from the story's persisted visual config.
      // A query override is kept for callers that explicitly regenerate assets.
      let artStyle: ArtStyle = await resolveStoryArtStyle(root, kind, storyId, new PipelineRunner(pipeline));
      const queryStyle = c.req.query("artStyle");
      if (queryStyle === "realistic" || queryStyle === "cg3d") artStyle = queryStyle;

      const imagePromptGuides: StoryAssetImagePromptGuides = buildImagePromptGuides(artStyle);
      const result = await extractStoryAssets({ storyId, storyType: kind, ...sources, textModel, manifestStore: current.manifestStore, imagePromptGuides });
      broadcast("story-assets:complete", { kind, storyId, operation: "extract", assetCount: result.manifest.assets.length });
      return c.json({ ...result.manifest, path: result.path, drafts: result.drafts });
    } catch (error) { broadcastStoryAssetError(kind, storyId, "extract", error); return storyAssetErrorResponse(c, error); }
  };
  app.post("/api/v1/stories/:kind/:id/assets/extract", async (c) => extractRoute(c, c.req.param("kind"), c.req.param("id")));
  app.post("/api/v1/books/:id/assets/extract", async (c) => extractRoute(c, "book", c.req.param("id")));
  app.post("/api/v1/shorts/:id/assets/extract", async (c) => extractRoute(c, "short", c.req.param("id")));

  const patchRoute = async (c: Context, kindValue: unknown, storyIdValue: unknown, assetIdValue: unknown) => {
    let kind: StoryAssetRouteKind; let storyId: string; let assetId: string;
    try { kind = assertStoryAssetKind(kindValue); storyId = assertStoryAssetId(storyIdValue); assetId = assertStoryAssetAssetId(assetIdValue); } catch (error) { return storyAssetErrorResponse(c, error); }
    broadcast("story-assets:start", { kind, storyId, assetId, operation: "patch" });
    try {
      const current = await loadStoryAssetManifest(kind, storyId);
      const asset = current.manifest.assets.find((candidate) => candidate.id === assetId);
      if (!asset) throw new ApiError(404, "STORY_ASSET_NOT_FOUND", `Story asset not found: ${assetId}.`);
      const body = await c.req.json().catch(() => ({} as Record<string, unknown>)) as Record<string, unknown>;
      const allowedFields = ["name", "summary", "imagePrompt", "details"] as const;
      if (!allowedFields.some((field) => Object.prototype.hasOwnProperty.call(body, field))) throw new ApiError(400, "INVALID_STORY_ASSET_PATCH", "At least one text field is required.");
      let updated: StoryAsset = { ...asset, updatedAt: new Date().toISOString() };
      if (Object.prototype.hasOwnProperty.call(body, "name")) {
        if (typeof body.name !== "string" || !body.name.trim()) throw new ApiError(400, "INVALID_STORY_ASSET_PATCH", "name must be a non-empty string.");
        updated = { ...updated, name: body.name.trim() };
      }
      for (const field of ["summary", "imagePrompt"] as const) if (Object.prototype.hasOwnProperty.call(body, field)) {
        if (typeof body[field] !== "string") throw new ApiError(400, "INVALID_STORY_ASSET_PATCH", `${field} must be a string.`);
        updated = { ...updated, [field]: body[field] as string };
      }
      if (Object.prototype.hasOwnProperty.call(body, "details")) {
        if (!body.details || typeof body.details !== "object" || Array.isArray(body.details)) throw new ApiError(400, "INVALID_STORY_ASSET_PATCH", "details must be an object of strings.");
        const details: Record<string, string> = { ...asset.details };
        for (const [key, value] of Object.entries(body.details)) { if (typeof value !== "string") throw new ApiError(400, "INVALID_STORY_ASSET_PATCH", "details values must be strings."); details[key] = value; }
        updated = { ...updated, details };
      }
      const manifest: StoryAssetManifest = { ...current.manifest, updatedAt: updated.updatedAt, assets: current.manifest.assets.map((candidate) => candidate.id === assetId ? updated : candidate) };
      await current.manifestStore.writeManifest(current.manifestPath, manifest);
      broadcast("story-assets:complete", { kind, storyId, assetId, operation: "patch" });
      return c.json({ asset: updated, manifest });
    } catch (error) { broadcastStoryAssetError(kind, storyId, "patch", error); return storyAssetErrorResponse(c, error); }
  };
  app.patch("/api/v1/stories/:kind/:id/assets/:assetId", async (c) => patchRoute(c, c.req.param("kind"), c.req.param("id"), c.req.param("assetId")));
  app.patch("/api/v1/books/:id/assets/:assetId", async (c) => patchRoute(c, "book", c.req.param("id"), c.req.param("assetId")));
  app.patch("/api/v1/shorts/:id/assets/:assetId", async (c) => patchRoute(c, "short", c.req.param("id"), c.req.param("assetId")));

  const generateImageRoute = async (c: Context, kindValue: unknown, storyIdValue: unknown, assetIdValue: unknown) => {
    let kind: StoryAssetRouteKind; let storyId: string; let assetId: string;
    try { kind = assertStoryAssetKind(kindValue); storyId = assertStoryAssetId(storyIdValue); assetId = assertStoryAssetAssetId(assetIdValue); } catch (error) { return storyAssetErrorResponse(c, error); }
    broadcast("story-assets:start", { kind, storyId, assetId, operation: "generate-image" });
    try {
      const current = await loadStoryAssetManifest(kind, storyId);
      if (!current.manifest.assets.some((candidate) => candidate.id === assetId)) throw new ApiError(404, "STORY_ASSET_NOT_FOUND", `Story asset not found: ${assetId}.`);
      const pipeline = new PipelineRunner(await buildPipelineConfig({ currentConfig: await getProjectConfig({ requireApiKey: false }) }));
      const artStyle = await resolveStoryArtStyle(root, kind, storyId, pipeline);
      const result = await generateStoryAssetImage({ storyId, storyType: kind, assetId, artStyle, manifestStore: current.manifestStore, imageRuntime: await createStoryAssetImageRuntime(root, assetId), fileWriter: current.fileWriter });
      broadcast("story-assets:complete", { kind, storyId, assetId, operation: "generate-image", status: result.status });
      return c.json(result);
    } catch (error) { broadcastStoryAssetError(kind, storyId, "generate-image", error); return storyAssetErrorResponse(c, error); }
  };
  app.post("/api/v1/stories/:kind/:id/assets/:assetId/generate-image", async (c) => generateImageRoute(c, c.req.param("kind"), c.req.param("id"), c.req.param("assetId")));
  app.post("/api/v1/books/:id/assets/:assetId/generate-image", async (c) => generateImageRoute(c, "book", c.req.param("id"), c.req.param("assetId")));
  app.post("/api/v1/shorts/:id/assets/:assetId/generate-image", async (c) => generateImageRoute(c, "short", c.req.param("id"), c.req.param("assetId")));

  const generateMissingRoute = async (c: Context, kindValue: unknown, storyIdValue: unknown) => {
    let kind: StoryAssetRouteKind; let storyId: string;
    try { kind = assertStoryAssetKind(kindValue); storyId = assertStoryAssetId(storyIdValue); } catch (error) { return storyAssetErrorResponse(c, error); }
    broadcast("story-assets:start", { kind, storyId, operation: "generate-missing" });
    try {
      const current = await loadStoryAssetManifest(kind, storyId);
      const pipeline = new PipelineRunner(await buildPipelineConfig({ currentConfig: await getProjectConfig({ requireApiKey: false }) }));
      const artStyle = await resolveStoryArtStyle(root, kind, storyId, pipeline);
      const results = await generateMissingStoryAssetImages({ storyId, storyType: kind, artStyle, manifestStore: current.manifestStore, imageRuntime: await createStoryAssetImageRuntime(root, "batch"), fileWriter: current.fileWriter });
      const manifest = await loadStoryAssetManifest(kind, storyId);
      broadcast("story-assets:complete", { kind, storyId, operation: "generate-missing", count: results.length });
      return c.json({ results, manifest: manifest.manifest });
    } catch (error) { broadcastStoryAssetError(kind, storyId, "generate-missing", error); return storyAssetErrorResponse(c, error); }
  };
  for (const [path, kind] of [["/api/v1/books/:id/assets/generate-missing-images", "book"], ["/api/v1/books/:id/assets/generate-missing", "book"], ["/api/v1/shorts/:id/assets/generate-missing-images", "short"], ["/api/v1/shorts/:id/assets/generate-missing", "short"]] as const) {
    app.post(path, async (c) => generateMissingRoute(c, kind, c.req.param("id")));
  }
  app.post("/api/v1/stories/:kind/:id/assets/generate-missing-images", async (c) => generateMissingRoute(c, c.req.param("kind"), c.req.param("id")));
  app.post("/api/v1/stories/:kind/:id/assets/generate-missing", async (c) => generateMissingRoute(c, c.req.param("kind"), c.req.param("id")));

  const serveImageRoute = async (c: Context, kindValue: unknown, storyIdValue: unknown, assetIdValue: unknown) => {
    let kind: StoryAssetRouteKind; let storyId: string; let assetId: string;
    try { kind = assertStoryAssetKind(kindValue); storyId = assertStoryAssetId(storyIdValue); assetId = assertStoryAssetAssetId(assetIdValue); } catch (error) { return storyAssetErrorResponse(c, error); }
    try {
      const current = await loadStoryAssetManifest(kind, storyId);
      const asset = current.manifest.assets.find((candidate) => candidate.id === assetId);
      if (!asset) throw new ApiError(404, "STORY_ASSET_NOT_FOUND", `Story asset not found: ${assetId}.`);
      if (asset.image.status !== "ready" || !asset.image.path) throw new ApiError(404, "STORY_ASSET_IMAGE_NOT_FOUND", `Ready image not found for story asset: ${assetId}.`);
      const extension = asset.image.path.split(".").pop()?.toLowerCase() ?? "";
      const expectedPath = storyAssetImageRelativePath(kind, storyId, assetId, extension);
      if (normalizeRelativePath(asset.image.path) !== expectedPath) throw new ApiError(400, "UNSAFE_STORY_ASSET_IMAGE_PATH", "Manifest image path is not safe.");
      const target = resolveStoryAssetProjectPath(root, expectedPath);
      let content: Buffer;
      try { content = await readFile(target.resolved); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new ApiError(404, "STORY_ASSET_IMAGE_NOT_FOUND", `Image file not found for story asset: ${assetId}.`); throw error; }
      return new Response(new Uint8Array(content), { headers: { "Content-Type": STORY_ASSET_IMAGE_CONTENT_TYPES[extension] } });
    } catch (error) { return storyAssetErrorResponse(c, error); }
  };
  for (const [path, kind] of [["/api/v1/books/:id/assets/images/:assetId", "book"], ["/api/v1/books/:id/assets/:assetId/image", "book"], ["/api/v1/shorts/:id/assets/images/:assetId", "short"], ["/api/v1/shorts/:id/assets/:assetId/image", "short"]] as const) {
    app.get(path, async (c) => serveImageRoute(c, kind, c.req.param("id"), c.req.param("assetId")));
  }
  app.get("/api/v1/stories/:kind/:id/assets/images/:assetId", async (c) => serveImageRoute(c, c.req.param("kind"), c.req.param("id"), c.req.param("assetId")));
  app.get("/api/v1/stories/:kind/:id/assets/:assetId/image", async (c) => serveImageRoute(c, c.req.param("kind"), c.req.param("id"), c.req.param("assetId")));
}
