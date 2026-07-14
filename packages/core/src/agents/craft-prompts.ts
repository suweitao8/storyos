import type { CraftMode, CraftProfile } from "../models/craft-profile.js";
import { STORY_SEED_SECTION_DEFINITIONS } from "../models/story-seed.js";
import { formatCraftBreakdownModules } from "./craft-breakdown.js";

// ---------------------------------------------------------------------------
// Craft analysis prompts
// ---------------------------------------------------------------------------

export function buildCraftAnalysisSystemPrompt(
  language: "zh" | "en",
  mode: CraftMode = "general",
  sourceType: "bilibili" | "novel" = "novel",
): string {
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

  const videoInstructions = sourceType === "bilibili"
    ? language === "en"
      ? [
          "This is a timestamped video transcript. Add a required top-level `videoStory` object.",
          "Extract 8-14 ordered beats with normalized positions from 0 to 1 and source time ranges when available. Cover hook, setup, inciting incident, pressure, foreshadowing, reversal, false victory, climax, and ending when supported.",
          "Extract 2-5 reversals and connect at least two setup beat orders to every reveal. Extract 3-8 payoffs with setup, release, cost or consequence, and emotional effect.",
          "Preserve rhythm and emotional spacing with relative positions, not the reference's events or wording.",
          "Evidence must be short labels or transcript snippets under 100 characters. Never copy dialogue, distinctive sentences, names, or a contiguous plot sequence.",
          "Add originalizationRules requiring new identities, setting, causal chain, supernatural mechanism, scene details, and ending. Transfer beat functions and positions only.",
        ]
      : [
          "这是带时间轴的视频字幕，必须新增顶层 videoStory 对象。",
          "提取 8-14 个按时间排序的剧情节拍，position 必须是 0-1 的相对位置，并在字幕有时间时填写 timeRange（格式为粗粒度区间如 \"0:00-0:41\"，取整到秒，不要小数）；尽量覆盖开场钩子、设定、诱发事件、压力、伏笔、反转、假胜利、高潮和结尾。",
          "提取 2-5 个反转；每个反转至少关联两个铺垫节拍，并写清表面认知、新真相、重释线索和情绪效果；另提取 3-8 个爽点或情绪释放点。",
          "用百分比或时间位置保留原视频的节奏与情绪间距，但绝不保留原事件、人物、对白或表达。",
          "evidence 只能是 100 字以内的短标签或字幕证据，禁止复制对白、独特句子、专有名词和连续事件链。",
          "originalizationRules 必须要求重新设计人物、场景、因果链、超自然机制、场面细节和结尾；生成时只能迁移节拍功能与相对位置。",
        ]
    : [];

  const videoModeInstructions = sourceType === "bilibili"
    ? mode === "bilibili-commentary"
      ? language === "en"
        ? [
            "This is a Bilibili film or television commentary reference. Treat the commentary as a compressed plot retelling, and extract the causal chain, character pressure, reversals, reveals, and payoff timing that can be rebuilt as an original short story.",
            "The profile must support making a similar-feeling original short story from the commentary structure, while replacing the source film or series identities, setting, scenes, causal chain, and ending.",
          ]
        : [
            "这是B站影视解说参考。把解说视为被压缩的影视剧情，重点提取因果链、人物压力、反转、信息揭示和情绪回报节奏，用于重新搭建一个原创短篇故事。",
            "结果必须服务于“参考影视解说结构，制作类似但完全原创的短篇故事”：必须替换原影视作品的人物、场景、因果链、具体事件和结局。",
          ]
      : mode === "bilibili-short-story"
        ? language === "en"
          ? [
              "This is a Bilibili short-story reference. Extract the compact hook, escalation, reversal, emotional payoff, and ending aftertaste that make the short story work.",
              "The profile should help create a new short story with a similar rhythm, while replacing identities, setting, causal chain, scenes, wording, and ending.",
            ]
          : [
              "这是B站短篇故事参考。重点提取短篇故事成立所需的开场钩子、冲突推进、反转、情绪回报和结尾余韵。",
              "结果应帮助创作节奏相近但全新的短篇故事，必须替换人物、场景、因果链、措辞和结局。",
            ]
        : []
    : [];

  if (language === "en") {
    return [
      "You are a writing-craft analyst. Given excerpts from a novel, extract the author's storytelling techniques, not just surface prose style.",
      "Focus on how the author structures chapters, opens scenes, escalates conflict, releases information, manages suspense, and controls narrative perspective.",
      "Also extract two generation-ready top-level fields: `worldview` and `storyOutline`.",
      mode === "ghost-story"
        ? sourceType === "bilibili"
          ? "Output a single JSON object with these top-level sections: worldview, storyOutline, structure, sceneRhythm, informationDisclosure, narrativePerspective, ghostStory, videoStory, modules, and exemplars."
          : "Output a single JSON object with these top-level sections: worldview, storyOutline, structure, sceneRhythm, informationDisclosure, narrativePerspective, ghostStory, modules, and exemplars."
        : sourceType === "bilibili"
          ? "Output a single JSON object with these top-level sections: worldview, storyOutline, structure, sceneRhythm, informationDisclosure, narrativePerspective, videoStory, modules, and exemplars."
          : "Output a single JSON object with these top-level sections: worldview, storyOutline, structure, sceneRhythm, informationDisclosure, narrativePerspective, modules, and exemplars.",
      "Use these exact English top-level keys; do not translate the section names or wrap the object in another profile key.",
      "The structure object must include openingPattern, chapterArc, and endingHookType.",
      "The sceneRhythm object must include sceneTransitionTechnique, pacingCurve, and conflictEscalation.",
      "The informationDisclosure object must include foreshadowingDensity, informationReleaseRhythm, and suspenseManagement.",
      "The narrativePerspective object must include povStrategy, narrationDialogueRatio, and narrativeDistance.",
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
      ...videoInstructions,
      ...videoModeInstructions,
    ].join("\n");
  }

  return [
    "你是一位写作手法分析师/拆文分析师。给定一部小说的章节节选，你要提取的是作者的写作手法，而不是只做表层文风总结。",
    "重点分析作者如何开篇、如何推进章节、如何切换场景、如何推进节奏、如何释放信息、如何维持悬念（悬念管理）、如何控制叙述视角与情绪转折。",
    "\u9664\u4e0a\u8ff0\u5206\u7c7b\u5916\uff0c\u5fc5\u987b\u540c\u65f6\u8f93\u51fa worldview \u548c storyOutline \u4e24\u4e2a\u9876\u5c42\u5b57\u6bb5\uff0c\u5206\u522b\u8868\u793a\u53ef\u590d\u7528\u7684\u4e16\u754c\u89c4\u5219\u4e0e\u6982\u62ec\u6545\u4e8b\u9aa8\u67b6\u3002",
    mode === "ghost-story"
      ? "输出一个 JSON 对象，必须包含 worldview、storyOutline、structure、sceneRhythm、informationDisclosure、narrativePerspective、ghostStory、modules、exemplars；不能省略任何 section。"
      : sourceType === "bilibili"
        ? "输出一个 JSON 对象，必须包含 worldview、storyOutline、structure、sceneRhythm、informationDisclosure、narrativePerspective、videoStory、modules、exemplars；不能省略任何 section。"
        : "输出一个 JSON 对象，必须包含 worldview、storyOutline、structure、sceneRhythm、informationDisclosure、narrativePerspective、modules、exemplars；不能省略任何 section。",
    "顶层键必须严格使用这些英文名称，不要把 section 名称翻译成中文，也不要再套一层写作模式或 profile 对象。",
    "structure 必须同时包含 openingPattern、chapterArc、endingHookType。",
    "sceneRhythm 必须同时包含 sceneTransitionTechnique、pacingCurve、conflictEscalation。",
    "informationDisclosure 必须同时包含 foreshadowingDensity、informationReleaseRhythm、suspenseManagement。",
    "narrativePerspective 必须同时包含 povStrategy、narrationDialogueRatio、narrativeDistance。",
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
    ...videoInstructions,
    ...videoModeInstructions,
  ].join("\n");
}

