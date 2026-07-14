import { execFile } from "node:child_process";
import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  PipelineRunner,
  ScriptCreationAgent,
  voiceSecretKey,
} from "@actalk/inkos-core";
import type { StudioRouteContext } from "./context.js";
import { isSafeBookId } from "../safety.js";
import {
  buildSrtContent,
  buildSubtitleEntries,
  parseUnifiedScript,
  type UnifiedScriptDocument,
} from "../story-production.js";

const execFileAsync = promisify(execFile);
const FFMPEG_PATH = process.env.FFMPEG_PATH ?? "C:\\ffmpeg\\bin\\ffmpeg.exe";
const MAX_SOURCE_CHARS = 40_000;
const MAX_TTS_SHOTS = 32;

type StoryKind = "short" | "book";

interface StorySource {
  readonly title: string;
  readonly text: string;
}

export function buildBookSourceFallbackText(
  sections: ReadonlyArray<{ readonly title: string; readonly content: string }>,
): string {
  return sections
    .map((section) => `${section.title}\n\n${section.content.trim()}`)
    .filter((section) => section.trim())
    .join("\n\n");
}

interface ProductionManifest {
  readonly scriptGeneratedAt?: string;
  readonly videoGeneratedAt?: string;
  readonly videoDurationMs?: number;
  readonly voiceEnabled?: boolean;
  readonly warning?: string;
}

interface TtsConfig {
  readonly model: string;
  readonly apiKey: string;
}

function kindPath(root: string, kind: StoryKind, id: string): string {
  return join(root, kind === "short" ? "shorts" : "books", id);
}

function productionPath(root: string, kind: StoryKind, id: string): string {
  return join(kindPath(root, kind, id), "production");
}

function isSafeStoryId(id: string): boolean {
  return isSafeBookId(id);
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, "utf-8")) as T;
  } catch {
    return null;
  }
}

async function readShortSource(root: string, id: string): Promise<StorySource> {
  const base = kindPath(root, "short", id);
  const full = await readFile(join(base, "final", "full.md"), "utf-8").catch(() => "");
  const artifact = await readJson<{ title?: unknown }>(join(base, "final", "short-story.json"));
  return {
    title: typeof artifact?.title === "string" && artifact.title.trim() ? artifact.title.trim() : id,
    text: full.trim(),
  };
}

async function readBookSource(context: StudioRouteContext, id: string): Promise<StorySource> {
  const book = await context.state.loadBookConfig(id);
  const chapters = await context.state.loadChapterIndex(id);
  const dir = context.state.bookDir(id);
  const chapterDir = join(dir, "chapters");
  const files = await readdir(chapterDir).catch(() => []);
  const parts: string[] = [];
  for (const chapter of chapters.slice().sort((left, right) => left.number - right.number)) {
    const prefix = String(chapter.number).padStart(4, "0");
    const file = files.find((entry) => entry.startsWith(prefix) && entry.endsWith(".md"));
    if (!file) continue;
    const text = await readFile(join(chapterDir, file), "utf-8").catch(() => "");
    if (text.trim()) parts.push(`第${chapter.number}章 ${chapter.title}\n\n${text}`);
  }
  if (parts.length > 0) return { title: book.title, text: parts.join("\n\n") };
  const storyDir = join(dir, "story");
  const sourceFiles = [
    ["故事设定", "outline/story_frame.md"],
    ["故事走向", "outline/volume_map.md"],
    ["写作规则", "book_rules.md"],
    ["悬念与伏笔", "pending_hooks.md"],
    ["当前状态", "current_state.md"],
  ] as const;
  const sections = (await Promise.all(sourceFiles.map(async ([title, file]) => {
    const content = await readFile(join(storyDir, file), "utf-8").catch(() => "");
    return content.trim() ? { title, content } : null;
  }))).filter((section): section is NonNullable<typeof section> => Boolean(section));
  return { title: book.title, text: buildBookSourceFallbackText(sections) };
}

async function readStorySource(context: StudioRouteContext, kind: StoryKind, id: string): Promise<StorySource> {
  return kind === "short" ? readShortSource(context.root, id) : readBookSource(context, id);
}

async function readManifest(path: string): Promise<ProductionManifest> {
  return (await readJson<ProductionManifest>(join(path, "manifest.json"))) ?? {};
}

