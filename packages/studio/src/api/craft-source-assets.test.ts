import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  addCraftSourceFile,
  createCraftSourceUpload,
  finalizeCraftSourceUpload,
  loadCraftSourceManifest,
  resolveCraftSourceFile,
} from "./craft-source-assets.js";

async function makeRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "storyos-craft-source-test-"));
}

describe("craft source assets", () => {
  it("persists an uploaded source and analysis input, then archives both under the craft", async () => {
    const root = await makeRoot();
    const upload = await createCraftSourceUpload(root, {
      sourceType: "novel",
      sourceName: "测试小说",
      originalName: "测试小说.txt",
      sourceBytes: Buffer.from("原始小说内容", "utf8"),
      analysisText: "用于分析的小说摘录",
    });

    await finalizeCraftSourceUpload(root, upload.assetId, "craft-1", {
      sourceRef: undefined,
    });

    const manifest = await loadCraftSourceManifest(root, "craft-1");
    expect(manifest?.sourceType).toBe("novel");
    expect(manifest?.files.map((file) => file.key)).toEqual(["source", "analysisInput"]);

    const sourcePath = await resolveCraftSourceFile(root, "craft-1", "source");
    expect(await readFile(sourcePath, "utf8")).toBe("原始小说内容");
    const inputPath = await resolveCraftSourceFile(root, "craft-1", "analysisInput");
    expect(await readFile(inputPath, "utf8")).toBe("用于分析的小说摘录");
  });

  it("registers subtitle and video files with safe download paths", async () => {
    const root = await makeRoot();
    const upload = await createCraftSourceUpload(root, {
      sourceType: "bilibili",
      sourceName: "测试视频",
      originalName: "BV1.mp4",
      analysisText: "[0.0s-1.0s] 字幕",
    });
    await addCraftSourceFile(root, upload.assetId, {
      key: "video",
      fileName: "video.mp4",
      downloadName: "测试视频.mp4",
      content: Buffer.from("video"),
      mimeType: "video/mp4",
    });
    await addCraftSourceFile(root, upload.assetId, {
      key: "subtitlesText",
      fileName: "subtitles.txt",
      downloadName: "测试视频-字幕.txt",
      content: Buffer.from("[0.0s-1.0s] 字幕"),
      mimeType: "text/plain; charset=utf-8",
    });
    await finalizeCraftSourceUpload(root, upload.assetId, "craft-2", { sourceRef: "BV1" });

    const manifest = await loadCraftSourceManifest(root, "craft-2");
    expect(manifest?.files).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "video", downloadName: "测试视频.mp4", size: 5 }),
      expect.objectContaining({ key: "subtitlesText", size: Buffer.byteLength("[0.0s-1.0s] 字幕", "utf8") }),
    ]));
    const videoPath = await resolveCraftSourceFile(root, "craft-2", "video");
    expect((await stat(videoPath)).isFile()).toBe(true);
    await expect(resolveCraftSourceFile(root, "craft-2", "../secret")).rejects.toThrow(/not registered/i);
  });

  it("copies a large source file without requiring the caller to load it into memory", async () => {
    const root = await makeRoot();
    const external = join(root, "downloaded-video.mp4");
    await writeFile(external, Buffer.alloc(16, 7));
    const upload = await createCraftSourceUpload(root, {
      sourceType: "bilibili",
      sourceName: "视频",
      originalName: "BV1.mp4",
      analysisText: "字幕",
    });

    const manifest = await addCraftSourceFile(root, upload.assetId, {
      key: "video",
      fileName: "video.mp4",
      downloadName: "视频.mp4",
      sourcePath: external,
      mimeType: "video/mp4",
    });

    expect(manifest.files.find((file) => file.key === "video")?.size).toBe(16);
    expect(await readFile(join(upload.directory, "video.mp4"))).toEqual(Buffer.alloc(16, 7));
  });
});
