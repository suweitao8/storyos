import { randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";

export type CraftSourceType = "bilibili" | "novel";

export type CraftSourceFileKey =
  | "source"
  | "video"
  | "commentaryVideo"
  | "sourceVideo"
  | "sourceVideoSubtitles"
  | "subtitlesJson"
  | "subtitlesText"
  | "timeline"
  | "frame"
  | "analysisInput";

export interface CraftSourceFile {
  readonly key: CraftSourceFileKey;
  readonly fileName: string;
  readonly downloadName: string;
  readonly size: number;
  readonly mimeType: string;
}

export interface CraftSourceManifest {
  readonly version: 1;
  readonly sourceType: CraftSourceType;
  readonly sourceName: string;
  readonly originalName: string;
  readonly sourceRef?: string;
  readonly sourceDurationSeconds?: number;
  readonly subtitleSource?: "bili" | "bcut";
  readonly importedAt: string;
  readonly files: ReadonlyArray<CraftSourceFile>;
}

export interface CreateCraftSourceUploadInput {
  readonly sourceType: CraftSourceType;
  readonly sourceName: string;
  readonly originalName: string;
  readonly sourceBytes?: Uint8Array;
  readonly analysisText: string;
  readonly sourceRef?: string;
  readonly sourceDurationSeconds?: number;
  readonly subtitleSource?: "bili" | "bcut";
}

export interface AddCraftSourceFileInput {
  readonly key: Exclude<CraftSourceFile["key"], "analysisInput">;
  readonly fileName: string;
  readonly downloadName: string;
  readonly content?: Uint8Array;
  readonly sourcePath?: string;
  readonly mimeType: string;
}

export function normalizeCraftSourceFileKey(key: string): Exclude<CraftSourceFileKey, "video"> {
  return key === "video" ? "commentaryVideo" : key as Exclude<CraftSourceFileKey, "video">;
}

const UPLOADS_DIR = "craft-source-uploads";
const CRAFTS_DIR = "crafts";
const MANIFEST_FILE = "source-meta.json";

function uploadRoot(root: string): string {
  return join(root, UPLOADS_DIR);
}

function craftSourceRoot(root: string, craftId: string): string {
  return join(root, CRAFTS_DIR, craftId, "source");
}

function pendingRoot(root: string, assetId: string): string {
  return join(uploadRoot(root), assetId);
}

function assertSafeSegment(value: string, label: string): void {
  if (!value || value === "." || value === ".." || /[/\\\0]/u.test(value) || value.includes("..")) {
    throw new Error(`${label} is unsafe`);
  }
}

function safeFileName(value: string, fallback: string): string {
  const name = basename(value).replace(/[\0/\\]/gu, "").trim();
  return name || fallback;
}

function sourceFileName(originalName: string): string {
  const extension = extname(originalName).toLowerCase().replace(/[^a-z0-9.]/gu, "").slice(0, 10);
  return `source${extension || ".bin"}`;
}

async function writeManifest(directory: string, manifest: CraftSourceManifest): Promise<void> {
  await writeFile(join(directory, MANIFEST_FILE), JSON.stringify(manifest, null, 2), "utf8");
}

async function readManifest(directory: string): Promise<CraftSourceManifest> {
  return JSON.parse(await readFile(join(directory, MANIFEST_FILE), "utf8")) as CraftSourceManifest;
}

export async function createCraftSourceUpload(
  root: string,
  input: CreateCraftSourceUploadInput,
): Promise<{ readonly assetId: string; readonly directory: string; readonly manifest: CraftSourceManifest }> {
  const assetId = randomUUID();
  const directory = pendingRoot(root, assetId);
  await mkdir(directory, { recursive: true });

  const files: CraftSourceFile[] = [];
  if (input.sourceBytes) {
    const fileName = sourceFileName(input.originalName);
    await writeFile(join(directory, fileName), input.sourceBytes);
    files.push({
      key: "source",
      fileName,
      downloadName: safeFileName(input.originalName, fileName),
      size: input.sourceBytes.byteLength,
      mimeType: "application/octet-stream",
    });
  }

  const analysisInput = Buffer.from(input.analysisText, "utf8");
  await writeFile(join(directory, "analysis-input.txt"), analysisInput);
  files.push({
    key: "analysisInput",
    fileName: "analysis-input.txt",
    downloadName: "analysis-input.txt",
    size: analysisInput.byteLength,
    mimeType: "text/plain; charset=utf-8",
  });

  const manifest: CraftSourceManifest = {
    version: 1,
    sourceType: input.sourceType,
    sourceName: input.sourceName,
    originalName: safeFileName(input.originalName, "source"),
    ...(input.sourceRef ? { sourceRef: input.sourceRef } : {}),
    ...(input.sourceDurationSeconds ? { sourceDurationSeconds: input.sourceDurationSeconds } : {}),
    ...(input.subtitleSource ? { subtitleSource: input.subtitleSource } : {}),
    importedAt: new Date().toISOString(),
    files,
  };
  await writeManifest(directory, manifest);
  return { assetId, directory, manifest };
}

export async function addCraftSourceFile(
  root: string,
  assetId: string,
  input: AddCraftSourceFileInput,
): Promise<CraftSourceManifest> {
  assertSafeSegment(assetId, "asset id");
  const directory = pendingRoot(root, assetId);
  const manifest = await readManifest(directory);
  const fileName = safeFileName(input.fileName, `${input.key}.bin`);
  const targetPath = join(directory, fileName);
  if (input.sourcePath) {
    await copyFile(input.sourcePath, targetPath);
  } else if (input.content) {
    await writeFile(targetPath, input.content);
  } else {
    throw new Error("Source file content is required");
  }
  const fileSize = (await stat(targetPath)).size;
  const nextFile: CraftSourceFile = {
    key: input.key,
    fileName,
    downloadName: safeFileName(input.downloadName, fileName),
    size: fileSize,
    mimeType: input.mimeType,
  };
  const nextManifest: CraftSourceManifest = {
    ...manifest,
    files: [...manifest.files.filter((file) => file.key !== input.key), nextFile],
  };
  await writeManifest(directory, nextManifest);
  return nextManifest;
}

export async function finalizeCraftSourceUpload(
  root: string,
  assetId: string,
  craftId: string,
  extra: Pick<CraftSourceManifest, "sourceRef">,
): Promise<CraftSourceManifest> {
  assertSafeSegment(assetId, "asset id");
  assertSafeSegment(craftId, "craft id");
  const sourceDirectory = pendingRoot(root, assetId);
  const manifest = await readManifest(sourceDirectory);
  const nextManifest = { ...manifest, ...(extra.sourceRef ? { sourceRef: extra.sourceRef } : {}) };
  await writeManifest(sourceDirectory, nextManifest);

  const target = craftSourceRoot(root, craftId);
  await rm(target, { recursive: true, force: true });
  await mkdir(resolve(target, ".."), { recursive: true });
  await rename(sourceDirectory, target);
  return nextManifest;
}

export async function loadCraftSourceManifest(root: string, craftId: string): Promise<CraftSourceManifest | null> {
  assertSafeSegment(craftId, "craft id");
  try {
    return await readManifest(craftSourceRoot(root, craftId));
  } catch {
    return null;
  }
}

export async function resolveCraftSourceFile(root: string, craftId: string, key: string): Promise<string> {
  assertSafeSegment(craftId, "craft id");
  const manifest = await loadCraftSourceManifest(root, craftId);
  const normalizedKey = normalizeCraftSourceFileKey(key);
  const file = manifest?.files.find((candidate) => normalizeCraftSourceFileKey(candidate.key) === normalizedKey);
  if (!file) throw new Error("Source file is not registered");
  const directory = craftSourceRoot(root, craftId);
  const path = resolve(directory, file.fileName);
  const relativePath = relative(directory, path);
  if (!relativePath || relativePath.startsWith("..") || relativePath.includes(`..${"\\"}`) || relativePath.includes("/")) {
    throw new Error("Source file path is unsafe");
  }
  const fileStat = await stat(path);
  if (!fileStat.isFile()) throw new Error("Source file is not available");
  return path;
}

export async function cleanupCraftSourceUpload(root: string, assetId: string): Promise<void> {
  assertSafeSegment(assetId, "asset id");
  await rm(pendingRoot(root, assetId), { recursive: true, force: true });
}
