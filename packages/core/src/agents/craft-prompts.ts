import type { CraftProfile } from "../models/craft-profile.js";

// ---------------------------------------------------------------------------
// Craft analysis prompts
// ---------------------------------------------------------------------------

export function buildCraftAnalysisSystemPrompt(language: "zh" | "en"): string {
  if (language === "en") {
    return [
      "You are a writing craft analyst. Given excerpts from a novel, you extract the author's *storytelling techniques* — not surface prose style, but how the author structures chapters, paces scenes, discloses information, and manages narrative perspective.",
      "Output a single JSON object with four sections: structure, sceneRhythm, informationDisclosure, narrativePerspective.",
      "Each section has string fields describing the technique, plus an optional `exemplar` — a verbatim 300-500 character excerpt from the input that best demonstrates that technique.",
      "Additionally, provide an `exemplars` array of 4-6 representative excerpts, each with a label, tone, and the verbatim text.",
      "Rules for exemplars:",
      "- Excerpts MUST be verbatim copies from the input text — do not paraphrase, abbreviate, or concatenate non-adjacent passages.",
      "- Each excerpt should be 300-500 characters.",
      "- Choose excerpts that best represent the author's technique across different tones (tense, calm, climax).",
      "Output ONLY the JSON object, no markdown fences, no commentary.",
    ].join("\n");
  }
  return [
    "你是一位写作手法分析师。给定小说节选,你要提取作者的*写作技法*——不是表层文风(句长、修辞),而是作者如何编排章节结构、调度场景节奏、披露信息、管理叙事视角。",
    "输出一个 JSON 对象,包含四个部分:structure、sceneRhythm、informationDisclosure、narrativePerspective。",
    "每部分有若干字符串字段描述技法,外加一个可选的 `exemplar`——从输入文本中逐字摘取的 300-500 字范例片段,最能体现该技法。",
    "此外,提供一个 `exemplars` 数组,含 4-6 个代表性片段,每个带 label、tone 和逐字文本。",
    "范例片段规则:",
    "- 必须是输入文本的逐字副本——不得改写、缩写或拼接不相邻的段落。",
    "- 每个片段 300-500 字。",
    "- 选择最能代表作者技法的片段,覆盖不同基调(紧张、舒缓、高潮)。",
    "只输出 JSON 对象,不要 markdown 代码块,不要注释。",
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
    "分析上述节选的写作手法,输出写作模式 JSON。",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Craft injection prompts (for writer system prompts)
// ---------------------------------------------------------------------------

/** Build a concise craft guide section for the writer's system prompt. */
export function buildCraftGuide(craftProfile?: CraftProfile): string {
  if (!craftProfile) return "";
  const s = craftProfile.structure;
  const r = craftProfile.sceneRhythm;
  const i = craftProfile.informationDisclosure;
  const n = craftProfile.narrativePerspective;
  const lines = [
    "## 写作手法指南",
    "",
    "以下是从参考作品中提取的写作技法。请在创作中模仿这些手法:",
    "",
    "### 结构手法",
    `- 开篇模式:${s.openingPattern}`,
    `- 单章弧线:${s.chapterArc}`,
    `- 章末钩子:${s.endingHookType}`,
    "",
    "### 场景与节奏",
    `- 场景切换:${r.sceneTransitionTechnique}`,
    `- 节奏曲线:${r.pacingCurve}`,
    `- 冲突升级:${r.conflictEscalation}`,
    "",
    "### 信息披露",
    `- 伏笔密度:${i.foreshadowingDensity}`,
    `- 信息释放节奏:${i.informationReleaseRhythm}`,
    `- 悬念管理:${i.suspenseManagement}`,
    "",
    "### 叙事视角",
    `- POV 策略:${n.povStrategy}`,
    `- 叙述/对话/描写比例:${n.narrationDialogueRatio}`,
    `- 叙事距离:${n.narrativeDistance}`,
  ];
  return lines.join("\n");
}

/** Build exemplar excerpts section for the writer's system prompt (few-shot). */
export function buildCraftExemplars(craftProfile?: CraftProfile): string {
  if (!craftProfile || craftProfile.exemplars.length === 0) return "";
  const blocks = craftProfile.exemplars.map((ex) => {
    return `### ${ex.label}（基调:${ex.tone}）\n\n${ex.excerpt}`;
  });
  return [
    "## 手法范例",
    "",
    "以下是参考作品的代表性片段。写作前通读 1-2 遍,模仿其句法节奏、场景调度和手法,但不要照抄字句:",
    "",
    blocks.join("\n\n"),
  ].join("\n");
}
