import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, open, readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { join } from "node:path";
import { tmpdir } from "node:os";

const execFileAsync = promisify(execFile);
const BILI_API = "https://api.bilibili.com";
const BCUT_API = "https://member.bilibili.com/x/bcut/rubick-interface";
const MAX_AUDIO_BYTES = 120 * 1024 * 1024;
const MAX_VIDEO_BYTES = 800 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 20_000;
const TRANSCRIBE_TIMEOUT_MS = 8 * 60_000;

const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
  27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
  37, 36, 25, 24, 30, 48, 51, 40, 52, 4, 34, 7, 0, 55, 20, 17,
  57, 21, 22, 6, 26, 54, 44, 1, 56, 11, 16, 61, 60, 59, 63, 62,
];

let cachedMixinKey: { value: string; expiresAt: number } | null = null;

export interface BilibiliSubtitleEntry {
  readonly from: number;
  readonly to: number;
  readonly content: string;
}

export interface BilibiliVideoInfo {
  readonly bvid: string;
  readonly aid: number;
  readonly cid: number;
  readonly title: string;
  readonly duration: number;
  readonly upName?: string;
}

export interface BilibiliImportResult {
  readonly videoInfo: BilibiliVideoInfo;
  readonly subtitleSource: "bili" | "bcut";
  readonly subtitles: ReadonlyArray<BilibiliSubtitleEntry>;
  readonly text: string;
  readonly sourceVideoPath?: string;
  readonly sourceTempDir?: string;
}

export function selectDashMediaUrls(input: {
  readonly video?: ReadonlyArray<{ readonly baseUrl?: string; readonly backupUrl?: ReadonlyArray<string> }>;
  readonly audio?: ReadonlyArray<{ readonly baseUrl?: string; readonly backupUrl?: ReadonlyArray<string> }>;
}): { readonly videoUrl: string; readonly audioUrl: string } {
  const video = input.video?.[0];
  const audio = input.audio?.[0];
  const videoUrl = video?.baseUrl ?? video?.backupUrl?.[0];
  const audioUrl = audio?.baseUrl ?? audio?.backupUrl?.[0];
  if (!videoUrl || !audioUrl) throw new Error("B 站未返回完整视频流和音频流");
  return { videoUrl, audioUrl };
}

export function parseBvid(input: string): string | null {
  const trimmed = input.trim();
  const direct = trimmed.match(/^BV[a-zA-Z0-9]{10}$/);
  if (direct) return direct[0];

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    if (host !== "bilibili.com" && !host.endsWith(".bilibili.com") && host !== "b23.tv") return null;
    return parsed.pathname.match(/\/video\/(BV[a-zA-Z0-9]{10})(?:\/|$)/i)?.[1] ?? null;
  } catch {
    return null;
  }
}

