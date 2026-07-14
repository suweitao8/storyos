import type { BilibiliSubtitleEntry } from "./bilibili.js";
import { subtitleText } from "./bilibili.js";
import { chatCompletion } from "@actalk/inkos-core";
import type { LLMClient } from "@actalk/inkos-core";

export interface SubtitleCorrectionResult {
  readonly entries: BilibiliSubtitleEntry[];
  readonly changedCount: number;
}

export interface SubtitleCorrectionRunResult extends SubtitleCorrectionResult {
  readonly status: "corrected" | "fallback";
  readonly message?: string;
}

export interface SubtitleCorrectionOptions {
  readonly client: LLMClient;
  readonly model: string;
  readonly chatCompletion?: typeof chatCompletion;
}

interface SubtitleCorrectionItem {
  readonly index?: unknown;
  readonly content?: unknown;
}

function stripMarkdownFence(value: string): string {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/iu, "")
    .replace(/\s*```$/u, "")
    .trim();
}

export function applySubtitleCorrection(
  source: ReadonlyArray<BilibiliSubtitleEntry>,
  rawResponse: string,
): SubtitleCorrectionResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripMarkdownFence(rawResponse));
  } catch (error) {
    throw new Error(`字幕校正结果不是有效 JSON：${error instanceof Error ? error.message : String(error)}`);
  }

  if (!Array.isArray(parsed) || parsed.length !== source.length) {
    throw new Error("字幕校正结果必须完整覆盖所有字幕段落");
  }

  const byIndex = new Map<number, string>();
  for (const item of parsed as SubtitleCorrectionItem[]) {
    const index = item.index;
    if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= source.length) {
      throw new Error("字幕校正结果包含无效段落序号");
    }
    if (typeof item.content !== "string" || !item.content.trim()) {
      throw new Error("字幕校正结果包含空字幕正文");
    }
    if (byIndex.has(index)) {
      throw new Error("字幕校正结果包含重复段落序号");
    }
    byIndex.set(index, item.content.trim());
  }

  const entries = source.map((entry, index) => {
    const content = byIndex.get(index);
    if (content === undefined) throw new Error("字幕校正结果缺少段落");
    return { ...entry, content };
  });

  return {
    entries,
    changedCount: entries.reduce((count, entry, index) => count + (entry.content !== source[index]!.content ? 1 : 0), 0),
  };
}

function buildCorrectionPrompt(entries: ReadonlyArray<BilibiliSubtitleEntry>): string {
  const numbered = entries
    .map((entry, index) => `${index}: ${subtitleText([entry])}`)
    .join("\n");
  return [
    "请校正下面的中文视频字幕。只修正 ASR/OCR 造成的错别字、同音字、形近字或结合上下文明显不成立的词。",
    "不要润色，不要改写语气，不要补充内容；没有把握时保持原文。",
    "必须保留所有段落的顺序和边界，只返回 JSON 数组，每项格式为 {\"index\": number, \"content\": string }。",
    "不要输出解释、Markdown 或思考过程。",
    "字幕如下：",
    numbered,
  ].join("\n");
}

export async function correctBilibiliSubtitles(
  source: ReadonlyArray<BilibiliSubtitleEntry>,
  options: SubtitleCorrectionOptions,
): Promise<SubtitleCorrectionRunResult> {
  try {
    const response = await (options.chatCompletion ?? chatCompletion)(
      options.client,
      options.model,
      [
        {
          role: "system",
          content: "你是字幕文字校正器。严格按照用户要求，只输出 JSON，不输出任何思考过程。",
        },
        { role: "user", content: buildCorrectionPrompt(source) },
      ],
      {
        temperature: 0,
        maxTokens: Math.min(12_000, Math.max(512, source.length * 32)),
        retry: false,
      },
    );
    const corrected = applySubtitleCorrection(source, response.content);
    return { ...corrected, status: "corrected" };
  } catch {
    return {
      entries: [...source],
      changedCount: 0,
      status: "fallback",
      message: "字幕文字校正失败，已使用原始字幕",
    };
  }
}
