import type { CraftProfile } from "../models/craft-profile.js";
import { formatCraftBreakdownModules } from "./craft-breakdown.js";

// ---------------------------------------------------------------------------
// Craft analysis prompts
// ---------------------------------------------------------------------------

export function buildCraftAnalysisSystemPrompt(language: "zh" | "en"): string {
  if (language === "en") {
    return [
      "You are a writing-craft analyst. Given excerpts from a novel, extract the author's storytelling techniques, not just surface prose style.",
      "Focus on how the author structures chapters, opens scenes, escalates conflict, releases information, manages suspense, and controls narrative perspective.",
      "Output a single JSON object with five top-level sections: structure, sceneRhythm, informationDisclosure, narrativePerspective, and modules.",
      "Every required field must be concrete, evidence-based, and grounded in the excerpts. Do not output placeholders like \"Not specified\", \"Unknown\", or \"N/A\".",
      "If a pattern is implicit, infer the dominant technique from repeated evidence and write it as the prevailing method.",
      "The `modules` array should contain 6-10 fine-grained breakdown cards. Each card must have `category`, `label`, `summary`, and optional `evidence`.",
      "Use categories such as opening, chapterFlow, sceneRhythm, disclosure, suspense, perspective, emotion, turningPoint, and other.",
      "Each section may also provide an optional `exemplar` field with a verbatim 300-500 character excerpt from the input that best demonstrates the technique.",
      "Additionally, provide an `exemplars` array of 4-6 representative excerpts, each with a label, tone, and verbatim text.",
      "Rules for exemplars:",
      "- Excerpts MUST be verbatim copies from the input text; do not paraphrase, abbreviate, or concatenate non-adjacent passages.",
      "- Each excerpt should be 300-500 characters.",
      "- Choose excerpts that best represent the author's technique across different tones, including tension, calm, and climax.",
      "- Keep each technique field focused on how the author writes, such as how chapters open, how conflict escalates, or how suspense is sustained.",
      "Output ONLY the JSON object, with no markdown fences and no commentary.",
    ].join("\n");
  }

  return [
    "你是一位写作手法分析师/拆文分析师。给定一部小说的章节节选，你要提取的是作者的写作手法，而不是只做表层文风总结。",
    "重点分析作者如何开篇、如何推进章节、如何切换场景、如何推进节奏、如何释放信息、如何维持悬念（悬念管理）、如何控制叙述视角与情绪转折。",
    "输出一个 JSON 对象，包含五个顶层部分：structure、sceneRhythm、informationDisclosure、narrativePerspective、modules。",
    "每个必填字段都必须是具体、基于原文证据的描述，不要输出“未明确说明”“未知”“N/A”这类占位词。",
    "如果原文没有直接点明某个模式，就根据重复出现的写法推断出主导手法，并把它写清楚。",
    "`modules` 数组要包含 6-10 个更细的拆文卡片。每个卡片都必须包含 `category`、`label`、`summary`，并可选 `evidence`。",
    "category 可以使用 opening、chapterFlow、sceneRhythm、disclosure、suspense、perspective、emotion、turningPoint、other 等值。",
    "每个 section 还可以附带一个可选的 `exemplar` 字段，内容必须是从输入文本中逐字摘取的 300-500 字片段，用来证明该手法。",
    "此外，再提供一个 `exemplars` 数组，包含 4-6 个代表性片段，每个片段都要有 label、tone 和逐字文本。",
    "范例片段规则：",
    "- 必须是输入文本的逐字副本，不得改写、缩写，也不得拼接不相邻的段落。",
    "- 每个片段长度控制在 300-500 字。",
    "- 选择最能代表作者手法的片段，覆盖紧张、舒缓、高潮等不同基调。",
    "- 每个手法字段都要聚焦“作者怎么写”，例如如何开篇、如何升级冲突、如何吊住悬念。",
    "只输出 JSON 对象，不要 markdown 代码块，不要解释。",
  ].join("\n");
}

export function buildCraftAnalysisUserPrompt(
  sample: string,
  language: "zh" | "en",
): string {
  if (language === "en") {
    return [
      "## Reference Text Excerpts",
      "",
      sample,
      "",
      "## Task",
      "Analyze the writing craft in the excerpts above and output the craft profile JSON.",
    ].join("\n");
  }

  return [
    "## 参考文本节选",
    "",
    sample,
    "",
    "## 任务",
    "分析上述节选的写作手法，输出写作拆文 JSON。",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Craft injection prompts (for writer system prompts)
// ---------------------------------------------------------------------------

/** Build a concise craft guide section for the writer's system prompt. */
export function buildCraftGuide(craftProfile?: CraftProfile): string {
  if (!craftProfile) return "";

  const moduleSection = formatCraftBreakdownModules(craftProfile, "zh");
  const s = craftProfile.structure;
  const r = craftProfile.sceneRhythm;
  const i = craftProfile.informationDisclosure;
  const n = craftProfile.narrativePerspective;

  const lines = [
    "## 写作手法指南",
    "",
    "以下是从参考作品中提取的写作拆文信息。请在创作中模仿这些手法，而不是只模仿表层措辞：",
    "",
    moduleSection,
    "",
    "### 兼容摘要",
    `- 开篇模式: ${s.openingPattern}`,
    `- 单章弧线: ${s.chapterArc}`,
    `- 章末钩子: ${s.endingHookType}`,
    `- 场景切换: ${r.sceneTransitionTechnique}`,
    `- 节奏曲线: ${r.pacingCurve}`,
    `- 冲突升级: ${r.conflictEscalation}`,
    `- 伏笔密度: ${i.foreshadowingDensity}`,
    `- 信息释放节奏: ${i.informationReleaseRhythm}`,
    `- 悬念管理: ${i.suspenseManagement}`,
    `- POV 策略: ${n.povStrategy}`,
    `- 叙述/对话比例: ${n.narrationDialogueRatio}`,
    `- 叙事距离: ${n.narrativeDistance}`,
  ];
  return lines.join("\n");
}

/** Build exemplar excerpts section for the writer's system prompt (few-shot). */
export function buildCraftExemplars(craftProfile?: CraftProfile): string {
  if (!craftProfile || craftProfile.exemplars.length === 0) return "";
  const blocks = craftProfile.exemplars.map((ex) => {
    return `### ${ex.label}（基调: ${ex.tone}）\n${ex.excerpt}`;
  });
  return [
    "## 手法范例",
    "",
    "以下是参考作品的代表性片段。写作前通读 1-2 段，模仿其句法节奏、场景调度和手法，但不要照抄字句。",
    "",
    blocks.join("\n\n"),
  ].join("\n");
}