export function buildCraftAnalysisUserPrompt(
  sample: string,
  language: "zh" | "en",
  mode: CraftMode = "general",
  sourceType: "bilibili" | "novel" = "novel",
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
      ...(sourceType === "bilibili" ? ["The profile must include videoStory with timestamp-aligned beats, reversals, payoffs, pacing, and explicit originalization rules."] : []),
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
  if (craftProfile.videoStory) {
    const v = craftProfile.videoStory;
    lines.push(
      "",
      "## 视频节奏迁移指南",
      "仅迁移参考视频的节拍功能、相对位置、升级间距、反转和收束时机。不要复用其表达、身份、设定、因果链或连续事件序列。",
      `- 一句话故事：${v.logline}`,
      `- 观众承诺：${v.audiencePromise}`,
      `- 大纲：${v.outline}`,
      `- 节奏曲线：${v.pacingCurve}`,
      `- 钩子策略：${v.hookStrategy}`,
      `- 高潮策略：${v.climaxStrategy}`,
      `- 结尾余味：${v.endingAftertaste}`,
      "### 节拍时间线",
      ...v.beats.map((beat) => `- ${Math.round(beat.position * 100)}%${beat.timeRange ? ` (${beat.timeRange})` : ""} [${beat.kind}] ${beat.event} | 功能：${beat.function} | 情绪：${beat.emotionalEffect}`),
      "### 反转",
      ...v.reversals.map((reversal) => `- ${Math.round(reversal.position * 100)}%: 表面真相 ${reversal.apparentTruth}；揭示 ${reversal.reveal}；重新解读线索 ${reversal.reinterpretedClues}；铺垫节拍 ${reversal.setupBeatOrders.join(", ")}`),
      "### 收束",
      ...v.payoffs.map((payoff) => `- ${Math.round(payoff.position * 100)}%: 铺垫 ${payoff.setup}；释放 ${payoff.release}；代价/后果 ${payoff.costOrConsequence}；情绪 ${payoff.emotionalEffect}`),
      "### 原创化规则",
      ...v.originalizationRules.map((rule) => `- ${rule}`),
      "起草前，创造新的角色、设定、因果链、超自然机制、场景细节和结局。仅保留节奏图谱和叙事功能。",
    );
  }
  return lines.join("\n");
}

