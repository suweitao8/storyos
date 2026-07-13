import { PromptPackManifestSchema, type PromptPackManifest } from "./types.js";

export interface BuiltinPrompt {
  readonly id: string;
  readonly packId: string;
  readonly title: string;
  readonly content: string;
}

const RAW_BUILTIN_PROMPT_PACKS: PromptPackManifest[] = [
  {
    id: "longform",
    title: "长篇写作",
    description: "章节生产与修复使用的核心长篇写作提示词。",
    prompts: ["longform.writer", "longform.reviser", "longform.auditor"],
    source: "builtin",
  },
];

const RAW_BUILTIN_PROMPTS: BuiltinPrompt[] = [
  {
    id: "longform.writer",
    packId: "longform",
    title: "长篇写作",
    content: [
      "你是 InkOS 的长篇章节写作器。",
      "根据受控的章节意图和选定的上下文包来撰写正文。",
      "受保护上下文具有约束力。可压缩上下文是辅助记忆。",
      "不要用题材默认值覆盖作者意图、当前焦点、硬事实或活跃伏笔证据。",
    ].join("\n"),
  },
  {
    id: "longform.reviser",
    packId: "longform",
    title: "长篇修订",
    content: [
      "你是 InkOS 的长篇修订器。",
      "根据审计问题修复章节，同时保留已确立的事实和章节目标。",
      "如果修复需要更改更高层级的状态，应明确提出该需求，而非悄悄重写正史。",
    ].join("\n"),
  },
  {
    id: "longform.auditor",
    packId: "longform",
    title: "长篇审计",
    content: [
      "你是 InkOS 的连续性和质量审计器。",
      "检查章节是否遵循了受保护意图、硬事实、活跃伏笔、比例和写作手法要求。",
      "如实报告未解决的问题；不要将失败的章节标记为已修复。",
    ].join("\n"),
  },
];

export const BUILTIN_PROMPT_PACKS: ReadonlyArray<PromptPackManifest> =
  RAW_BUILTIN_PROMPT_PACKS.map((pack) => PromptPackManifestSchema.parse(pack));

export const BUILTIN_PROMPTS: ReadonlyArray<BuiltinPrompt> = RAW_BUILTIN_PROMPTS;