function fallbackUnifiedScript(source: StorySource): string {
  const paragraphs = source.text
    .split(/\n\s*\n/gu)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 12);
  const chunks = paragraphs.length > 0 ? paragraphs : [source.text.trim() || "故事内容待补充。"];
  return [
    `# ${source.title}`,
    "",
    ...chunks.flatMap((chunk, index) => [
      `## 场景 ${index + 1}`,
      "",
      `### 镜头 ${index + 1}`,
      `- 画面：${chunk.slice(0, 160)}`,
      `- 动作：${chunk.slice(0, 220)}`,
      `- 字幕：${chunk.slice(0, 260)}`,
      `- 时长：${Math.max(3, Math.ceil(chunk.length / 8))}秒`,
      `- 图像提示词：${chunk.slice(0, 120)}`,
      "",
    ]),
  ].join("\n");
}

function unifiedScriptRequirements(): string {
  return [
    "这是一个统一的影视制作剧本，必须把分镜直接写在同一份剧本中，不要另起独立分镜文档。",
    "输出必须是 Markdown，严格使用：## 场景 N：场景名、### 镜头 N、- 画面：、- 景别/机位：、- 动作：、- 台词：或 - 字幕：、- 时长：N秒、- 图像提示词：。",
    "每个镜头都必须有可拍摄的画面、动作或环境，有可用于配音/字幕的台词或旁白；不要只写剧情摘要。",
    "镜头按剧情节奏拆分，保留开场、冲突、反转、高潮和结尾钩子；画面提示词要能直接作为后续参考图提示词。",
    "今天先做可制作的基础版本，镜头数量以素材长度和剧情节奏为准，不要为了凑数量重复内容。",
  ].join("\n");
}

function parseLlmVoiceConfig(raw: Record<string, unknown>, secrets: Record<string, unknown>): TtsConfig | null {
  const llm = raw.llm && typeof raw.llm === "object" && !Array.isArray(raw.llm)
    ? raw.llm as Record<string, unknown>
    : {};
  const voice = llm.voice && typeof llm.voice === "object" && !Array.isArray(llm.voice)
    ? llm.voice as Record<string, unknown>
    : {};
  const service = typeof voice.service === "string" ? voice.service : "bailian";
  if (service !== "bailian") return null;
  const model = typeof voice.model === "string" && voice.model.trim()
    ? voice.model.trim()
    : "cosyvoice-v3.5-plus";
  const services = secrets.services && typeof secrets.services === "object" && !Array.isArray(secrets.services)
    ? secrets.services as Record<string, unknown>
    : {};
  const entry = services[voiceSecretKey(service)];
  const apiKey = entry && typeof entry === "object" && !Array.isArray(entry)
    && typeof (entry as Record<string, unknown>).apiKey === "string"
    ? ((entry as Record<string, unknown>).apiKey as string).trim()
    : "";
  return apiKey ? { model, apiKey } : null;
}

async function readAudioResponse(response: Response): Promise<Buffer> {
  const body = await response.text();
  let data: { output?: { audio?: { data?: string; url?: string } }; code?: string; message?: string };
  try {
    data = JSON.parse(body) as typeof data;
  } catch {
    throw new Error("语音服务返回了无法解析的内容");
  }
  if (!response.ok) throw new Error(`语音合成失败：${data.message ?? data.code ?? response.status}`);
  const audio = data.output?.audio;
  if (audio?.data) return Buffer.from(audio.data, "base64");
  if (audio?.url) {
    const downloaded = await fetch(audio.url);
    if (!downloaded.ok) throw new Error(`语音文件下载失败：${downloaded.status}`);
    return Buffer.from(await downloaded.arrayBuffer());
  }
  throw new Error("语音服务没有返回音频");
}

async function synthesizeVoice(text: string, config: TtsConfig, outputPath: string): Promise<void> {
  const endpoint = config.model.toLowerCase().includes("cosyvoice")
    ? "https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer"
    : "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation";
  const input = config.model.toLowerCase().includes("cosyvoice")
    ? { text, voice: "longxiaochun", format: "wav", sample_rate: 24000 }
    : { text, voice: "longxiaochun", language_type: "Chinese" };
  const audio = await readAudioResponse(await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: config.model, input }),
  }));
  await writeFile(outputPath, audio);
}