/**
 * Build the source-isolated craft contract used by short-fiction generation.
 *
 * Short fiction may transfer rhythm and narrative function, but must not see
 * the reference plot, concrete video events, or verbatim exemplar prose.
 */
export function buildShortFictionCraftGuide(craftProfile?: CraftProfile): string {
  if (!craftProfile) return "";

  const s = craftProfile.structure;
  const r = craftProfile.sceneRhythm;
  const i = craftProfile.informationDisclosure;
  const n = craftProfile.narrativePerspective;
  const lines = [
    "## 短篇原创化写作契约",
    "",
    "写作模式只提供可迁移的叙事功能和节奏，不提供可复述的原故事。先按改编方案重建故事，再按节拍功能组织新事件。",
    "",
    "### 允许迁移的叙事机制",
    `- 开篇功能: ${s.openingPattern}`,
    `- 单章弧线功能: ${s.chapterArc}`,
    `- 章末钩子功能: ${s.endingHookType}`,
    `- 场景切换功能: ${r.sceneTransitionTechnique}`,
    `- 节奏曲线: ${r.pacingCurve}`,
    `- 冲突升级方法: ${r.conflictEscalation}`,
    `- 伏笔密度: ${i.foreshadowingDensity}`,
    `- 信息释放节奏: ${i.informationReleaseRhythm}`,
    `- 悬念管理: ${i.suspenseManagement}`,
    `- 视角策略: ${n.povStrategy}`,
    `- 叙述/对话比例: ${n.narrationDialogueRatio}`,
    `- 叙事距离: ${n.narrativeDistance}`,
  ];

  if (craftProfile.storySeed?.originalizationPlan?.trim()) {
    lines.push(
      "",
      "### 缓存的原创化改编方案",
      craftProfile.storySeed.originalizationPlan.trim(),
    );
  } else {
    lines.push(
      "",
      "### 默认原创化改编方案",
      "没有缓存的改编方案。每次创作必须主动选择新的故事空间、职业/身份、关系结构、核心规则、因果链、关键道具、场景事件和结局代价。",
    );
  }

  if (craftProfile.mode === "ghost-story" && craftProfile.ghostStory) {
    const h = craftProfile.ghostStory;
    lines.push(
      "",
      "### 可迁移的恐怖机制",
      `- 恐惧核心: ${h.fearCore}`,
      `- 规则设计方法: ${h.supernaturalRules}`,
      `- 禁忌与触发方法: ${h.taboos}`,
      `- 主角脆弱点功能: ${h.protagonistVulnerability}`,
      `- 线索系统方法: ${h.clueSystem}`,
      `- 真相揭示节奏: ${h.revealCadence}`,
      `- 惊吓节奏: ${h.scareCadence}`,
      `- 恐怖升级方法: ${h.escalationLadder}`,
      `- 感官母题功能: ${h.sensoryMotifs}`,
      `- 结尾余味功能: ${h.endingAftertaste}`,
    );
  }

  if (craftProfile.videoStory) {
    const v = craftProfile.videoStory;
    lines.push(
      "",
      "### 视频节奏功能（只迁移位置和功能）",
      ...v.beats.map((beat) => `- ${Math.round(beat.position * 100)}% [${beat.kind}] 功能：${beat.function}；情绪：${beat.emotionalEffect}`),
      ...v.reversals.map((reversal) => `- ${Math.round(reversal.position * 100)}% 反转功能；情绪：${reversal.emotionalEffect}`),
      ...v.payoffs.map((payoff) => `- ${Math.round(payoff.position * 100)}% 收束功能；情绪：${payoff.emotionalEffect}`),
      `- 节奏曲线功能: ${v.pacingCurve}`,
      `- 钩子功能: ${v.hookStrategy}`,
      `- 高潮功能: ${v.climaxStrategy}`,
      `- 结尾余味功能: ${v.endingAftertaste}`,
      "- 原创化分析规则:",
      ...v.originalizationRules.map((rule) => `  - ${rule}`),
    );
  }

  lines.push(
    "",
    "### 硬性原创要求",
    "- 原始 worldview、故事大纲、视频 logline、具体事件、反转揭示、收束事件和范例原文不是创作素材，不得复述或改写。",
    "- 新故事至少重建故事空间、职业/身份、关系结构、核心因果链、关键道具/规则、场景事件和结局代价。",
    "- 节拍只能迁移开场钩子、压力间距、信息释放、反转位置、高潮功能和余味功能，不能迁移事件顺序。",
    "- 写大纲前先完成替换检查：如果只是给原人物改名、给原地点换称呼或保留同一条因果链，必须推倒重建。",
  );
  return lines.join("\n");
}

