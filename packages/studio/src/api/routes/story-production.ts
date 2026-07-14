import { execFile } from "node:child_process";
import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  PipelineRunner,
  ScriptCreationAgent,
  voiceSecretKey,
  type StoryAsset,
  type StoryAssetKind,
  type StoryAssetManifest,
} from "@actalk/inkos-core";
import type { StudioRouteContext } from "./context.js";
import { isSafeBookId } from "../safety.js";
import {
  buildAssContent,
  buildSubtitleEntries,
  parseUnifiedScript,
  type UnifiedScriptDocument,
  type UnifiedScriptShot,
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

/** 读取故事资产清单（角色 / 场景 / 道具），资产未提取时返回空数组。 */
async function readStoryAssets(root: string, kind: StoryKind, id: string): Promise<StoryAsset[]> {
  const manifest = await readJson<StoryAssetManifest>(join(kindPath(root, kind, id), "assets", "manifest.json"));
  return manifest?.assets ?? [];
}

const ASSET_KIND_LABELS: Record<StoryAssetKind, { zh: string; field: string }> = {
  character: { zh: "角色", field: "人物/角色" },
  scene: { zh: "场景", field: "场景/环境" },
  prop: { zh: "道具", field: "道具/物件" },
};

/** 把资产格式化成模型可用的 Markdown 上下文，按角色/场景/道具分组。 */
export function buildAssetsContext(assets: ReadonlyArray<StoryAsset>): string {
  const byKind = (kind: StoryAssetKind) => assets.filter((asset) => asset.kind === kind);
  const sections: string[] = [];

  for (const kind of ["character", "scene", "prop"] as const) {
    const list = byKind(kind);
    if (list.length === 0) continue;
    const label = ASSET_KIND_LABELS[kind];
    const lines = list.map((asset) => {
      const parts = [`- ${asset.name}`];
      const aliasText = asset.aliases?.filter(Boolean).join("、");
      if (aliasText) parts.push(`（别名：${aliasText}）`);
      if (asset.summary.trim()) parts.push(`：${asset.summary.trim()}`);
      const detailEntries = Object.entries(asset.details).filter(([, value]) => value?.trim());
      if (detailEntries.length > 0) parts.push(detailEntries.map(([key, value]) => `${key}：${value.trim()}`).join("；"));
      if (asset.imagePrompt.trim()) parts.push(`。视觉参考：${asset.imagePrompt.trim()}`);
      return parts.join("");
    });
    sections.push(`### ${label.zh}\n${lines.join("\n")}`);
  }

  return sections.length > 0
    ? `## 故事资产（生成分镜时必须引用这些资产，并在「- 画面：」行末用【资产名】标注出场的角色/场景/道具）\n\n${sections.join("\n\n")}`
    : "";
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
    ...chunks.flatMap((chunk, index) => {
      // 旁白取讲述性内容（较长），画面取视觉摘要（较短）
      const narration = chunk.slice(0, 80);
      const visual = chunk.slice(0, 40);
      return [
        `## 场景 ${index + 1}`,
        "",
        `### 镜头 ${index + 1}`,
        `- 画面：${visual}`,
        `- 旁白：${narration}`,
        `- 时长：${Math.max(3, Math.ceil(narration.length / 8))}秒`,
        `- 图像提示词：${visual}`,
        "",
      ];
    }),
  ].join("\n");
}

