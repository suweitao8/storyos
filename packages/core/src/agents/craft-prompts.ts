import type { CraftMode, CraftProfile } from "../models/craft-profile.js";
import { formatCraftBreakdownModules } from "./craft-breakdown.js";

// ---------------------------------------------------------------------------
// Craft analysis prompts
// ---------------------------------------------------------------------------

export function buildCraftAnalysisSystemPrompt(language: "zh" | "en", mode: CraftMode = "general"): string {
  const ghostStoryInstructions = mode === "ghost-story"
    ? language === "en"
      ? [
          "This is a ghost-story craft extraction. Add a required top-level `ghostStory` object with exactly these fields: fearCore, supernaturalRules, taboos, protagonistVulnerability, clueSystem, revealCadence, scareCadence, escalationLadder, sensoryMotifs, endingAftertaste.",
          "Describe repeatable mechanisms, not the reference story's named characters, locations, monsters, or plot events. Every field must explain how to use the mechanism in an original story.",
          "Separate what is shown, what is implied, and what remains ambiguous. Do not turn unexplained details into arbitrary facts.",
          "The output must be useful as a generation guide: include trigger, constraint, escalation, evidence, and payoff wherever the source supports them.",
          "Never copy distinctive sentences, dialogue, proper nouns, or the reference's exact sequence of events into the craft guide.",
        ]
      : [
          "这是鬼故事模式提取。必须新增顶层 `ghostStory` 对象，且包含字段：fearCore（恐惧核心）、supernaturalRules（超自然规则）、taboos（禁忌与触发条件）、protagonistVulnerability（主角脆弱点）、clueSystem（线索系统）、revealCadence（真相揭示节奏）、scareCadence（惊吓节奏）、escalationLadder（恐怖升级阶梯）、sensoryMotifs（感官母题）、endingAftertaste（结尾余韵）。",
          "提取可复用的恐怖机制，不要提取原故事的人名、地点、怪物名称或具体情节。每个字段都要说明如何用于创作一个全新的故事。",
          "区分明确展示、暗示线索和刻意留白，不要把原文没有解释的内容擅自补成确定设定。",
          "结果必须能直接指导生成：在原文有依据时写清触发条件、限制规则、升级方式、证据链和情绪回报。",
          "禁止把原文的独特句子、对白、专有名词或完整事件顺序复制到模式中。",
        ]
    : [];

  const worldviewStoryInstructions = language === "en"
    ? [
        "The profile must include `worldview` and `storyOutline`.",
        "`worldview` captures reusable world rules, setting logic, atmosphere, and social or supernatural mechanisms without proper nouns.",
        "`storyOutline` captures a generalized arc from opening situation through pressure, conflict, escalation, turning points, climax, and payoff. It must not copy the reference plot, characters, wording, or event order.",
      ]
    : [
        "\u5fc5\u987b\u5305\u542b worldview \u548c storyOutline \u4e24\u4e2a\u5b57\u6bb5\u3002",
        "worldview \u53ea\u63d0\u53d6\u53ef\u590d\u7528\u7684\u4e16\u754c\u89c4\u5219\u3001\u8bbe\u5b9a\u903b\u8f91\u3001\u6c1b\u56f4\u548c\u793e\u4f1a\u6216\u8d85\u81ea\u7136\u673a\u5236\uff0c\u4e0d\u4fdd\u7559\u4e13\u6709\u540d\u8bcd\u3002",
        "storyOutline \u63d0\u53d6\u4ece\u5f00\u7bc7\u60c5\u5883\u5230\u538b\u529b\u3001\u51b2\u7a81\u3001\u5347\u7ea7\u3001\u8f6c\u6298\u3001\u9ad8\u6f6e\u548c\u56de\u62a5\u7684\u6982\u62ec\u6545\u4e8b\u9aa8\u67b6\uff0c\u4e0d\u5f97\u590d\u5236\u539f\u4f5c\u7684\u60c5\u8282\u3001\u4eba\u7269\u3001\u63aa\u8f9e\u6216\u4e8b\u4ef6\u987a\u5e8f\u3002",
      ];

  if (language === "en") {
    return [
      "You are a writing-craft analyst. Given excerpts from a novel, extract the author's storytelling techniques, not just surface prose style.",
      "Focus on how the author structures chapters, opens scenes, escalates conflict, releases information, manages suspense, and controls narrative perspective.",
      "Also extract two generation-ready top-level fields: `worldview` and `storyOutline`.",
      mode === "ghost-story"
        ? "Output a single JSON object with these top-level sections: worldview, storyOutline, structure, sceneRhythm, informationDisclosure, narrativePerspective, ghostStory, modules, and exemplars."
        : "Output a single JSON object with these top-level sections: worldview, storyOutline, structure, sceneRhythm, informationDisclosure, narrativePerspective, modules, and exemplars.",
      "Use these exact English top-level keys; do not translate the section names or wrap the object in another profile key.",
      "`worldview` must describe reusable world rules, setting logic, social or supernatural mechanisms, and atmosphere. Remove names, places, and other proper nouns from the reference.",
      "`storyOutline` must describe a generalized story skeleton: opening situation, protagonist pressure, core conflict, escalation, turning points, climax, and ending payoff. Do not copy the reference's characters, exact plot, event order, or wording.",
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
      ...worldviewStoryInstructions,
      ...ghostStoryInstructions,
    ].join("\n");
  }

  return [
    "你是一位写作手法分析师/拆文分析师。给定一部小说的章节节选，你要提取的是作者的写作手法，而不是只做表层文风总结。",
    "重点分析作者如何开篇、如何推进章节、如何切换场景、如何推进节奏、如何释放信息、如何维持悬念（悬念管理）、如何控制叙述视角与情绪转折。",
    "\u9664\u4e0a\u8ff0\u5206\u7c7b\u5916\uff0c\u5fc5\u987b\u540c\u65f6\u8f93\u51fa worldview \u548c storyOutline \u4e24\u4e2a\u9876\u5c42\u5b57\u6bb5\uff0c\u5206\u522b\u8868\u793a\u53ef\u590d\u7528\u7684\u4e16\u754c\u89c4\u5219\u4e0e\u6982\u62ec\u6545\u4e8b\u9aa8\u67b6\u3002",
    mode === "ghost-story"
      ? "输出一个 JSON 对象，包含六个顶层部分：structure、sceneRhythm、informationDisclosure、narrativePerspective、ghostStory、modules。"
      : "输出一个 JSON 对象，包含五个顶层部分：structure、sceneRhythm、informationDisclosure、narrativePerspective、modules。",
    "顶层键必须严格使用这些英文名称，不要把 section 名称翻译成中文，也不要再套一层写作模式或 profile 对象。",
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
    ...worldviewStoryInstructions,
    ...ghostStoryInstructions,
  ].join("\n");
}