export interface StoryDirectionPrompt {
  readonly system: string;
  readonly user: string;
}

function compactStoryDirectionSource(value: string | undefined, maxLength = 2_400): string {
  const normalized = value?.trim().replace(/\s+/gu, " ") ?? "";
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function buildPlainLanguageGuidance(language: "zh" | "en"): { readonly system: readonly string[]; readonly user: readonly string[] } {
  if (language === "zh") {
    return {
      system: [
        "表达面向B站普通观众，不要求读者懂写作学、影视制作或其他行业知识。",
        "故事可以有悬疑、反转和复杂因果，但呈现方式必须让没有专业背景的观众也能快速看懂。",
      ],
      user: [
        "用日常中文写，优先使用具体的人、动作、选择和结果；不要把专业分析术语直接当成故事设定内容。",
        "不写论文式分析，不堆叠抽象概念。必须使用专业词时，第一次出现就用一句大白话解释，后面尽量继续用大白话。",
        "每个板块控制在少量有重点的短句或要点内；大纲只写情节——'发生了什么—主角怎么应对—带来什么新麻烦'，不写写作手法、技巧说明或创作理论。",
        "把‘冲突升级机制’写成‘每解决一个问题，新的麻烦变得更大’，把‘信息释放节奏’写成‘先告诉观众什么，哪些事情暂时藏住’。",
        "原创化改编方案也要让普通观众看懂，写清新的空间、人物、关系、事件和结局，不要只列专业检查项。",
      ],
    };
  }

  return {
    system: [
      "Write for a general Bilibili audience without assuming writing, film, or industry expertise.",
      "The story may contain suspense, reversals, and complex causality, but the presentation must remain easy to follow.",
    ],
    user: [
      "Use everyday language and prioritize concrete people, actions, choices, and consequences instead of exposing craft jargon as story content.",
      "Do not write an academic analysis or stack abstract concepts. If a technical term is necessary, explain it in plain language the first time and keep using plain language afterward.",
      "Keep each section focused and concise; the outline must contain only plot events — what happens, how the protagonist responds, and what bigger problem follows — not writing techniques or craft instructions.",
      "Explain the transformation plan in audience-friendly language, naming the new setting, people, relationships, events, and ending rather than listing technical checks.",
    ],
  };
}

/** Build a generation prompt that transfers craft mechanics into a new story direction. */
export function buildStoryDirectionPrompt(
  craftProfile: CraftProfile,
  kind: "long" | "short",
  language: "zh" | "en",
  previousDirection?: string,
): StoryDirectionPrompt {
  const structure = craftProfile.structure;
  const rhythm = craftProfile.sceneRhythm;
  const disclosure = craftProfile.informationDisclosure;
  const perspective = craftProfile.narrativePerspective;
  const referenceSections = [
    ["世界观与规则", craftProfile.worldview],
    ["通用故事大纲", craftProfile.storyOutline],
    ["开篇与章节弧线", `${structure.openingPattern}; ${structure.chapterArc}; 结尾钩子: ${structure.endingHookType}`],
    ["场景节奏", `${rhythm.sceneTransitionTechnique}; 节奏: ${rhythm.pacingCurve}; 升级: ${rhythm.conflictEscalation}`],
    ["信息揭露", `${disclosure.foreshadowingDensity}; ${disclosure.informationReleaseRhythm}; ${disclosure.suspenseManagement}`],
    ["叙事视角", `${perspective.povStrategy}; ${perspective.narrationDialogueRatio}; ${perspective.narrativeDistance}`],
  ]
    .filter(([, value]) => Boolean(value?.trim()))
    .map(([label, value]) => `${label}:\n${compactStoryDirectionSource(value)}`);

  if (craftProfile.ghostStory) {
    const ghost = craftProfile.ghostStory;
    referenceSections.push(
      [
        "鬼故事机制",
        [
          `恐惧核心: ${ghost.fearCore}`,
          `超自然规则: ${ghost.supernaturalRules}`,
          `禁忌: ${ghost.taboos}`,
          `主角弱点: ${ghost.protagonistVulnerability}`,
          `线索体系: ${ghost.clueSystem}`,
          `揭示节奏: ${ghost.revealCadence}`,
          `惊吓节奏: ${ghost.scareCadence}`,
          `升级阶梯: ${ghost.escalationLadder}`,
          `感官意象: ${ghost.sensoryMotifs}`,
          `结尾余味: ${ghost.endingAftertaste}`,
        ].join("\n"),
      ].join("\n"),
    );
  }

  if (craftProfile.videoStory) {
    const video = craftProfile.videoStory;
    referenceSections.push(
      [
        "视频节奏图谱",
        [
          `一句话故事: ${video.logline}`,
          `观众承诺: ${video.audiencePromise}`,
          `大纲: ${video.outline}`,
          `节奏: ${video.pacingCurve}`,
          `钩子: ${video.hookStrategy}`,
          `高潮: ${video.climaxStrategy}`,
          `结尾: ${video.endingAftertaste}`,
          ...video.beats.map((beat) => `${Math.round(beat.position * 100)}% [${beat.kind}] ${beat.function}: ${beat.emotionalEffect}`),
          ...video.reversals.map((reversal) => `${Math.round(reversal.position * 100)}% 反转: ${reversal.emotionalEffect}`),
          ...video.payoffs.map((payoff) => `${Math.round(payoff.position * 100)}% 收束: ${payoff.emotionalEffect}`),
        ].join("\n"),
      ].join("\n"),
    );
  }

  const target = kind === "short" ? "一篇单章节短篇故事" : "一部十章长篇故事";
  const languageRule = language === "zh"
    ? "用简体中文输出结果。"
    : "Output the result in English.";
  const plainLanguageGuidance = buildPlainLanguageGuidance(language);

  return {
    system: [
      "你是一位故事开发编辑。",
      languageRule,
      ...plainLanguageGuidance.system,
      "仅将参考素材用于可复用的机制、世界逻辑、节奏功能和情感运动。",
      "创造一个全新的故事方向，包含新的身份、设定细节、因果链、场景和结局。绝不复制 distinctive 的名字、对话、措辞或连续的事件序列；不得复用连续事件顺序。",
      "Originality gate: use new identities, settings, relationships, causal chains, scenes, and endings; never reuse a contiguous event sequence.",
      "只返回可直接使用的故事方向简报，不要分析参考素材，也不要写前言。",
    ].join("\n"),
    user: [
      `根据以下创作参考素材来创建${target}。`,
      ...plainLanguageGuidance.user,
      "创作参考素材：",
      referenceSections.join("\n\n"),
      previousDirection?.trim()
        ? `待改进或替换的上一版方向：\n${compactStoryDirectionSource(previousDirection, 3_000)}\n在保留有用创作机制的同时，生成一个实质上不同的替代方案。`
        : "没有上一版方向。请生成一个有力的初版。",
      "包含以下板块：标题钩子、题材与设定、主角与压力、核心冲突、推进与反转计划、高潮与情感回报、结局、原创性约束。",
      "让每个板块都足够具体，能够立即开始起草。保持方向自洽，不要提及参考作品。",
    ].join("\n\n"),
  };
}

/** Build the complete, editable short-story seed shown before production starts. */
export function buildStorySeedPrompt(
  craftProfile: CraftProfile | undefined,
  kind: "long" | "short",
  language: "zh" | "en",
  previousDirection?: string,
): StoryDirectionPrompt {
  const plainLanguageGuidance = buildPlainLanguageGuidance(language);
  const base = craftProfile
    ? buildStoryDirectionPrompt(craftProfile, kind, language, previousDirection)
    : {
        system: [
          "你是一位短片故事开发编辑。",
          language === "zh" ? "用简体中文输出结果。" : "Output the result in English.",
          ...plainLanguageGuidance.system,
          "未选择创作参考素材。使用强有力的原创短片叙事原则：一个具体的主角、一个可见的压力、一个因果递进、一个有意义的反转和一个水到渠成的结局。",
        ].join("\n"),
        user: [
          "从零开始创建一个单章节短篇故事种子。",
          "Create a complete one-chapter short story seed.",
          ...plainLanguageGuidance.user,
          "未选择创作参考素材；请发明原创的前提、设定、角色、冲突和结局。",
          previousDirection?.trim()
            ? `待改进或替换的上一版种子：\n${compactStoryDirectionSource(previousDirection, 3_000)}`
            : "没有上一版种子。请生成一个有力的初版。",
        ].join("\n\n"),
      };
  const labels = STORY_SEED_SECTION_DEFINITIONS
    .map((definition) => language === "zh" ? definition.zh : definition.en)
    .join(", ");

  return {
    system: [
      base.system,
      "只返回下方要求的十个基础 Markdown 板块和一个原创化改编方案板块。",
      "Return only the ten required Markdown sections plus one originality transformation plan.",
      "不要输出 <think>、推理、分析、前言或 Markdown 代码围栏。Do not output <think>, reasoning, analysis, prefaces, or Markdown fences.",
      "每个板块必须包含具体的、最终的故事素材，可以直接编辑并交给写作器。",
    ].join("\n"),
    user: [
      base.user,
      language === "zh"
        ? `严格按以下顺序输出十一个二级 Markdown 标题：${labels}。每个标题下面写完整内容，不要合并、跳过或改名。`
        : `Output exactly these eleven level-two Markdown headings in this order: ${labels}. Write complete content under every heading; do not merge, skip, or rename them.`,
      language === "zh"
        ? "这是给短片创作使用的故事种子：大纲要能落到可拍摄的段落，角色要写清目标、弱点和关系，反转要能回收前文线索，结局要写清代价与情绪余味。"
        : "This seed is for a short film: make the outline shootable, give characters goals, vulnerabilities, and relationships, make reversals pay off earlier clues, and state the ending cost and emotional aftertaste.",
      language === "zh"
        ? "分段故事大纲只写故事里发生了什么——按时间顺序列出每个段落的情节推进：谁做了什么、遇到了什么问题、如何应对、结果怎样。不要写写作手法或创作技巧，例如'首句嗅觉锚定''不交代场景''信息释放节奏''视角策略'等。这些是参考素材里的创作机制，应内化为具体的情节，而不是作为指导说明出现在大纲里。"
        : "The beat outline must describe only WHAT HAPPENS in the story — list each beat in chronological order: who does what, what problem arises, how they respond, and what follows. Do not include writing techniques or craft instructions such as 'olfactory anchoring in the opening line', 'withhold the setting', 'information release rhythm', or 'POV strategy'. Those are reference mechanisms to internalize into concrete plot events, not instructions to state in the outline.",
      language === "zh"
        ? "原创化改编方案必须具体写出新的空间、身份、关系、因果链、关键事件和结局，并列出不得继承的专有名词、独特道具、对白和连续事件顺序。创作时不是给原故事换名词，而是重建关系和因果链。"
        : "The originality transformation plan must specify a new setting, identities, relationships, causal chain, key events, and ending, plus a do-not-carry list for proper nouns, signature objects, dialogue, and contiguous event order. Do not merely rename the source story; rebuild its relationships and causality.",
      "仅保留来自任何参考素材的可复用创作机制；创造新的身份、设定细节、因果链、场景和结局。不要复制 distinctive 的名字、对话、措辞或事件序列。",
    ].join("\n\n"),
  };
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
