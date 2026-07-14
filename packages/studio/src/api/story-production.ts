export interface UnifiedScriptShot {
  readonly number: number;
  readonly scene: string;
  readonly visual: string;
  readonly camera?: string;
  readonly action?: string;
  readonly subtitle: string;
  readonly durationMs: number;
  readonly imagePrompt?: string;
}

export interface UnifiedScriptDocument {
  readonly title: string;
  readonly shots: readonly UnifiedScriptShot[];
}

export interface SubtitleEntry {
  readonly index: number;
  readonly startTimeMs: number;
  readonly endTimeMs: number;
  readonly text: string;
}

const FIELD_LABELS: Readonly<Record<string, keyof ParsedShot>> = {
  "画面": "visual",
  "视觉": "visual",
  "镜头": "camera",
  "景别": "camera",
  "机位": "camera",
  "景别/机位": "camera",
  "动作": "action",
  "台词": "subtitle",
  "对白": "subtitle",
  "旁白": "subtitle",
  "字幕": "subtitle",
  "时长": "duration",
  "图像提示词": "imagePrompt",
  "图片提示词": "imagePrompt",
};

interface ParsedShot {
  scene: string;
  visual: string;
  camera: string;
  action: string;
  subtitle: string;
  duration: number;
  imagePrompt: string;
}

function emptyShot(scene: string): ParsedShot {
  return {
    scene,
    visual: "",
    camera: "",
    action: "",
    subtitle: "",
    duration: 0,
    imagePrompt: "",
  };
}

function cleanFieldValue(value: string): string {
  return value.trim().replace(/^\*\*(.+)\*\*$/u, "$1").trim();
}

function parseDurationMs(value: string): number {
  const match = /(\d+(?:\.\d+)?)\s*(?:秒|s|sec|seconds?)/iu.exec(value);
  const seconds = Number(match?.[1] ?? value.replace(/[^\d.]/gu, ""));
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : 0;
}

function shotFromParsed(shot: ParsedShot, number: number): UnifiedScriptShot | null {
  // 旁白/字幕/台词已统一为 subtitle。每个镜头必须有旁白——没有旁白的镜头不保留。
  const subtitle = cleanFieldValue(shot.subtitle);
  const visual = cleanFieldValue(shot.visual || shot.action);
  if (!subtitle && !visual && !shot.imagePrompt) return null;
  return {
    number,
    scene: shot.scene || "未命名场景",
    visual: visual || subtitle.slice(0, 40) || "画面待补充",
    ...(shot.camera ? { camera: cleanFieldValue(shot.camera) } : {}),
    ...(shot.action ? { action: cleanFieldValue(shot.action) } : {}),
    subtitle,
    durationMs: shot.duration,
    ...(shot.imagePrompt ? { imagePrompt: cleanFieldValue(shot.imagePrompt) } : {}),
  };
}

function fallbackShots(raw: string, title: string): UnifiedScriptShot[] {
  const paragraphs = raw
    .replace(/^#.*$/gmu, "")
    .split(/\n\s*\n/gu)
    .map((part) => part.replace(/^\s*第?\d+章[^\n]*\n?/u, "").trim())
    .filter(Boolean)
    .slice(0, 24);
  const source = paragraphs.length > 0 ? paragraphs : [raw.replace(/^#.*$/gmu, "").trim() || title];
  return source.map((paragraph, index) => ({
    number: index + 1,
    scene: `场景 ${index + 1}`,
    visual: paragraph.slice(0, 120),
    subtitle: paragraph.slice(0, 240),
    durationMs: 0,
  }));
}

export function parseUnifiedScript(raw: string): UnifiedScriptDocument {
  const lines = raw.split(/\r?\n/u);
  const title = cleanFieldValue(lines.find((line) => /^#\s+[^#]/u.test(line.trim()))?.replace(/^#\s+/u, "") || "未命名故事");
  const shots: UnifiedScriptShot[] = [];
  let scene = "未命名场景";
  let current: ParsedShot | null = null;

  const flush = (): void => {
    if (!current) return;
    const shot = shotFromParsed(current, shots.length + 1);
    if (shot) shots.push(shot);
    current = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const sceneMatch = /^##\s+(.+)$/u.exec(trimmed);
    if (sceneMatch) {
      flush();
      scene = cleanFieldValue(sceneMatch[1]!);
      continue;
    }
    const shotMatch = /^###\s+(?:(?:镜头|shot)\s*)?(\d+)?\s*[:：-]?\s*(.*)$/iu.exec(trimmed);
    if (shotMatch) {
      flush();
      current = emptyShot(scene);
      continue;
    }
    const fieldMatch = /^[-*]\s*([^：:]+)\s*[：:]\s*(.*)$/u.exec(trimmed);
    if (fieldMatch && current) {
      const field = FIELD_LABELS[fieldMatch[1]!.trim()];
      if (field === "duration") current.duration = parseDurationMs(fieldMatch[2]!);
      else if (field) current[field] = cleanFieldValue(fieldMatch[2]!);
      continue;
    }
    if (current && current.subtitle && !/^#{1,6}\s/u.test(trimmed)) {
      current.subtitle = `${current.subtitle} ${trimmed}`.trim();
    }
  }
  flush();

  return {
    title,
    shots: shots.length > 0 ? shots : fallbackShots(raw, title),
  };
}

function estimateSubtitleDurationMs(text: string): number {
  return Math.max(1000, Math.round(text.replace(/\s/gu, "").length * 180));
}

export function buildSubtitleEntries(shots: readonly UnifiedScriptShot[], gapMs = 200): SubtitleEntry[] {
  let cursor = 0;
  return shots
    .filter((shot) => shot.subtitle.trim())
    .map((shot, index) => {
      const durationMs = shot.durationMs > 0 ? shot.durationMs : estimateSubtitleDurationMs(shot.subtitle);
      const entry: SubtitleEntry = {
        index: index + 1,
        startTimeMs: cursor,
        endTimeMs: cursor + durationMs,
        text: shot.subtitle.trim(),
      };
      cursor = entry.endTimeMs + gapMs;
      return entry;
    });
}

export function formatSrtTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(Math.max(0, ms % 1000)).padStart(3, "0")}`;
}

export function buildSrtContent(entries: readonly SubtitleEntry[]): string {
  return entries
    .map((entry) => `${entry.index}\n${formatSrtTime(entry.startTimeMs)} --> ${formatSrtTime(entry.endTimeMs)}\n${entry.text}\n`)
    .join("\n");
}