export function buildCraftAnalysisUserPrompt(
  sample: string,
  language: "zh" | "en",
  mode: CraftMode = "general",
): string {
  if (language === "en") {
    return [
      "## Reference Text Excerpts",
      "",
      sample,
      "",
      "## Task",
      "Analyze the writing craft in the excerpts above and output the craft profile JSON.",
      "The profile must include a reusable worldview and a generalized storyOutline for creating an original story.",
      ...(mode === "ghost-story" ? ["The profile must include the required ghostStory object and make every field operational for generating an original ghost story."] : []),
    ].join("\n");
  }

  return [
    "## 参考文本节选",
    "",
    sample,
    "",
    "## 任务",
    "分析上述节选的写作手法，输出写作拆文 JSON。",
    ...(mode === "ghost-story" ? ["必须包含完整 ghostStory 对象，并让每个字段都能直接指导原创鬼故事生成。"] : []),
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
    ...(craftProfile.worldview?.trim()
      ? ["", "参考世界观（仅借鉴规则与机制）", craftProfile.worldview.trim()]
      : []),
    ...(craftProfile.storyOutline?.trim()
      ? ["", "参考故事大纲（重新设计人物与事件）", craftProfile.storyOutline.trim()]
      : []),
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
  lines.push(
    "",
    "请基于上述世界观机制和故事骨架重新设计人物、地点、因果链与结局；只借鉴可复用方法，不复制原作。",
  );
  if (craftProfile.mode === "ghost-story" && craftProfile.ghostStory) {
    const h = craftProfile.ghostStory;
    lines.push(
      "",
      "## 鬼故事仿写约束",
      "以下内容只提取可复用的恐怖机制，不复制原故事的句子、人物、地点或事件顺序。",
      `- 恐惧核心: ${h.fearCore}`,
      `- 超自然规则: ${h.supernaturalRules}`,
      `- 禁忌与触发条件: ${h.taboos}`,
      `- 主角脆弱点: ${h.protagonistVulnerability}`,
      `- 线索系统: ${h.clueSystem}`,
      `- 真相揭示节奏: ${h.revealCadence}`,
      `- 惊吓节奏: ${h.scareCadence}`,
      `- 恐怖升级阶梯: ${h.escalationLadder}`,
      `- 感官母题: ${h.sensoryMotifs}`,
      `- 结尾余韵: ${h.endingAftertaste}`,
      "生成时必须重新设计人物、地点、因果链和具体事件，只借鉴上述机制。",
    );
  }
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
