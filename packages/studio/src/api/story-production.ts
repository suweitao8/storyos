import type { SourceSegmentRef } from "@actalk/inkos-core";

export interface UnifiedScriptShot {
  readonly number: number;
  readonly scene: string;
  readonly visual: string;
  readonly camera?: string;
  readonly action?: string;
  readonly subtitle: string;
  readonly durationMs: number;
  readonly imagePrompt?: string;
  readonly sourceSegmentRef?: SourceSegmentRef;
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
  "原片匹配": "sourceMatchId",
  "原片素材": "sourceMatchId",
  "sourceMatchId": "sourceMatchId",
};

interface ParsedShot {
  scene: string;
  visual: string;
  camera: string;
  action: string;
  subtitle: string;
  duration: number;
  imagePrompt: string;
  sourceMatchId: string;
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
    sourceMatchId: "",
  };
}

function cleanFieldValue(value: string): string {
  return value
    .trim()
    .replace(/^\*\*(.+)\*\*$/u, "$1")
    // 去掉模型误加的分隔符（---、***、``` 等）
    .replace(/\s*(?:^-{3,}$|^={3,}$|^\*{3,}$|^`{3}$)\s*$/gmu, "")
    .trim();
}

function parseDurationMs(value: string): number {
  const match = /(\d+(?:\.\d+)?)\s*(?:秒|s|sec|seconds?)/iu.exec(value);
  const seconds = Number(match?.[1] ?? value.replace(/[^\d.]/gu, ""));
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : 0;
}

/**
 * 清理旁白文本：在断句标点处拆行，删除所有不需要的标点。
 *
 * 删除的标点类型：
 * - 断句标点（逗号、句号、感叹号、问号、分号）→ 拆为换行
 * - 引号（对话引号 ""''""）→ 直接删除，不保留角色对话标记
 * - 冒号（：:）→ 直接删除
 * - 破折号（———--）→ 直接删除
 *
 * 清理后空行被合并，首尾空白被去除。
 */
function splitNarrationByPunctuation(text: string): string {
  return text
    // 先删除引号、冒号、破折号（不拆行）
    .replace(/["""''「」『』：:———\-]{1,}/gu, "")
    // 断句标点处拆为换行并删除标点
    .replace(/[，。！？；,!?;]\s*/gu, "\n")
    // 合并连续空行，去掉首尾空白
    .replace(/\n{2,}/gu, "\n")
    .replace(/^\n+|\n+$/gu, "")
    .trim();
}

function shotFromParsed(
  shot: ParsedShot,
  number: number,
  confirmedSourceSegments?: ReadonlyMap<string, SourceSegmentRef>,
): UnifiedScriptShot | null {
  // 旁白/字幕/台词已统一为 subtitle。每个镜头必须有旁白——没有旁白的镜头不保留。
  const subtitle = splitNarrationByPunctuation(cleanFieldValue(shot.subtitle));
  const visual = cleanFieldValue(shot.visual || shot.action);
  if (!subtitle && !visual && !shot.imagePrompt) return null;
  const sourceSegmentRef = shot.sourceMatchId.trim() ? confirmedSourceSegments?.get(shot.sourceMatchId.trim()) : undefined;
  return {
    number,
    scene: shot.scene || "未命名场景",
    visual: visual || subtitle.replace(/\n/gu, " ").slice(0, 40) || "画面待补充",
    ...(shot.camera ? { camera: cleanFieldValue(shot.camera) } : {}),
    ...(shot.action ? { action: cleanFieldValue(shot.action) } : {}),
    subtitle,
    durationMs: shot.duration,
    ...(shot.imagePrompt ? { imagePrompt: cleanFieldValue(shot.imagePrompt) } : {}),
    ...(sourceSegmentRef ? { sourceSegmentRef } : {}),
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

export function parseUnifiedScript(
  raw: string,
  options?: { readonly confirmedSourceSegments?: ReadonlyMap<string, SourceSegmentRef> },
): UnifiedScriptDocument {
  const lines = raw.split(/\r?\n/u);
  const title = cleanFieldValue(lines.find((line) => /^#\s+[^#]/u.test(line.trim()))?.replace(/^#\s+/u, "") || "未命名故事");
  const shots: UnifiedScriptShot[] = [];
  let scene = "未命名场景";
  let current: ParsedShot | null = null;
  // 镜头编号按场景内从 1 开始，每进入新场景归零。
  let sceneShotIndex = 0;

  const flush = (): void => {
    if (!current) return;
    sceneShotIndex += 1;
    const shot = shotFromParsed(current, sceneShotIndex, options?.confirmedSourceSegments);
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
      sceneShotIndex = 0;
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

/** 单个镜头的质量问题。 */
export type ScriptShotIssue = {
  readonly shot: number;
  readonly type: "missing_narration" | "long_narration" | "missing_camera" | "thin_image_prompt" | "untracked_asset_name";
  readonly message: string;
};

const IMAGE_PROMPT_MIN_LENGTH = 15;
const NARRATION_MAX_LENGTH = 80;

/** 检查剧本质量：每个镜头是否都有旁白、景别、足够的图像提示词。
 *  assetNames 传入故事资产的名称集合，用于检测画面里出现的角色/场景是否在资产库里。 */
export function validateScriptQuality(
  shots: readonly UnifiedScriptShot[],
  assetNames: readonly string[] = [],
): ScriptShotIssue[] {
  const issues: ScriptShotIssue[] = [];
  const knownNames = new Set(assetNames.map((name) => name.trim()).filter(Boolean));

  for (const shot of shots) {
    // 1. 每个镜头必须有旁白
    const narrationText = (shot.subtitle ?? "").replace(/\s/gu, "");
    if (!narrationText) {
      issues.push({ shot: shot.number, type: "missing_narration", message: `镜头 ${shot.number} 缺少旁白` });
    } else if (narrationText.length > NARRATION_MAX_LENGTH) {
      issues.push({ shot: shot.number, type: "long_narration", message: `镜头 ${shot.number} 旁白过长（${narrationText.length} 字，建议 ≤${NARRATION_MAX_LENGTH}）` });
    }

    // 2. 每个镜头必须有景别
    if (!shot.camera?.trim()) {
      issues.push({ shot: shot.number, type: "missing_camera", message: `镜头 ${shot.number} 缺少景别/机位` });
    }

    // 3. 图像提示词不能太短（少于阈值说明模型敷衍了）
    if (!shot.imagePrompt?.trim()) {
      issues.push({ shot: shot.number, type: "thin_image_prompt", message: `镜头 ${shot.number} 缺少图像提示词` });
    } else if (shot.imagePrompt.trim().length < IMAGE_PROMPT_MIN_LENGTH) {
      issues.push({ shot: shot.number, type: "thin_image_prompt", message: `镜头 ${shot.number} 图像提示词过短（${shot.imagePrompt.trim().length} 字）` });
    }

    // 4. 画面里的【资产名】标注必须在资产库里（检测幻觉角色名）
    const referenced = shot.visual?.match(/【([^】]+)】/gu) ?? [];
    for (const ref of referenced) {
      const name = ref.slice(1, -1).trim();
      // 多个资产名合在一个括号里，按顿号/逗号拆
      const parts = name.split(/[、,，]/u).map((p) => p.trim()).filter(Boolean);
      for (const part of parts) {
        if (knownNames.size > 0 && !knownNames.has(part)) {
          issues.push({ shot: shot.number, type: "untracked_asset_name", message: `镜头 ${shot.number} 引用了未知资产「${part}」` });
        }
      }
    }
  }

  return issues;
}

/** 把质量问题列表格式化成给用户看的 warning 文本。 */
export function formatScriptIssues(issues: readonly ScriptShotIssue[]): string | null {
  if (issues.length === 0) return null;
  const byType = new Map<string, string[]>();
  for (const issue of issues) {
    const list = byType.get(issue.type) ?? [];
    list.push(issue.message);
    byType.set(issue.type, list);
  }
  const labels: Record<string, string> = {
    missing_narration: "缺少旁白",
    long_narration: "旁白过长",
    missing_camera: "缺少景别",
    thin_image_prompt: "图像提示词不完整",
    untracked_asset_name: "引用了未知资产",
  };
  const parts: string[] = [];
  for (const [type, messages] of byType) {
    parts.push(`${labels[type] ?? type}（${messages.length} 处）：${messages.join("；")}`);
  }
  return `剧本质量校验发现问题——\n${parts.join("\n")}`;
}

function estimateSubtitleDurationMs(text: string): number {
  return Math.max(1000, Math.round(text.replace(/\s/gu, "").length * 180));
}

export function buildSubtitleEntries(shots: readonly UnifiedScriptShot[], gapMs = 200): SubtitleEntry[] {
  let cursor = 0;
  let index = 0;
  const entries: SubtitleEntry[] = [];
  for (const shot of shots) {
    const trimmed = shot.subtitle.trim();
    if (!trimmed) continue;
    // 按换行拆成单行，逐行作为独立字幕条目
    const lines = trimmed.split(/\n+/u).map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      // 每行时长按字数估算（每字约 180ms，最低 1 秒）。
      // 不用 shot.durationMs，因为它是 AI 估算的镜头时长，与实际语音时长无关。
      // 后续接入语音合成后，应改为按实际 TTS 音频时长。
      const durationMs = estimateSubtitleDurationMs(line);
      entries.push({
        index: ++index,
        startTimeMs: cursor,
        endTimeMs: cursor + durationMs,
        text: line,
      });
      cursor += durationMs + gapMs;
    }
  }
  return entries;
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

function formatAssTime(ms: number): string {
  const totalCs = Math.round(ms / 10);
  const hours = Math.floor(totalCs / 360000);
  const minutes = Math.floor((totalCs % 360000) / 6000);
  const seconds = Math.floor((totalCs % 6000) / 100);
  const centiseconds = totalCs % 100;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
}

/**
 * 生成 ASS 字幕，用两层叠加实现"只模糊阴影、文字清晰"：
 *
 * - Layer 0（底层 Shadow）：黑色文字 + \blur 高斯模糊 → 柔和的阴影背景板，
 *   让白色文字在任何背景上都可读（白墙、亮色场景等）。
 * - Layer 1（上层 Text）：纯白文字，无模糊、无描边 → 清晰锐利。
 *
 * ASS 的 \blur 是全局的（文字+阴影一起模糊），无法只模糊阴影。
 * 所以用两层 Dialogue 叠加：底层故意模糊当阴影，上层清晰当正文。
 */
export function buildAssContent(
  entries: readonly SubtitleEntry[],
  options?: { readonly blur?: number; readonly fontSize?: number; readonly marginV?: number },
): string {
  const blur = options?.blur ?? 4;
  const fontSize = options?.fontSize ?? 36;
  const marginV = options?.marginV ?? 64;
  const header = [
    "[Script Info]",
    "ScriptType: v4.00+",
    "PlayResX: 1280",
    "PlayResY: 720",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    // Shadow style: black text, blurred → acts as soft shadow backdrop
    `Style: Shadow,Microsoft YaHei,${fontSize},&H66000000,&H66000000,&H66000000,&H66000000,0,0,0,0,100,100,0,0,1,0,0,2,${marginV},${marginV},${marginV},1`,
    // Text style: white text, no outline, no shadow → crisp
    `Style: Text,Microsoft YaHei,${fontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,2,${marginV},${marginV},${marginV},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ].join("\n");
  const dialogues = entries.flatMap((entry) => {
    const text = entry.text.replace(/\n/gu, "\\N");
    const start = formatAssTime(entry.startTimeMs);
    const end = formatAssTime(entry.endTimeMs);
    // Layer 0: blurred dark shadow backdrop
    return [
      `Dialogue: 0,${start},${end},Shadow,,0,0,0,,{\\blur${blur}}${text}`,
      // Layer 1: crisp white text on top
      `Dialogue: 1,${start},${end},Text,,0,0,0,,${text}`,
    ];
  });
  return `${header}\n${dialogues.join("\n")}\n`;
}