function escapeFfmpegFilterPath(path: string): string {
  return path.replace(/\\/gu, "/").replace(/:/gu, "\\:").replace(/'/gu, "\\'");
}

async function composeVideo(args: {
  readonly productionDir: string;
  readonly script: UnifiedScriptDocument;
  readonly voiceConfig: TtsConfig | null;
  readonly withVoice: boolean;
}): Promise<{ durationMs: number; voiceEnabled: boolean; warning?: string }> {
  const entries = buildSubtitleEntries(args.script.shots);
  if (entries.length === 0) throw new Error("剧本中没有可用于字幕或配音的台词");
  const durationMs = entries[entries.length - 1]!.endTimeMs + 800;
  const tempDir = join(args.productionDir, ".tmp-video");
  await mkdir(tempDir, { recursive: true });
  const srtPath = join(tempDir, "story.srt");
  const audioPath = join(tempDir, "story.wav");
  const videoPath = join(args.productionDir, "story.mp4");
  await writeFile(srtPath, buildSrtContent(entries), "utf-8");

  let voiceEnabled = false;
  let warning: string | undefined;
  if (args.withVoice && args.voiceConfig) {
    try {
      const clips: string[] = [];
      for (const [index, shot] of args.script.shots.filter((item) => item.subtitle.trim()).slice(0, MAX_TTS_SHOTS).entries()) {
        const clipPath = join(tempDir, `clip-${index}.wav`);
        await synthesizeVoice(shot.subtitle.trim().slice(0, 600), args.voiceConfig, clipPath);
        clips.push(clipPath);
      }
      if (clips.length > 0) {
        await writeFile(join(tempDir, "audio-list.txt"), clips.map((path) => `file '${path.replace(/'/gu, "'\\''")}'`).join("\n"), "utf-8");
        await execFileAsync(FFMPEG_PATH, ["-y", "-f", "concat", "-safe", "0", "-i", join(tempDir, "audio-list.txt"), "-c", "copy", audioPath], { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
        voiceEnabled = true;
      }
    } catch (error) {
      warning = error instanceof Error ? `语音合成失败，已降级为字幕视频：${error.message}` : "语音合成失败，已降级为字幕视频";
    }
  } else if (args.withVoice) {
    warning = "未配置可用的语音模型或 API Key，已降级为字幕视频。";
  }

  const subtitleFilter = `subtitles='${escapeFfmpegFilterPath(srtPath)}':force_style='FontName=Microsoft YaHei,FontSize=24,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Outline=2,Alignment=2,MarginV=60'`;
  const baseArgs = [
    "-y",
    "-f", "lavfi",
    "-i", `color=c=0x101827:s=1280x720:r=24:d=${(durationMs / 1000).toFixed(3)}`,
    "-vf", subtitleFilter,
  ];
  const commandArgs = voiceEnabled
    ? [...baseArgs, "-i", audioPath, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "libx264", "-c:a", "aac", "-shortest", "-pix_fmt", "yuv420p", "-movflags", "+faststart", videoPath]
    : [...baseArgs, "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", videoPath];
  await execFileAsync(FFMPEG_PATH, commandArgs, { timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });
  return { durationMs, voiceEnabled, ...(warning ? { warning } : {}) };
}

async function readProduction(context: StudioRouteContext, kind: StoryKind, id: string) {
  const dir = productionPath(context.root, kind, id);
  const script = await readFile(join(dir, "script.md"), "utf-8").catch(() => "");
  const manifest = await readManifest(dir);
  const videoExists = await access(join(dir, "story.mp4")).then(() => true).catch(() => false);
  return {
    script: {
      exists: Boolean(script.trim()),
      content: script,
      ...(script.trim() ? parseUnifiedScript(script) : { title: "", shots: [] }),
      generatedAt: manifest.scriptGeneratedAt ?? null,
    },
    video: {
      exists: videoExists,
      durationMs: manifest.videoDurationMs ?? null,
      voiceEnabled: manifest.voiceEnabled ?? false,
      warning: manifest.warning ?? null,
      generatedAt: manifest.videoGeneratedAt ?? null,
    },
  };
}

function registerProductionRoutesForKind(context: StudioRouteContext, kind: StoryKind): void {
  const prefix = kind === "short" ? "/api/v1/shorts" : "/api/v1/books";

  context.app.get(`${prefix}/:id/production`, async (c) => {
    const id = c.req.param("id");
    if (!isSafeStoryId(id)) return c.json({ error: "Invalid story id" }, 400);
    return c.json(await readProduction(context, kind, id));
  });

  context.app.post(`${prefix}/:id/production/script`, async (c) => {
    const id = c.req.param("id");
    if (!isSafeStoryId(id)) return c.json({ error: "Invalid story id" }, 400);
    const source = await readStorySource(context, kind, id);
    if (!source.text.trim()) return c.json({ error: "故事正文为空，无法生成剧本" }, 400);
    const dir = productionPath(context.root, kind, id);
    await mkdir(dir, { recursive: true });
    let content: string;
    let warning: string | undefined;
    try {
      const pipeline = new PipelineRunner(await context.buildPipelineConfig());
      const agent = new ScriptCreationAgent(pipeline.createAgentContext("script"));
      content = await agent.writeScript({
        title: source.title,
        sourceKind: kind === "short" ? "StoryOS short story" : "StoryOS book",
        targetFormat: "general_script",
        sourceText: source.text.slice(0, MAX_SOURCE_CHARS),
        requirements: unifiedScriptRequirements(),
        language: "zh",
      });
      if (!parseUnifiedScript(content).shots.length) throw new Error("模型没有输出可解析的镜头");
    } catch (error) {
      content = fallbackUnifiedScript(source);
      warning = error instanceof Error ? `模型剧本生成失败，已生成基础脚本：${error.message}` : "模型剧本生成失败，已生成基础脚本";
    }
    const generatedAt = new Date().toISOString();
    await writeFile(join(dir, "script.md"), content.trimEnd() + "\n", "utf-8");
    await writeFile(join(dir, "manifest.json"), JSON.stringify({ scriptGeneratedAt: generatedAt, ...(warning ? { warning } : {}) }, null, 2), "utf-8");
    return c.json({ ...(await readProduction(context, kind, id)), warning: warning ?? null });
  });

  context.app.post(`${prefix}/:id/production/video`, async (c) => {
    const id = c.req.param("id");
    if (!isSafeStoryId(id)) return c.json({ error: "Invalid story id" }, 400);
    const dir = productionPath(context.root, kind, id);
    const script = await readFile(join(dir, "script.md"), "utf-8").catch(() => "");
    if (!script.trim()) return c.json({ error: "请先在剧本阶段生成剧本" }, 400);
    const body: { voice?: boolean } = await c.req.json<{ voice?: boolean }>().catch(() => ({ voice: undefined }));
    const raw = await context.loadRawConfig();
    const secrets = await context.loadSecrets();
    const result = await composeVideo({
      productionDir: dir,
      script: parseUnifiedScript(script),
      voiceConfig: parseLlmVoiceConfig(raw, secrets as unknown as Record<string, unknown>),
      withVoice: body.voice !== false,
    });
    const previous = await readManifest(dir);
    await writeFile(join(dir, "manifest.json"), JSON.stringify({
      ...previous,
      videoGeneratedAt: new Date().toISOString(),
      videoDurationMs: result.durationMs,
      voiceEnabled: result.voiceEnabled,
      ...(result.warning ? { warning: result.warning } : {}),
    }, null, 2), "utf-8");
    return c.json({ ...(await readProduction(context, kind, id)), warning: result.warning ?? null });
  });

  context.app.get(`${prefix}/:id/production/video/file`, async (c) => {
    const id = c.req.param("id");
    if (!isSafeStoryId(id)) return c.json({ error: "Invalid story id" }, 400);
    const file = await readFile(join(productionPath(context.root, kind, id), "story.mp4")).catch(() => null);
    if (!file) return c.json({ error: "Video not found" }, 404);
    return new Response(file, { headers: { "Content-Type": "video/mp4", "Cache-Control": "no-cache" } });
  });
}

export function registerStoryProductionRoutes(context: StudioRouteContext): void {
  registerProductionRoutesForKind(context, "short");
  registerProductionRoutesForKind(context, "book");
}
