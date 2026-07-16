import { execFile } from "node:child_process";
import { access, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  PipelineRunner,
  ScriptCreationAgent,
  generateImageFromPrompt,
  resolveCoverGenerationRequest,
  voiceSecretKey,
  type ShortFictionCoverRequest,
  type StoryAsset,
  type StoryAssetKind,
  type StoryAssetManifest,
  validateSourceSegmentRef,
  type SourceSegmentRef,
  appendImageStylePrompt,
  resolveImageStyleDescription,
  type ArtStyle,
} from "@actalk/inkos-core";
import type { StudioRouteContext } from "./context.js";
import { ProductionTaskRegistry, type ProductionTaskKind } from "../background-production-tasks.js";
import { resolveStoryArtStyle, resolveStoryCraftId } from "../story-art-style.js";
import { isSafeBookId } from "../safety.js";
import { resolveCraftSourceFile } from "../craft-source-assets.js";
import {
  buildAssContent,
  buildSubtitleEntries,
  formatScriptIssues,
  parseUnifiedScript,
  shouldRetryScriptQuality,
  validateScriptQuality,
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

export interface ProductionManifest {
  readonly craftId?: string;
  readonly scriptGeneratedAt?: string;
  readonly videoGeneratedAt?: string;
  readonly videoDurationMs?: number;
  readonly voiceEnabled?: boolean;
  readonly sceneVideoGeneratedAt?: Readonly<Record<string, string>>;
  readonly warning?: string;
}

/**
 * A scene render replaces one input of the aggregate video. Keep the scene
 * timestamp, but remove aggregate metadata so the UI cannot present the old
 * story.mp4 as if it still matched the current scene set.
 */
export function markSceneVideoGenerated(
  previous: ProductionManifest,
  sceneIndex: number,
  generatedAt: string,
): ProductionManifest {
  return {
    ...previous,
    videoGeneratedAt: undefined,
    videoDurationMs: undefined,
    voiceEnabled: undefined,
    sceneVideoGeneratedAt: {
      ...previous.sceneVideoGeneratedAt,
      [String(sceneIndex)]: generatedAt,
    },
  };
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
    ? `## 故事资产（生成分镜时必须引用这些资产。在「- 画面：」里用【资产名】标注出场的角色和道具，场景不用标注——场景已经是分区标题了）\n\n${sections.join("\n\n")}`
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

async function readConfirmedSourceSegments(root: string, craftId: string | undefined): Promise<ReadonlyMap<string, SourceSegmentRef>> {
  if (!craftId || !isSafeBookId(craftId)) return new Map();
  const sourceDir = join(root, "crafts", craftId, "source", "timeline");
  const timeline = await readJson<{ durationSeconds?: unknown }>(join(sourceDir, "timeline.json"));
  const matches = await readJson<Array<{
    id?: unknown;
    status?: unknown;
    sourceStartSeconds?: unknown;
    sourceEndSeconds?: unknown;
  }>>(join(sourceDir, "source-matches.json"));
  if (typeof timeline?.durationSeconds !== "number" || !matches) return new Map();
  const result = new Map<string, SourceSegmentRef>();
  for (const match of matches) {
    if (typeof match.id !== "string" || match.status !== "confirmed" || typeof match.sourceStartSeconds !== "number" || typeof match.sourceEndSeconds !== "number") continue;
    const ref: SourceSegmentRef = {
      matchId: match.id,
      sourceFileKey: "sourceVideo",
      startSeconds: match.sourceStartSeconds,
      endSeconds: match.sourceEndSeconds,
      status: "confirmed",
    };
    if (validateSourceSegmentRef(ref, timeline.durationSeconds).ok) result.set(ref.matchId, ref);
  }
  return result;
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

export function unifiedScriptRequirements(): string {
  return [
    "这是一个统一的影视制作剧本，用于把故事制作成短视频，必须把分镜直接写在同一份剧本中，不要另起独立分镜文档。",
    "输出必须是 Markdown，严格使用：## 场景 N：场景名、### 镜头 N、- 画面：、- 景别/机位：、- 动作：、- 旁白：、- 时长：N秒、- 图像提示词：。",
    "不要输出 ---、***、``` 等分隔符或格式标记，不要在镜头末尾加分隔线。",
    "",
    "## 场景拆分（关键）",
    "场景要按「视觉空间」拆分，不能只按地点。同一个地点的不同区域，只要画面看起来不一样，就是不同的场景。",
    "举例：同样是出租屋，卧室、卫生间、客厅、阳台是 4 个场景——每个要单独生图，画面完全不同。",
    "再举例：上出租车是一个场景（车外），坐进车厢里是另一个场景（车内），车辆行驶中又是另一个场景。每个场景的空间、光线、构图都不同。",
    "场景标题要具体到空间区域，不能只写「家里」，要写「出租屋·卧室」「出租屋·卫生间」。宁可场景多拆，也不要把视觉上不同的空间混在一个场景里。",
    "",
    "## 旁白（关键——决定视频质量）",
    "这是旁白驱动的短视频：旁白是视频的主线，直接用于配音和字幕。先想好这一镜头要说什么（旁白），再设计匹配的画面。",
    "每一个镜头都必须有旁白，没有旁白的镜头不允许存在。统一用「- 旁白：」字段写，不要写「台词」「字幕」「对白」。",
    "",
    "### 口语化原则（最重要）",
    "旁白是说给人听的，不是写给人看的。用大白话，像跟朋友讲故事。",
    "禁止书面语和学术腔：不写「尾调」「复调」「徒劳」「认知滤镜」这类词，写「回味」「不搭」「白费」「看走眼了」。",
    "禁止哲学总结：不写「安全与危险的边界从来不是物理的」，写「我说不清那到底是危险还是安全了」。",
    "禁止抽象比喻：不写「介于记忆与现实之间的色调」，写「说不清是真是假」。",
    "好旁白示例：「那股味不对。甜的，腻的，像烂掉的东西。」——短、直白、有画面。",
    "坏旁白示例：「蜂蜜发酵后的腻，混着铁锈般的腥涩，尾调里有一丝奶腐」——太文艺，读出来做作。",
    "",
    "### 开场钩子（第一个镜头必须抓住人）",
    "第一个镜头的旁白必须是钩子——一句话制造悬念或冲突，让观众想知道接下来发生什么。",
    "好的开场：「我父亲的命，攥在一个陌生司机的手里。但我上车，是因为钱。」",
    "坏的开场：「那股甜味上来的时候，我正在核对父亲的腕带。」——没有冲突，没人想继续看。",
    "",
    "### 信息控制",
    "每条旁白只传递一个核心信息或一个情绪转折，不要塞背景设定。",
    "坏示例：一条旁白里同时讲「顺位17」「凌晨抢号」「职称评审」「抗排异治疗」——听众根本消化不了。",
    "好做法：这条只说「等一个肺，等了三年，终于轮到我爸了」。背景细节分散到后面的镜头里。",
    "",
    "### 收尾干脆",
    "最后一个镜头的旁白要留白、留悬念，不要总结主题或升华哲学。",
    "好的结尾：「我站在废墟里，再也分不清了。」——一句话，余味悠长。",
    "坏的结尾：「安全与危险的边界从来不是物理的，它是认知的，是我亲手拆毁的围墙。」——嚼碎了喂，没有回味。",
    "",
    "### 篇幅",
    "每条旁白 15-50 字。一个镜头一段旁白。宁可短，不要长。短句比长句有力量。",
    "旁白只做讲述，不要写角色对话、不要写声音描述（如「啪嗒啪嗒」「嗡鸣声」）。",
    "",
    "## 画面与资产标注（关键）",
    "「- 画面：」只写这个镜头观众能看到的内容：谁、在哪、做什么、关键细节。只写视觉信息，不写声音、不写心理活动。",
    "画面里出现的角色和道具，必须用中括号标注出来，写法是【角色名】【道具名】，紧跟在对应的人或物后面。",
    "例如：沈知遥【沈知遥】攥紧父亲的腕带【父亲腕带】，低头看着上面的字。",
    "再例如：何叔【何叔】从储物格里翻出一瓶消毒液【酚类消毒液瓶】。",
    "注意：场景不用标注（场景已经是分区标题了），只标注角色和道具。如果画面里没有已知的角色或道具，就不用标注。",
    "",
    "## 景别与图像提示词",
    "「- 景别/机位：」每个镜头都要写，从这些里选：远景（全景交代环境）、全景（人物全身）、中景（人物腰部以上）、近景（胸部以上）、特写（面部或手部细节）、大特写（极局部）。不同景别交替使用，避免全是同一种。",
    "「- 图像提示词：」必须详细，不能只写几个字。格式：主体（谁、穿着、表情/动作）+ 场景环境 + 光线/色调 + 构图/景别 + 氛围/情绪。",
    "图像提示词中不要用代词（他/她/它），要用具体的外貌描述。例如不写「她低头」，写「年轻女性低头，黑色长发垂落」。",
    "每条图像提示词 40-80 字。",
    "「- 时长：」根据旁白字数估算，每字约 0.3 秒，一般 3-6 秒，不要超过 8 秒。",
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

/**
 * Resolve the cover/image generation config for per-shot video frames.
 * Returns null if no image provider is configured — the video composer
 * will fall back to a solid-color background in that case.
 */
async function resolveImageConfig(root: string): Promise<ShortFictionCoverRequest | null> {
  try {
    return await resolveCoverGenerationRequest({ root });
  } catch {
    return null;
  }
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
  readonly imageConfig?: ShortFictionCoverRequest | null;
  readonly artStyle: ArtStyle;
  readonly imageCacheDir?: string;
  readonly sourceVideoPath?: string;
}): Promise<{ durationMs: number; voiceEnabled: boolean; warning?: string }> {
  const entries = buildSubtitleEntries(args.shots);
  if (entries.length === 0) throw new Error("场景中没有可用于字幕或配音的台词");
  const durationMs = entries[entries.length - 1]!.endTimeMs + 800;
  await mkdir(args.tempDir, { recursive: true });
  const assPath = join(args.tempDir, "sub.ass");
  const audioPath = join(args.tempDir, "audio.wav");
  await writeFile(assPath, buildAssContent(entries, { blur: 5, fontSize: 36, marginV: 64 }), "utf-8");

  let voiceEnabled = false;
  let warning: string | undefined;
  const sourceRef = args.shots.find((shot) => shot.sourceSegmentRef)?.sourceSegmentRef;
  if (sourceRef && !args.sourceVideoPath) {
    throw new Error("已指定原片引用，但原片文件不可用；不会改用其他图片或解说视频");
  }
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

  // Generate per-shot images if image config is available.
  let backgroundImage: string | null = null;
  if (!sourceRef && args.imageConfig) {
    const cacheDir = args.imageCacheDir ?? args.tempDir;
    await mkdir(cacheDir, { recursive: true });
    const shotsWithPrompts = args.shots.filter((shot) => shot.imagePrompt?.trim());
    const imagePaths: string[] = [];
    let imageWarning: string | undefined;
    for (const [index, shot] of shotsWithPrompts.entries()) {
      const imgPath = join(cacheDir, `shot-${String(index + 1).padStart(3, "0")}.png`);
      // Skip if cached (user can delete files to force regen).
      if (existsSync(imgPath)) {
        imagePaths.push(imgPath);
        continue;
      }
      try {
        const result = await generateImageFromPrompt(
          args.imageConfig,
          appendImageStylePrompt(shot.imagePrompt!.trim(), "shot", args.artStyle),
          "1280x720",
        );
        await writeFile(imgPath, result.buffer);
        imagePaths.push(imgPath);
      } catch (error) {
        imageWarning = error instanceof Error ? `部分镜头图片生成失败：${error.message}` : "部分镜头图片生成失败";
      }
    }
    if (imagePaths.length > 0) {
      // Use the first generated image as the background with a slow zoom (Ken Burns).
      backgroundImage = imagePaths[0]!;
    }
    if (imageWarning && !warning) warning = imageWarning;
  }

  const subtitleFilter = `subtitles='${escapeFfmpegFilterPath(assPath)}'`;
  const durationSec = (durationMs / 1000).toFixed(3);

  let baseArgs: string[];
  if (sourceRef && args.sourceVideoPath) {
    const sourceDurationSec = Math.max(0.1, sourceRef.endSeconds - sourceRef.startSeconds);
    baseArgs = [
      "-y",
      "-ss", sourceRef.startSeconds.toFixed(3),
      "-i", args.sourceVideoPath,
      "-t", sourceDurationSec.toFixed(3),
      "-vf", `scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,${subtitleFilter}`,
    ];
  } else if (backgroundImage) {
    // Image background with slow zoom + subtitles.
    const zoomFilter = `scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,zoompan=z='min(zoom+0.0008,1.15)':d=${Math.ceil(Number(durationSec) * 24)}:s=1280x720:fps=24,${subtitleFilter}`;
    baseArgs = [
      "-y",
      "-loop", "1",
      "-i", backgroundImage,
      "-t", durationSec,
      "-vf", zoomFilter,
    ];
  } else {
    // Fallback: solid color background + subtitles.
    baseArgs = [
      "-y",
      "-f", "lavfi",
      "-i", `color=c=3B2F2F:s=1280x720:r=24:d=${durationSec}`,
      "-vf", subtitleFilter,
    ];
  }
  const commandArgs = voiceEnabled
    ? [...baseArgs, "-i", audioPath, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "libx264", "-c:a", "aac", "-shortest", "-pix_fmt", "yuv420p", "-movflags", "+faststart", args.outputPath]
    : [...baseArgs, "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", args.outputPath];
  await execFileAsync(FFMPEG_PATH, commandArgs, { timeout: 180_000, maxBuffer: 8 * 1024 * 1024 });
  return { durationMs, voiceEnabled, ...(warning ? { warning } : {}) };
}

async function composeVideo(args: {
  readonly productionDir: string;
  readonly script: UnifiedScriptDocument;
  readonly voiceConfig: TtsConfig | null;
  readonly withVoice: boolean;
  readonly imageConfig?: ShortFictionCoverRequest | null;
  readonly sourceVideoPath?: string;
  readonly artStyle: ArtStyle;
}): Promise<{ durationMs: number; voiceEnabled: boolean; warning?: string; scenes: SceneGroup[] }> {
  const scenes = groupShotsByScene(args.script.shots);
  if (scenes.length === 0) throw new Error("剧本中没有可用于字幕或配音的台词");

  const scenesDir = join(args.productionDir, "scenes");
  await mkdir(scenesDir, { recursive: true });
  const tempDir = join(args.productionDir, ".tmp-video");
  await mkdir(tempDir, { recursive: true });
  const imageCacheDir = join(args.productionDir, "images");
  if (args.imageConfig) await mkdir(imageCacheDir, { recursive: true });

  let voiceEnabled = false;
  let warning: string | undefined;
  const segmentPaths: string[] = [];

  for (const scene of scenes) {
    const sceneOutput = join(scenesDir, `scene-${String(scene.index).padStart(3, "0")}.mp4`);
    const sceneTemp = join(tempDir, `scene-${scene.index}`);
    const sceneImageCache = args.imageConfig ? join(imageCacheDir, `scene-${scene.index}`) : undefined;
    const result = await composeSegmentVideo({
      tempDir: sceneTemp,
      outputPath: sceneOutput,
      shots: scene.shots,
      voiceConfig: args.voiceConfig,
      withVoice: args.withVoice,
      imageConfig: args.imageConfig,
      artStyle: args.artStyle,
      imageCacheDir: sceneImageCache,
      sourceVideoPath: args.sourceVideoPath,
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
  const confirmedSourceSegments = await readConfirmedSourceSegments(context.root, manifest.craftId);
  const parsed = script.trim() ? parseUnifiedScript(script, { confirmedSourceSegments }) : null;

  // 场景列表：从剧本分组，检查每个场景视频是否存在
  const sceneList = parsed ? groupShotsByScene(parsed.shots).map((scene) => {
    const sceneFile = join(dir, "scenes", `scene-${String(scene.index).padStart(3, "0")}.mp4`);
    return {
      index: scene.index,
      name: scene.name,
      shotCount: scene.shots.length,
      videoExists: false as boolean, // 异步检查在下面做
      generatedAt: manifest.sceneVideoGeneratedAt?.[String(scene.index)] ?? null,
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

async function generateProductionScript(
  context: StudioRouteContext,
  kind: StoryKind,
  id: string,
  body: { readonly craftId?: string },
) {
  const source = await readStorySource(context, kind, id);
  if (!source.text.trim()) throw new Error("故事正文为空，无法生成剧本");
  const dir = productionPath(context.root, kind, id);
  const craftId = body.craftId ?? await resolveStoryCraftId(context.root, kind, id);
  const confirmedSourceSegments = await readConfirmedSourceSegments(context.root, craftId);
  await mkdir(dir, { recursive: true });
  let content: string | undefined;
  let warning: string | undefined;
  const assets = await readStoryAssets(context.root, kind, id);
  const assetsContext = buildAssetsContext(assets);
  const assetNames = assets.map((asset) => asset.name);
  const requirements = assetsContext
    ? `${unifiedScriptRequirements()}\n\n${assetsContext}`
    : unifiedScriptRequirements();
  const pipeline = new PipelineRunner(await context.buildPipelineConfig());
  const artStyle = await resolveStoryArtStyle(context.root, kind, id, pipeline);
  const styleDescription = resolveImageStyleDescription("shot", artStyle);
  const styledRequirements = `${requirements}\n\n## 统一画面风格（必须遵守）\n所有「图像提示词：」都必须明确使用以下画面风格，不得只停留在抽象的风格标签：\n${styleDescription}`;
  const agent = new ScriptCreationAgent(pipeline.createAgentContext("script"));

  const maxAttempts = 2;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const raw = await agent.writeScript({
        title: source.title,
        sourceKind: kind === "short" ? "StoryOS short story" : "StoryOS book",
        targetFormat: "general_script",
        sourceText: source.text.slice(0, MAX_SOURCE_CHARS),
        requirements: attempt > 1
          ? `${styledRequirements}\n\n上一轮生成的剧本存在问题，请修正后重新输出完整剧本。`
          : styledRequirements,
        language: "zh",
      });
      const parsed = parseUnifiedScript(raw, { confirmedSourceSegments });
      if (!parsed.shots.length) throw new Error("模型没有输出可解析的镜头");
      const issues = validateScriptQuality(parsed.shots, assetNames);
      const issueWarning = formatScriptIssues(issues);
      if (shouldRetryScriptQuality(issues) && attempt < maxAttempts) {
        warning = `第 ${attempt} 次生成质量不达标（${issues.length} 处问题），正在重试…`;
        lastError = new Error(warning);
        continue;
      }
      content = raw;
      // A successful corrective pass clears the transient retry notice. Keep
      // only defects from the final script so the UI does not show a stale
      // warning after the second attempt has repaired the output.
      warning = issueWarning ?? undefined;
      break;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        warning = `第 ${attempt} 次生成失败，正在重试…`;
      }
    }
  }

  if (!content) {
    content = fallbackUnifiedScript(source);
    warning = lastError instanceof Error
      ? `模型剧本生成失败，已生成基础脚本：${lastError.message}`
      : "模型剧本生成失败，已生成基础脚本";
  }
  const generatedAt = new Date().toISOString();
  await invalidateVideoArtifacts(dir);
  await writeFile(join(dir, "script.md"), content.trimEnd() + "\n", "utf-8");
  await writeFile(join(dir, "manifest.json"), JSON.stringify({ scriptGeneratedAt: generatedAt, ...(craftId ? { craftId } : {}), ...(warning ? { warning } : {}) }, null, 2), "utf-8");
  return { ...(await readProduction(context, kind, id)), warning: warning ?? null };
}

async function generateProductionVideo(
  context: StudioRouteContext,
  kind: StoryKind,
  id: string,
  body: { readonly voice?: boolean },
) {
  const dir = productionPath(context.root, kind, id);
  const script = await readFile(join(dir, "script.md"), "utf-8").catch(() => "");
  if (!script.trim()) throw new Error("请先在剧本阶段生成剧本");
  const raw = await context.loadRawConfig();
  const secrets = await context.loadSecrets();
  const imageConfig = await resolveImageConfig(context.root);
  const previous = await readManifest(dir);
  const confirmedSourceSegments = await readConfirmedSourceSegments(context.root, previous.craftId);
  const sourceVideoPath = previous.craftId
    ? await resolveCraftSourceFile(context.root, previous.craftId, "sourceVideo").catch(() => undefined)
    : undefined;
  const pipeline = new PipelineRunner(await context.buildPipelineConfig());
  const artStyle = await resolveStoryArtStyle(context.root, kind, id, pipeline);
  const result = await composeVideo({
    productionDir: dir,
    script: parseUnifiedScript(script, { confirmedSourceSegments }),
    voiceConfig: parseLlmVoiceConfig(raw, secrets as unknown as Record<string, unknown>),
    withVoice: body.voice !== false,
    imageConfig,
    sourceVideoPath,
    artStyle,
  });
  await writeFile(join(dir, "manifest.json"), JSON.stringify({
    ...previous,
    videoGeneratedAt: new Date().toISOString(),
    videoDurationMs: result.durationMs,
    voiceEnabled: result.voiceEnabled,
    ...(result.warning ? { warning: result.warning } : {}),
  }, null, 2), "utf-8");
  return { ...(await readProduction(context, kind, id)), warning: result.warning ?? null };
}

async function generateProductionSceneVideo(
  context: StudioRouteContext,
  kind: StoryKind,
  id: string,
  index: number,
  body: { readonly voice?: boolean },
) {
  const dir = productionPath(context.root, kind, id);
  const scriptText = await readFile(join(dir, "script.md"), "utf-8").catch(() => "");
  if (!scriptText.trim()) throw new Error("请先在剧本阶段生成剧本");
  const previous = await readManifest(dir);
  const confirmedSourceSegments = await readConfirmedSourceSegments(context.root, previous.craftId);
  const sourceVideoPath = previous.craftId
    ? await resolveCraftSourceFile(context.root, previous.craftId, "sourceVideo").catch(() => undefined)
    : undefined;
  const scenes = groupShotsByScene(parseUnifiedScript(scriptText, { confirmedSourceSegments }).shots);
  const scene = scenes.find((item) => item.index === index);
  if (!scene) throw new Error("场景不存在");
  const raw = await context.loadRawConfig();
  const secrets = await context.loadSecrets();
  const imageConfig = await resolveImageConfig(context.root);
  const pipeline = new PipelineRunner(await context.buildPipelineConfig());
  const artStyle = await resolveStoryArtStyle(context.root, kind, id, pipeline);
  const scenesDir = join(dir, "scenes");
  const tempDir = join(dir, ".tmp-video", `scene-${index}`);
  await mkdir(scenesDir, { recursive: true });
  await mkdir(tempDir, { recursive: true });
  const sceneImageCache = imageConfig ? join(dir, "images", `scene-${index}`) : undefined;
  if (sceneImageCache) await mkdir(sceneImageCache, { recursive: true });
  const sceneOutput = join(scenesDir, `scene-${String(index).padStart(3, "0")}.mp4`);
  const result = await composeSegmentVideo({
    tempDir,
    outputPath: sceneOutput,
    shots: scene.shots,
    voiceConfig: parseLlmVoiceConfig(raw, secrets as unknown as Record<string, unknown>),
    withVoice: body.voice !== false,
    imageConfig,
    artStyle,
    imageCacheDir: sceneImageCache,
    sourceVideoPath,
  });
  await rm(join(dir, "story.mp4"), { force: true });
  const generatedAt = new Date().toISOString();
  await writeFile(join(dir, "manifest.json"), JSON.stringify(
    markSceneVideoGenerated(previous, index, generatedAt),
    null,
    2,
  ), "utf-8");
  return { ...(await readProduction(context, kind, id)), warning: result.warning ?? null };
}

async function invalidateVideoArtifacts(dir: string): Promise<void> {
  await Promise.all([
    rm(join(dir, "story.mp4"), { force: true }),
    rm(join(dir, "scenes"), { recursive: true, force: true }),
    rm(join(dir, "images"), { recursive: true, force: true }),
    rm(join(dir, ".tmp-video"), { recursive: true, force: true }),
  ]);
}

export class StoryProductionLock {
  private readonly tails = new Map<string, Promise<void>>();

  async run<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => { release = resolve; });
    this.tails.set(key, current);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.tails.get(key) === current) this.tails.delete(key);
    }
  }
}

function productionLockKey(kind: StoryKind, id: string): string {
  return `${kind}:${id}`;
}

function registerProductionRoutesForKind(
  context: StudioRouteContext,
  kind: StoryKind,
  tasks: ProductionTaskRegistry,
  productionLock: StoryProductionLock,
): void {
  const prefix = kind === "short" ? "/api/v1/shorts" : "/api/v1/books";

  context.app.get(`${prefix}/:id/production`, async (c) => {
    const id = c.req.param("id");
    if (!isSafeStoryId(id)) return c.json({ error: "Invalid story id" }, 400);
    return c.json(await readProduction(context, kind, id));
  });

  context.app.get(`${prefix}/:id/production/tasks`, (c) => {
    const id = c.req.param("id");
    if (!isSafeStoryId(id)) return c.json({ error: "Invalid story id" }, 400);
    const taskKind = c.req.query("kind");
    if (taskKind !== "script" && taskKind !== "video" && taskKind !== "scene-video") {
      return c.json({ error: "Invalid production task kind" }, 400);
    }
    const target: { readonly kind: ProductionTaskKind; readonly storyId: string; readonly storyKind: StoryKind; readonly sceneIndex?: number } = {
      kind: taskKind,
      storyId: id,
      storyKind: kind,
    };
    if (taskKind === "scene-video") {
      const sceneIndex = Number(c.req.query("sceneIndex"));
      if (!Number.isInteger(sceneIndex) || sceneIndex < 0) return c.json({ error: "Invalid scene index" }, 400);
      return c.json({ task: tasks.latest({ ...target, sceneIndex }) ?? null });
    }
    return c.json({ task: tasks.latest(target) ?? null });
  });

  context.app.post(`${prefix}/:id/production/script`, async (c) => {
    const id = c.req.param("id");
    if (!isSafeStoryId(id)) return c.json({ error: "Invalid story id" }, 400);
    if (c.req.query("background") === "true") {
      const body = await c.req.json<{ craftId?: string }>().catch(() => ({}));
      const task = tasks.start(
        { kind: "script", storyId: id, storyKind: kind },
        async () => {
          await productionLock.run(productionLockKey(kind, id), () => generateProductionScript(context, kind, id, body));
        },
        { payload: body },
      );
      return c.json({ task }, 202);
    }
    const source = await readStorySource(context, kind, id);
    if (!source.text.trim()) return c.json({ error: "故事正文为空，无法生成剧本" }, 400);
    const body = await c.req.json<{ craftId?: string }>().catch(() => ({} as { craftId?: string }));
    const result = await productionLock.run(
      productionLockKey(kind, id),
      () => generateProductionScript(context, kind, id, body),
    );
    return c.json(result);
  });

  context.app.post(`${prefix}/:id/production/video`, async (c) => {
    const id = c.req.param("id");
    if (!isSafeStoryId(id)) return c.json({ error: "Invalid story id" }, 400);
    if (c.req.query("background") === "true") {
      const body = await c.req.json<{ voice?: boolean }>().catch(() => ({}));
      const task = tasks.start(
        { kind: "video", storyId: id, storyKind: kind },
        async () => {
          await productionLock.run(productionLockKey(kind, id), () => generateProductionVideo(context, kind, id, body));
        },
        { payload: body },
      );
      return c.json({ task }, 202);
    }
    const dir = productionPath(context.root, kind, id);
    const script = await readFile(join(dir, "script.md"), "utf-8").catch(() => "");
    if (!script.trim()) return c.json({ error: "请先在剧本阶段生成剧本" }, 400);
    const body: { voice?: boolean } = await c.req.json<{ voice?: boolean }>().catch(() => ({ voice: undefined }));
    const result = await productionLock.run(
      productionLockKey(kind, id),
      () => generateProductionVideo(context, kind, id, body),
    );
    return c.json(result);
  });

  context.app.post(`${prefix}/:id/production/video/scene/:index`, async (c) => {
    const id = c.req.param("id");
    if (!isSafeStoryId(id)) return c.json({ error: "Invalid story id" }, 400);
    const index = Number(c.req.param("index"));
    if (!Number.isInteger(index) || index < 0) return c.json({ error: "Invalid scene index" }, 400);
    if (c.req.query("background") === "true") {
      const body = await c.req.json<{ voice?: boolean }>().catch(() => ({}));
      const task = tasks.start(
        { kind: "scene-video", sceneIndex: index, storyId: id, storyKind: kind },
        async () => {
          await productionLock.run(productionLockKey(kind, id), () => generateProductionSceneVideo(context, kind, id, index, body));
        },
        { payload: body },
      );
      return c.json({ task }, 202);
    }
    const dir = productionPath(context.root, kind, id);
    const scriptText = await readFile(join(dir, "script.md"), "utf-8").catch(() => "");
    if (!scriptText.trim()) return c.json({ error: "请先在剧本阶段生成剧本" }, 400);
    const production = await readProduction(context, kind, id);
    if (!production.scenes.some((scene) => scene.index === index)) return c.json({ error: "场景不存在" }, 404);
    const body: { voice?: boolean } = await c.req.json<{ voice?: boolean }>().catch(() => ({ voice: undefined }));
    const result = await productionLock.run(
      productionLockKey(kind, id),
      () => generateProductionSceneVideo(context, kind, id, index, body),
    );
    return c.json(result);
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
  const tasks = new ProductionTaskRegistry((task) => context.broadcast("production:task", task), {
    persistencePath: context.backgroundTaskPersistenceDir
      ? join(context.backgroundTaskPersistenceDir, "story-production-tasks.json")
      : undefined,
  });
  const productionLock = new StoryProductionLock();
  registerProductionRoutesForKind(context, "short", tasks, productionLock);
  registerProductionRoutesForKind(context, "book", tasks, productionLock);
  tasks.resumePending(async (task) => {
    if (!isSafeStoryId(task.storyId)) throw new Error("Invalid persisted story id.");
    const kind = task.storyKind;
    if (task.kind === "script") {
      const craftId = typeof task.payload?.craftId === "string" ? task.payload.craftId : undefined;
      await productionLock.run(productionLockKey(kind, task.storyId), () => generateProductionScript(context, kind, task.storyId, { craftId }));
      return;
    }
    const voice = typeof task.payload?.voice === "boolean" ? task.payload.voice : undefined;
    if (task.kind === "video") {
      await productionLock.run(productionLockKey(kind, task.storyId), () => generateProductionVideo(context, kind, task.storyId, { voice }));
      return;
    }
    if (task.kind === "scene-video") {
      const sceneIndex = task.sceneIndex;
      if (sceneIndex === undefined || !Number.isInteger(sceneIndex) || sceneIndex < 0) {
        throw new Error("Invalid persisted scene index.");
      }
      await productionLock.run(productionLockKey(kind, task.storyId), () => generateProductionSceneVideo(context, kind, task.storyId, sceneIndex, { voice }));
    }
  });
}