function requestHeaders(): Record<string, string> {
  return {
    Accept: "application/json, text/plain, */*",
    Referer: "https://www.bilibili.com/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  };
}

function extractKey(url: string): string {
  return (url.split("/").pop() ?? "").replace(/\.\w+$/, "");
}

function getMixinKey(imgKey: string, subKey: string): string {
  const raw = imgKey + subKey;
  return MIXIN_KEY_ENC_TAB.map((index) => raw[index] ?? "").join("").slice(0, 32);
}

async function getWbiMixinKey(): Promise<string> {
  if (cachedMixinKey && cachedMixinKey.expiresAt > Date.now()) return cachedMixinKey.value;
  const response = await fetch(`${BILI_API}/x/web-interface/nav`, {
    headers: requestHeaders(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const json = await response.json() as { data?: { wbi_img?: { img_url?: string; sub_url?: string } } };
  const wbi = json.data?.wbi_img;
  if (!response.ok || !wbi?.img_url || !wbi.sub_url) throw new Error("B 站 WBI 签名信息不可用");
  const value = getMixinKey(extractKey(wbi.img_url), extractKey(wbi.sub_url));
  cachedMixinKey = { value, expiresAt: Date.now() + 50 * 60_000 };
  return value;
}

async function signedQuery(params: Record<string, string | number>): Promise<string> {
  const wts = Math.floor(Date.now() / 1000);
  const values: Record<string, string | number> = { ...params, wts };
  const query = Object.keys(values)
    .sort()
    .filter((key) => values[key] !== "")
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(values[key]))}`)
    .join("&");
  const wRid = createHash("md5").update(query + await getWbiMixinKey()).digest("hex");
  return `${query}&w_rid=${wRid}`;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: requestHeaders(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`B 站请求失败：${response.status}`);
  return await response.json() as T;
}

export async function getBilibiliVideoInfo(bvid: string): Promise<BilibiliVideoInfo> {
  const query = await signedQuery({ bvid });
  const json = await getJson<{
    code: number;
    message?: string;
    data?: {
      aid: number;
      title: string;
      duration: number;
      owner?: { name?: string };
      pages?: Array<{ cid: number }>;
    };
  }>(`${BILI_API}/x/web-interface/view?${query}`);
  if (json.code !== 0 || !json.data?.pages?.[0]) {
    throw new Error(`获取 B 站视频信息失败：${json.message ?? `code=${json.code}`}`);
  }
  return {
    bvid,
    aid: json.data.aid,
    cid: json.data.pages[0].cid,
    title: json.data.title,
    duration: json.data.duration,
    upName: json.data.owner?.name,
  };
}

export async function getPublicBilibiliSubtitles(
  video: BilibiliVideoInfo,
): Promise<BilibiliSubtitleEntry[]> {
  const query = await signedQuery({ aid: video.aid, cid: video.cid });
  const json = await getJson<{
    code: number;
    data?: { subtitle?: { subtitles?: Array<{ lan: string; lan_doc: string; subtitle_url: string; ai_type?: number }> } };
  }>(`${BILI_API}/x/player/wbi/v2?${query}`);
  const subtitles = json.data?.subtitle?.subtitles ?? [];
  const selected = subtitles.find((item) => item.lan === "zh-CN" && !item.ai_type)
    ?? subtitles.find((item) => item.lan.startsWith("zh"))
    ?? subtitles.find((item) => !item.ai_type)
    ?? subtitles[0];
  if (!selected) return [];
  const subtitleUrl = selected.subtitle_url.startsWith("//") ? `https:${selected.subtitle_url}` : selected.subtitle_url;
  const subtitleJson = await getJson<{ body?: Array<{ from: number; to: number; content: string }> }>(subtitleUrl);
  return (subtitleJson.body ?? [])
    .map((entry) => ({ from: entry.from, to: entry.to, content: entry.content.trim() }))
    .filter((entry) => entry.content.length > 0);
}

async function getAudioStreamUrl(video: BilibiliVideoInfo): Promise<string> {
  const query = await signedQuery({ bvid: video.bvid, cid: video.cid, fnval: 16, fnver: 0, qn: 64, fourk: 0 });
  const json = await getJson<{
    code: number;
    message?: string;
    data?: { dash?: { audio?: Array<{ baseUrl?: string; backupUrl?: string[] }> } };
  }>(`${BILI_API}/x/player/wbi/playurl?${query}`);
  const audio = json.data?.dash?.audio?.[0];
  const url = audio?.baseUrl ?? audio?.backupUrl?.[0];
  if (json.code !== 0 || !url) throw new Error(`获取 B 站音频流失败：${json.message ?? `code=${json.code}`}`);
  return url;
}

async function downloadAudioToTemp(video: BilibiliVideoInfo): Promise<{ tempDir: string; audioPath: string }> {
  const tempDir = await mkdtemp(join(tmpdir(), "inkos-bilibili-"));
  try {
    const streamUrl = await getAudioStreamUrl(video);
    const response = await fetch(streamUrl, {
      headers: requestHeaders(),
      signal: AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`下载 B 站音频失败：${response.status}`);
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > MAX_AUDIO_BYTES) throw new Error("音频文件超过 120MB 限制");
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > MAX_AUDIO_BYTES) throw new Error("音频文件超过 120MB 限制");
    const sourcePath = join(tempDir, "source.m4s");
    const audioPath = join(tempDir, "audio.mp3");
    await writeFile(sourcePath, buffer);
    const ffmpegPath = process.env.FFMPEG_PATH ?? "C:\\ffmpeg\\bin\\ffmpeg.exe";
    await execFileAsync(ffmpegPath, ["-y", "-i", sourcePath, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k", audioPath], {
      timeout: TRANSCRIBE_TIMEOUT_MS,
    });
    return { tempDir, audioPath };
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true });
    throw error;
  }
}

async function getDashMediaUrls(video: BilibiliVideoInfo): Promise<{ readonly videoUrl: string; readonly audioUrl: string }> {
  const query = await signedQuery({ bvid: video.bvid, cid: video.cid, fnval: 4048, fnver: 0, qn: 80, fourk: 0 });
  const json = await getJson<{
    code: number;
    message?: string;
    data?: {
      dash?: {
        video?: Array<{ baseUrl?: string; backupUrl?: string[] }>;
        audio?: Array<{ baseUrl?: string; backupUrl?: string[] }>;
      };
    };
  }>(`${BILI_API}/x/player/wbi/playurl?${query}`);
  if (json.code !== 0 || !json.data?.dash) {
    throw new Error(`Bilibili video stream request failed: ${json.message ?? `code=${json.code}`}`);
  }
  return selectDashMediaUrls(json.data.dash);
}

async function downloadResponseToFile(url: string, targetPath: string, maxBytes: number): Promise<void> {
  const response = await fetch(url, {
    headers: requestHeaders(),
    signal: AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS),
  });
  if (!response.ok || !response.body) throw new Error(`下载 B 站媒体失败：${response.status}`);
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > maxBytes) throw new Error("B 站媒体文件超过大小限制");
  const handle = await open(targetPath, "w");
  let total = 0;
  try {
    for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
      total += chunk.byteLength;
      if (total > maxBytes) throw new Error("B 站媒体文件超过大小限制");
      await handle.write(chunk);
    }
  } finally {
    await handle.close();
  }
}

async function downloadVideoToTemp(video: BilibiliVideoInfo): Promise<{
  readonly tempDir: string;
  readonly audioPath: string;
  readonly videoPath: string;
}> {
  const tempDir = await mkdtemp(join(tmpdir(), "inkos-bilibili-video-"));
  try {
    const media = await getDashMediaUrls(video);
    const videoSourcePath = join(tempDir, "video.m4s");
    const audioSourcePath = join(tempDir, "audio.m4s");
    const videoPath = join(tempDir, "video.mp4");
    const audioPath = join(tempDir, "audio.mp3");
    await downloadResponseToFile(media.videoUrl, videoSourcePath, MAX_VIDEO_BYTES);
    await downloadResponseToFile(media.audioUrl, audioSourcePath, MAX_AUDIO_BYTES);
    const ffmpegPath = process.env.FFMPEG_PATH ?? "C:\\ffmpeg\\bin\\ffmpeg.exe";
    await execFileAsync(ffmpegPath, ["-y", "-i", videoSourcePath, "-i", audioSourcePath, "-c:v", "copy", "-c:a", "aac", "-movflags", "+faststart", videoPath], {
      timeout: TRANSCRIBE_TIMEOUT_MS,
    });
    await execFileAsync(ffmpegPath, ["-y", "-i", audioSourcePath, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k", audioPath], {
      timeout: TRANSCRIBE_TIMEOUT_MS,
    });
    return { tempDir, audioPath, videoPath };
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true });
    throw error;
  }
}

interface BcutSubtitleResult {
  utterances?: Array<{ transcript?: string; start_time?: number; end_time?: number }>;
}

async function transcribeWithBcut(audio: Buffer): Promise<BilibiliSubtitleEntry[]> {
  const headers = { "Content-Type": "application/json", "User-Agent": "Bilibili/1.0.0 (https://www.bilibili.com)" };
  const create = await fetch(`${BCUT_API}/resource/create`, {
    method: "POST",
    headers,
    body: JSON.stringify({ type: 2, name: "audio.mp3", size: audio.byteLength, ResourceFileType: "mp3", model_id: "8" }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!create.ok) throw new Error(`Bcut 申请上传失败：${create.status}`);
  const createJson = await create.json() as { data?: { in_boss_key: string; resource_id: string; upload_id: string; upload_urls: string[]; per_size: number } };
  const upload = createJson.data;
  if (!upload?.upload_urls?.length) throw new Error("Bcut 未返回上传地址");
  const etags: string[] = [];
  for (let index = 0; index < upload.upload_urls.length; index += 1) {
    const part = audio.subarray(index * upload.per_size, Math.min((index + 1) * upload.per_size, audio.length));
    const response = await fetch(upload.upload_urls[index], { method: "PUT", body: new Uint8Array(part), signal: AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`Bcut 上传分片失败：${response.status}`);
    etags.push(response.headers.get("etag") ?? response.headers.get("Etag") ?? "");
  }
  const complete = await fetch(`${BCUT_API}/resource/create/complete`, {
    method: "POST",
    headers,
    body: JSON.stringify({ InBossKey: upload.in_boss_key, ResourceId: upload.resource_id, Etags: etags.join(","), UploadId: upload.upload_id, model_id: "8" }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!complete.ok) throw new Error(`Bcut 提交上传失败：${complete.status}`);
  const completeJson = await complete.json() as { data?: { download_url?: string } };
  const resource = completeJson.data?.download_url;
  if (!resource) throw new Error("Bcut 未返回音频资源");
  const task = await fetch(`${BCUT_API}/task`, {
    method: "POST",
    headers,
    body: JSON.stringify({ resource, model_id: "8" }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!task.ok) throw new Error(`Bcut 创建识别任务失败：${task.status}`);
  const taskJson = await task.json() as { data?: { task_id?: string } };
  const taskId = taskJson.data?.task_id;
  if (!taskId) throw new Error("Bcut 未返回识别任务");
  const deadline = Date.now() + TRANSCRIBE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const result = await fetch(`${BCUT_API}/task/result?model_id=7&task_id=${encodeURIComponent(taskId)}`, {
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!result.ok) throw new Error(`Bcut 查询结果失败：${result.status}`);
    const resultJson = await result.json() as { data?: { state?: number; result?: string } };
    if (resultJson.data?.state === 4) {
      if (!resultJson.data.result) throw new Error("Bcut 返回空识别结果");
      const parsed = JSON.parse(resultJson.data.result) as BcutSubtitleResult;
      return (parsed.utterances ?? [])
        .map((item) => ({ from: (item.start_time ?? 0) / 1000, to: (item.end_time ?? 0) / 1000, content: (item.transcript ?? "").trim() }))
        .filter((item) => item.content.length > 0);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Bcut 识别超时");
}

export function subtitleText(entries: ReadonlyArray<BilibiliSubtitleEntry>): string {
  return entries.map((entry) => `[${entry.from.toFixed(1)}s-${entry.to.toFixed(1)}s] ${entry.content}`).join("\n");
}

export async function importBilibiliSubtitles(input: string): Promise<BilibiliImportResult> {
  const bvid = parseBvid(input);
  if (!bvid) throw new Error("请输入有效的 B 站 BV 号或视频链接");
  const videoInfo = await getBilibiliVideoInfo(bvid);
  const publicSubtitles = await getPublicBilibiliSubtitles(videoInfo);
  if (publicSubtitles.length > 0) {
    return { videoInfo, subtitleSource: "bili", subtitles: publicSubtitles, text: subtitleText(publicSubtitles) };
  }

  const { tempDir, audioPath } = await downloadAudioToTemp(videoInfo);
  try {
    const entries = await transcribeWithBcut(await readFile(audioPath));
    if (entries.length === 0) throw new Error("Bcut 未识别出有效字幕");
    return { videoInfo, subtitleSource: "bcut", subtitles: entries, text: subtitleText(entries) };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function importBilibiliSource(input: string): Promise<BilibiliImportResult> {
  const bvid = parseBvid(input);
  if (!bvid) throw new Error("璇疯緭鍏ユ湁鏁堢殑 B 绔?BV 鍙锋垨瑙嗛閾炬帴");
  const videoInfo = await getBilibiliVideoInfo(bvid);
  const publicSubtitles = await getPublicBilibiliSubtitles(videoInfo);
  const { tempDir, audioPath, videoPath } = await downloadVideoToTemp(videoInfo);
  try {
    const subtitles = publicSubtitles.length > 0
      ? publicSubtitles
      : await transcribeWithBcut(await readFile(audioPath));
    if (subtitles.length === 0) throw new Error("Bcut 鏈瘑鍒嚭鏈夋晥瀛楀箷");
    return {
      videoInfo,
      subtitleSource: publicSubtitles.length > 0 ? "bili" : "bcut",
      subtitles,
      text: subtitleText(subtitles),
      sourceVideoPath: videoPath,
      sourceTempDir: tempDir,
    };
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true });
    throw error;
  }
}