function unifiedScriptRequirements(): string {
  return [
    "这是一个统一的影视制作剧本，用于把故事制作成短视频，必须把分镜直接写在同一份剧本中，不要另起独立分镜文档。",
    "输出必须是 Markdown，严格使用：## 场景 N：场景名、### 镜头 N、- 画面：、- 景别/机位：、- 动作：、- 旁白：、- 时长：N秒、- 图像提示词：。",
    "这是旁白驱动的短视频：旁白是视频的主线，用来讲述故事、推进情绪；画面是为旁白服务的视觉呈现。先想好这一镜头要说什么（旁白），再设计匹配的画面。",
    "每一个镜头都必须有旁白，没有旁白的镜头是不允许的——没有旁白就没有声音，这个镜头就不该存在。",
    "字幕就是旁白，旁白就是字幕：统一用「- 旁白：」字段写，不要另外写「台词」「字幕」「对白」。旁白内容会被直接用做配音和字幕。",
    "旁白要用口语化、有画面感的讲述语气，像在给观众讲故事；每条旁白 20-80 字，一个镜头一段旁白，一个旁白对应一个分镜。",
    "「- 画面：」只写这个镜头观众能看到的内容：谁、在哪、做什么、关键细节。如果画面里出现了故事资产中的角色/场景/道具，必须在画面描述末尾用【资产名】标注出来，例如：走廊尽头站着一个穿白裙的女人【林小雨】。没有资产可引用时不用标注。",
    "「- 景别/机位：」每个镜头都要写，从这些里选：远景（全景交代环境）、全景（人物全身）、中景（人物腰部以上）、近景（胸部以上）、特写（面部或手部细节）、大特写（极局部）。不同景别交替使用，避免全是同一种。",
    "「- 图像提示词：」必须详细，不能只写几个字。格式：主体（谁、穿着、表情/动作）+ 场景环境 + 光线/色调 + 构图/景别 + 氛围/情绪。例如：「年轻女人，黑色长发，穿白色连衣裙，低头微笑，站在昏暗老旧的电梯里，冷蓝色调，侧光，中景，压抑不安的氛围」。每条 30-60 字。",
    "镜头按剧情节奏拆分，保留开场、冲突、反转、高潮和结尾钩子。",
    "镜头数量以素材长度和剧情节奏为准，不要为了凑数量重复内容；宁可多拆几个旁白清晰的镜头，也不要合并成长段落。",
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

interface SceneGroup {
  readonly index: number;
  readonly name: string;
  readonly shots: ReadonlyArray<UnifiedScriptShot>;
}

function groupShotsByScene(shots: ReadonlyArray<UnifiedScriptShot>): SceneGroup[] {
  const groups: SceneGroup[] = [];
  for (const shot of shots) {
    const last = groups[groups.length - 1];
    if (last && last.name === shot.scene) {
      (groups[groups.length - 1]!.shots as UnifiedScriptShot[]).push(shot);
    } else {
      groups.push({ index: groups.length, name: shot.scene, shots: [shot] });
    }
  }
  return groups;
}

async function composeSegmentVideo(args: {
  readonly tempDir: string;
  readonly outputPath: string;
  readonly shots: ReadonlyArray<UnifiedScriptShot>;
  readonly voiceConfig: TtsConfig | null;
  readonly withVoice: boolean;
}): Promise<{ durationMs: number; voiceEnabled: boolean; warning?: string }> {
  const entries = buildSubtitleEntries(args.shots);
  if (entries.length === 0) throw new Error("场景中没有可用于字幕或配音的台词");
  const durationMs = entries[entries.length - 1]!.endTimeMs + 800;
  await mkdir(args.tempDir, { recursive: true });
  const assPath = join(args.tempDir, "sub.ass");
  const audioPath = join(args.tempDir, "audio.wav");
  await writeFile(assPath, buildAssContent(entries, { blur: 4, fontSize: 12 }), "utf-8");

  let voiceEnabled = false;
  let warning: string | undefined;
  if (args.withVoice && args.voiceConfig) {
    try {
      const clips: string[] = [];
      for (const [index, shot] of args.shots.filter((item) => item.subtitle.trim()).slice(0, MAX_TTS_SHOTS).entries()) {
        const clipPath = join(args.tempDir, `clip-${index}.wav`);
        await synthesizeVoice(shot.subtitle.trim().slice(0, 600), args.voiceConfig, clipPath);
        clips.push(clipPath);
      }
      if (clips.length > 0) {
        await writeFile(join(args.tempDir, "audio-list.txt"), clips.map((path) => `file '${path.replace(/'/gu, "'\\''")}'`).join("\n"), "utf-8");
        await execFileAsync(FFMPEG_PATH, ["-y", "-f", "concat", "-safe", "0", "-i", join(args.tempDir, "audio-list.txt"), "-c", "copy", audioPath], { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
        voiceEnabled = true;
      }
    } catch (error) {
      warning = error instanceof Error ? `语音合成失败，已降级为字幕视频：${error.message}` : "语音合成失败，已降级为字幕视频";
    }
  } else if (args.withVoice) {
    warning = "未配置可用的语音模型或 API Key，已降级为字幕视频。";
  }

  const subtitleFilter = `subtitles='${escapeFfmpegFilterPath(assPath)}'`;
  const baseArgs = [
    "-y",
    "-f", "lavfi",
    "-i", `color=c=3B2F2F:s=1280x720:r=24:d=${(durationMs / 1000).toFixed(3)}`,
    "-vf", subtitleFilter,
  ];
  const commandArgs = voiceEnabled
    ? [...baseArgs, "-i", audioPath, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "libx264", "-c:a", "aac", "-shortest", "-pix_fmt", "yuv420p", "-movflags", "+faststart", args.outputPath]
    : [...baseArgs, "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", args.outputPath];
  await execFileAsync(FFMPEG_PATH, commandArgs, { timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });
  return { durationMs, voiceEnabled, ...(warning ? { warning } : {}) };
}

async function composeVideo(args: {
  readonly productionDir: string;
  readonly script: UnifiedScriptDocument;
  readonly voiceConfig: TtsConfig | null;
  readonly withVoice: boolean;
}): Promise<{ durationMs: number; voiceEnabled: boolean; warning?: string; scenes: SceneGroup[] }> {
  const scenes = groupShotsByScene(args.script.shots);
  if (scenes.length === 0) throw new Error("剧本中没有可用于字幕或配音的台词");

  const scenesDir = join(args.productionDir, "scenes");
  await mkdir(scenesDir, { recursive: true });
  const tempDir = join(args.productionDir, ".tmp-video");
  await mkdir(tempDir, { recursive: true });

  let voiceEnabled = false;
  let warning: string | undefined;
  const segmentPaths: string[] = [];

  for (const scene of scenes) {
    const sceneOutput = join(scenesDir, `scene-${String(scene.index).padStart(3, "0")}.mp4`);
    const sceneTemp = join(tempDir, `scene-${scene.index}`);
    const result = await composeSegmentVideo({
      tempDir: sceneTemp,
      outputPath: sceneOutput,
      shots: scene.shots,
      voiceConfig: args.voiceConfig,
      withVoice: args.withVoice,
    }).catch((error) => {
      warning = `场景 ${scene.index + 1}「${scene.name}」视频生成失败：${error instanceof Error ? error.message : String(error)}`;
      return null;
    });
    if (result) {
      segmentPaths.push(sceneOutput);
      if (result.voiceEnabled) voiceEnabled = true;
      if (result.warning && !warning) warning = result.warning;
    }
  }

  if (segmentPaths.length === 0) throw new Error("所有场景视频生成失败");

  // 拼接合集
  const videoPath = join(args.productionDir, "story.mp4");
  if (segmentPaths.length === 1) {
    const file = await readFile(segmentPaths[0]!);
    await writeFile(videoPath, file);
  } else {
    const listPath = join(tempDir, "concat-list.txt");
    await writeFile(listPath, segmentPaths.map((path) => `file '${path.replace(/\\/gu, "/").replace(/'/gu, "'\\''")}'`).join("\n"), "utf-8");
    await execFileAsync(FFMPEG_PATH, [
      "-y", "-f", "concat", "-safe", "0", "-i", listPath,
      "-c", "copy", "-movflags", "+faststart", videoPath,
    ], { timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });
  }

  // 计算合集总时长：读每个场景文件太慢，用字幕估算
  const totalDurationMs = scenes.reduce((sum, scene) => {
    const entries = buildSubtitleEntries(scene.shots);
    const sceneDuration = entries.length > 0 ? entries[entries.length - 1]!.endTimeMs + 800 : 0;
    return sum + sceneDuration;
  }, 0);

  return { durationMs: totalDurationMs, voiceEnabled, ...(warning ? { warning } : {}), scenes };
}

async function readProduction(context: StudioRouteContext, kind: StoryKind, id: string) {
  const dir = productionPath(context.root, kind, id);
  const script = await readFile(join(dir, "script.md"), "utf-8").catch(() => "");
  const manifest = await readManifest(dir);
  const videoExists = await access(join(dir, "story.mp4")).then(() => true).catch(() => false);
  const parsed = script.trim() ? parseUnifiedScript(script) : null;

  // 场景列表：从剧本分组，检查每个场景视频是否存在
  const sceneList = parsed ? groupShotsByScene(parsed.shots).map((scene) => {
    const sceneFile = join(dir, "scenes", `scene-${String(scene.index).padStart(3, "0")}.mp4`);
    return {
      index: scene.index,
      name: scene.name,
      shotCount: scene.shots.length,
      videoExists: false as boolean, // 异步检查在下面做
    };
  }) : [];

  // 批量检查场景视频文件是否存在
  if (sceneList.length > 0) {
    const scenesDir = join(dir, "scenes");
    const checks = await Promise.all(
      sceneList.map((s) =>
        access(join(scenesDir, `scene-${String(s.index).padStart(3, "0")}.mp4`))
          .then(() => true).catch(() => false),
      ),
    );
    checks.forEach((exists, i) => { sceneList[i]!.videoExists = exists; });
  }

  return {
    script: {
      exists: Boolean(script.trim()),
      content: script,
      ...(parsed ?? { title: "", shots: [] }),
      generatedAt: manifest.scriptGeneratedAt ?? null,
    },
    video: {
      exists: videoExists,
      durationMs: manifest.videoDurationMs ?? null,
      voiceEnabled: manifest.voiceEnabled ?? false,
      warning: manifest.warning ?? null,
      generatedAt: manifest.videoGeneratedAt ?? null,
    },
    scenes: sceneList,
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
      // 读取故事资产（角色/场景/道具），拼进生成提示词，让模型能引用具体设定。
      const assets = await readStoryAssets(context.root, kind, id);
      const assetsContext = buildAssetsContext(assets);
      const requirements = assetsContext
        ? `${unifiedScriptRequirements()}\n\n${assetsContext}`
        : unifiedScriptRequirements();
      const pipeline = new PipelineRunner(await context.buildPipelineConfig());
      const agent = new ScriptCreationAgent(pipeline.createAgentContext("script"));
      content = await agent.writeScript({
        title: source.title,
        sourceKind: kind === "short" ? "StoryOS short story" : "StoryOS book",
        targetFormat: "general_script",
        sourceText: source.text.slice(0, MAX_SOURCE_CHARS),
        requirements,
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

  context.app.post(`${prefix}/:id/production/video/scene/:index`, async (c) => {
    const id = c.req.param("id");
    if (!isSafeStoryId(id)) return c.json({ error: "Invalid story id" }, 400);
    const index = Number(c.req.param("index"));
    if (!Number.isInteger(index) || index < 0) return c.json({ error: "Invalid scene index" }, 400);
    const dir = productionPath(context.root, kind, id);
    const scriptText = await readFile(join(dir, "script.md"), "utf-8").catch(() => "");
    if (!scriptText.trim()) return c.json({ error: "请先在剧本阶段生成剧本" }, 400);
    const scenes = groupShotsByScene(parseUnifiedScript(scriptText).shots);
    const scene = scenes.find((item) => item.index === index);
    if (!scene) return c.json({ error: "场景不存在" }, 404);
    const body: { voice?: boolean } = await c.req.json<{ voice?: boolean }>().catch(() => ({ voice: undefined }));
    const raw = await context.loadRawConfig();
    const secrets = await context.loadSecrets();
    const scenesDir = join(dir, "scenes");
    const tempDir = join(dir, ".tmp-video", `scene-${index}`);
    await mkdir(scenesDir, { recursive: true });
    await mkdir(tempDir, { recursive: true });
    const sceneOutput = join(scenesDir, `scene-${String(index).padStart(3, "0")}.mp4`);
    const result = await composeSegmentVideo({
      tempDir,
      outputPath: sceneOutput,
      shots: scene.shots,
      voiceConfig: parseLlmVoiceConfig(raw, secrets as unknown as Record<string, unknown>),
      withVoice: body.voice !== false,
    });
    // 单场景生成不更新合集（story.mp4）：合集可能因此与单场景不一致，
    // 前端可提示用户重新生成合集以合并最新场景。
    return c.json({ ...(await readProduction(context, kind, id)), warning: result.warning ?? null });
  });

  context.app.get(`${prefix}/:id/production/video/file`, async (c) => {
    const id = c.req.param("id");
    if (!isSafeStoryId(id)) return c.json({ error: "Invalid story id" }, 400);
    const file = await readFile(join(productionPath(context.root, kind, id), "story.mp4")).catch(() => null);
    if (!file) return c.json({ error: "Video not found" }, 404);
    return new Response(file, { headers: { "Content-Type": "video/mp4", "Cache-Control": "no-cache" } });
  });

  context.app.get(`${prefix}/:id/production/video/scene/:index/file`, async (c) => {
    const id = c.req.param("id");
    if (!isSafeStoryId(id)) return c.json({ error: "Invalid story id" }, 400);
    const index = Number(c.req.param("index"));
    if (!Number.isInteger(index) || index < 0) return c.json({ error: "Invalid scene index" }, 400);
    const sceneFile = join(productionPath(context.root, kind, id), "scenes", `scene-${String(index).padStart(3, "0")}.mp4`);
    const file = await readFile(sceneFile).catch(() => null);
    if (!file) return c.json({ error: "Scene video not found" }, 404);
    return new Response(file, { headers: { "Content-Type": "video/mp4", "Cache-Control": "no-cache" } });
  });
}

export function registerStoryProductionRoutes(context: StudioRouteContext): void {
  registerProductionRoutesForKind(context, "short");
  registerProductionRoutesForKind(context, "book");
}
