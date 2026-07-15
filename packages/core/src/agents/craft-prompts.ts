import type { CraftMode, CraftProfile } from "../models/craft-profile.js";
import { STORY_SEED_SECTION_DEFINITIONS, REQUIRED_STORY_SEED_SECTION_DEFINITIONS, type StorySeed } from "../models/story-seed.js";
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
          "提取 8-14 个按时间排序的剧情节拍（beats），position 必须是 0-1 的相对位置，并在字幕有时间时填写 timeRange（格式为粗粒度区间如 \"0:00-0:41\"，取整到秒，不要小数）；尽量覆盖开场钩子、设定、诱发事件、压力、伏笔、反转、假胜利、高潮和结尾。",
          "每个 beat 必须填写 event、function、emotionalEffect 三个字段，全部用大白话：",
          "- event：这段时间里发生了什么事，一句话写清楚。",
          "- function：这段在故事里起什么作用。比如'让读者好奇''制造压力''为后面埋线索'。不要写'未说明'。",
          "- emotionalEffect：读者看到这段会有什么感受。比如'紧张''害怕''松一口气''惊讶'。不要写'未说明'。",
          "提取 2-5 个反转（reversals）；每个反转必须填写完整内容，不要留空：",
          "- trigger：什么事触发了这个反转。",
          "- apparentTruth：反转之前读者以为什么。",
          "- reveal：反转之后真相是什么。",
          "- reinterpretedClues：之前的哪些线索被重新解释了。",
          "- emotionalEffect：反转给读者什么感受。",
          "- setupBeatOrders：关联的前置 beat 序号数组。",
          "提取 3-8 个爽点或情绪释放点（payoffs），每个必须填写 setup（前面的铺垫）、release（怎么释放的）、costOrConsequence（代价或后果）、emotionalEffect（情绪效果）。",
          "videoStory 顶层还必须填写 logline（一句话故事）、audiencePromise（给观众的承诺）、outline（故事大纲）、pacingCurve（节奏怎么变化）、hookStrategy（怎么抓住观众）、climaxStrategy（高潮怎么爆发）、endingAftertaste（结尾留下什么感觉）。全部用大白话，不要留空。",
          "用百分比或时间位置保留原视频的节奏与情绪间距，但绝不保留原事件、人物、对白或表达。",
          "evidence 只能是 100 字以内的短标签或字幕证据，禁止复制对白、独特句子、专有名词和连续事件链。",
          "originalizationRules 必须要求重新设计人物、场景、因果链、超自然机制、场面细节和结尾；生成时只能迁移节拍功能与相对位置。",
        ]
    : [];

  const videoModeInstructions = sourceType === "bilibili"
    ? (mode === "bilibili-commentary" || mode === "bilibili-review")
      ? language === "en"
        ? [
            "This is a Bilibili film or television commentary reference. The creator narrated someone else's movie or show in their own style. Treat the commentary as a compressed plot retelling, and extract the causal chain, character pressure, reversals, reveals, and payoff timing that can be rebuilt as an original story.",
            "Create a completely new film or story first, then present it from a film-commentary viewpoint. The profile must support making a similar-feeling original story from the commentary structure, while replacing the source film or series identities, setting, scenes, causal chain, and ending. Do not retell the same movie.",
          ]
        : [
            "这是B站影视解说参考。UP主用自己的风格解说了一部电影或电视剧。把解说当作被压缩的剧情来分析：重点提取因果链、人物压力、反转、信息揭示节奏和情绪回报。",
            "目标是参考这个解说的叙事结构，先创作一部全新电影或故事，再用影视解说的角度讲述它。剧情必须完全原创，必须替换原影视作品的人物、场景、因果链、具体事件和结局——只迁移叙事节奏和结构手法。",
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
      "You are a writing analyst who helps readers understand storytelling techniques in plain language. Given excerpts from a novel or video transcript, extract the author's storytelling craft and explain it so anyone — even without a writing background — can understand and use it.",
      "",
      "## Language style (most important)",
      "Write in everyday English, like explaining to a friend. No academic jargon.",
      "Prefer concrete people and actions: 'The protagonist smells blood the moment she walks in' is far better than 'a sensory hook establishes atmospheric suspense'.",
      "Don't stack technical terms. If a word needs explaining, replace it with plain language.",
      "Good: 'Every time the hero solves one problem, a bigger one appears.'",
      "Bad: 'The conflict escalation mechanism exhibits a stepped pressure gradient.'",
      "Good: 'The reader learns who the killer is right away, then slowly discovers why.'",
      "Bad: 'Information disclosure employs a reverse-chronological suspense management strategy.'",
      "Keep each field to 1-3 sentences. Say what the author actually does, that's enough.",
      "",
      "## Output format",
      mode === "ghost-story"
        ? sourceType === "bilibili"
          ? "Output a single JSON object with these top-level sections: worldview, storyOutline, structure, sceneRhythm, informationDisclosure, narrativePerspective, ghostStory, videoStory, modules, and exemplars."
          : "Output a single JSON object with these top-level sections: worldview, storyOutline, structure, sceneRhythm, informationDisclosure, narrativePerspective, ghostStory, modules, and exemplars."
        : sourceType === "bilibili"
          ? "Output a single JSON object with these top-level sections: worldview, storyOutline, structure, sceneRhythm, informationDisclosure, narrativePerspective, videoStory, modules, and exemplars."
          : "Output a single JSON object with these top-level sections: worldview, storyOutline, structure, sceneRhythm, informationDisclosure, narrativePerspective, modules, and exemplars.",
      "Use these exact English top-level keys; do not translate the section names or wrap the object in another profile key.",
      "",
      "## Field descriptions",
      "`worldview`: the rules of this story's world. E.g. 'A modern city where ordinary people stumble into supernatural events.' Remove proper nouns.",
      "`storyOutline`: how the story flows from start to finish. Write as 'what happens at the start → how the protagonist responds → what trouble follows → how it ends.' Don't copy the original plot.",
      "The structure object must include openingPattern, chapterArc, and endingHookType.",
      "- openingPattern: how the author begins. E.g. 'Starts with one small odd detail that makes you curious.'",
      "- chapterArc: how a chapter progresses. E.g. 'Each chapter resolves one small problem but introduces a bigger one.'",
      "- endingHookType: how chapters end. E.g. 'Every chapter ends on a mystery that pulls you into the next.'",
      "The sceneRhythm object must include sceneTransitionTechnique, pacingCurve, and conflictEscalation.",
      "- sceneTransitionTechnique: how scenes switch. E.g. 'Jumps straight from a conversation to the next morning.'",
      "- pacingCurve: how tempo shifts. E.g. 'Slow build at the start, accelerates in the middle, explodes at the end.'",
      "- conflictEscalation: how trouble grows. E.g. 'The hero escapes one danger only to fall into a bigger one.'",
      "The informationDisclosure object must include foreshadowingDensity, informationReleaseRhythm, and suspenseManagement.",
      "- foreshadowingDensity: how many hints are planted. E.g. 'Small details in early chapters all become key clues later.'",
      "- informationReleaseRhythm: how secrets are revealed. E.g. 'Key truths leak out bit by bit, holding the biggest reveal for last.'",
      "- suspenseManagement: how tension is sustained. E.g. 'Keeps two or three mysteries open at once; solving one always opens another.'",
      "The narrativePerspective object must include povStrategy, narrationDialogueRatio, and narrativeDistance.",
      "- povStrategy: whose eyes we see through. E.g. 'Stays with the protagonist; the reader only knows what they know.'",
      "- narrationDialogueRatio: narration vs. dialogue balance. E.g. 'Heavy on dialogue, light on description — fast pace.'",
      "- narrativeDistance: how close we are to the character. E.g. 'Written right inside the protagonist's head.'",
      "",
      "Every required field must be concrete and evidence-based. Do not output placeholders like \"Not specified\", \"Unknown\", or \"N/A\".",
      "If a pattern is implicit, infer the dominant technique from repeated evidence and write it plainly.",
      "",
      "## Module cards",
      "The `modules` array should contain 6-10 cards. Each card must have `category`, `label`, `summary`, and optional `evidence`.",
      "Use categories such as opening, chapterFlow, sceneRhythm, disclosure, suspense, perspective, emotion, turningPoint, and other.",
      "label must be a plain-language title, max 5 words. E.g. 'Grabs you from the first line' or 'Every escape plants a new trap'. Do NOT write academic labels.",
      "summary explains what the technique is and how to use it, in 1-2 plain sentences.",
      "",
      "## Exemplars",
      "Each section may provide an optional `exemplar` field with a verbatim 300-500 character excerpt from the input.",
      "Additionally, provide an `exemplars` array of 4-6 representative excerpts, each with a label, tone, and verbatim text.",
      "- Excerpts MUST be verbatim copies from the input text; do not paraphrase, abbreviate, or concatenate non-adjacent passages.",
      "- Each excerpt should be 300-500 characters.",
      "- Choose excerpts that best represent the author's technique across different tones.",
      "",
      "Output ONLY the JSON object, with no markdown fences and no commentary.",
      ...worldviewStoryInstructions,
      ...ghostStoryInstructions,
      ...videoInstructions,
      ...videoModeInstructions,
    ].join("\n");
  }

  return [
    "你是一位帮读者看懂写作技巧的分析师。给定一部小说或视频字幕的节选，你的任务是提取作者讲故事的好手法，用大白话写出来，让没有写作基础的读者也能看懂、能用。",
    "",
    "## 语言风格要求（最重要）",
    "用日常中文写，像给朋友讲故事一样。不要用论文腔、学术腔。",
    "优先写具体的人和事：'主角一进门就闻到血腥味'比'感官钩子建立悬疑氛围'好一百倍。",
    "不要堆砌术语。如果一个词需要解释才能懂，就换成大白话直接写。",
    "好的写法：'每解决一个问题，新的麻烦就更大了'。",
    "差的写法：'冲突升级机制呈现阶梯式压力递增'。",
    "好的写法：'先告诉读者凶手是谁，再慢慢揭开他为什么杀人'。",
    "差的写法：'信息披露采用倒叙式悬念管理策略'。",
    "好的写法：'故事一直跟着主角的眼睛看，读者只知道主角知道的事'。",
    "差的写法：'限制性第三人称内聚焦叙事视角'。",
    "每个字段控制在 1-3 句话，说清楚'作者在这里到底怎么做的'就够了。",
    "",
    "## 输出格式",
    mode === "ghost-story"
      ? "输出一个 JSON 对象，必须包含 worldview、storyOutline、structure、sceneRhythm、informationDisclosure、narrativePerspective、ghostStory、modules、exemplars；不能省略任何 section。"
      : sourceType === "bilibili"
        ? "输出一个 JSON 对象，必须包含 worldview、storyOutline、structure、sceneRhythm、informationDisclosure、narrativePerspective、videoStory、modules、exemplars；不能省略任何 section。"
        : "输出一个 JSON 对象，必须包含 worldview、storyOutline、structure、sceneRhythm、informationDisclosure、narrativePerspective、modules、exemplars；不能省略任何 section。",
    "顶层键必须严格使用这些英文名称，不要把 section 名称翻译成中文，也不要再套一层写作模式或 profile 对象。",
    "",
    "## 各字段写法说明",
    "worldview：这个故事世界的规则是什么。比如'现代都市，普通人会遇到超自然事件'。不要写专有名词。",
    "storyOutline：故事从头到尾怎么走。按'开头发生了什么→主角怎么办→遇到什么麻烦→最后怎样'来写。不要复制原作情节。",
    "structure 对象包含：",
    "- openingPattern：作者怎么开头。比如'用一件反常的小事切入，让人好奇'。",
    "- chapterArc：一章里故事怎么推进。比如'一章解决一个小问题，但带出更大的麻烦'。",
    "- endingHookType：章末怎么吊人。比如'每章结尾留个谜团，让人想看下一章'。",
    "sceneRhythm 对象包含：",
    "- sceneTransitionTechnique：场景怎么切换。比如'上一秒还在对话，下一秒直接跳到第二天'。",
    "- pacingCurve：节奏快慢怎么变化。比如'开头慢热铺垫，中段加速，结尾爆发'。",
    "- conflictEscalation：麻烦怎么升级。比如'主角刚逃出一个危险，马上掉进更大的危险'。",
    "informationDisclosure 对象包含：",
    "- foreshadowingDensity：埋了多少伏笔。比如'前几章随口提到的细节，后面全变成关键线索'。",
    "- informationReleaseRhythm：信息怎么释放。比如'关键真相一点一点透露，不到最后不揭底牌'。",
    "- suspenseManagement：悬念怎么吊。比如'同时开着两三个谜团，解开一个又冒出一个新的'。",
    "narrativePerspective 对象包含：",
    "- povStrategy：用谁的视角讲故事。比如'一直跟着主角，读者只知道主角知道的事'。",
    "- narrationDialogueRatio：叙述和对话的比例。比如'对话多、描写少，节奏很快'。",
    "- narrativeDistance：叙事离角色多近。比如'贴着主角写，能感受到他心里在想什么'。",
    "",
    "每个字段都必须是具体、基于原文的描述。不要输出'未明确说明''未知''N/A'这类占位词。",
    "如果原文没有直接点明某个手法，就根据重复出现的写法推断出来，用大白话写清楚。",
    "",
    "## modules 写作要点卡片",
    "`modules` 数组要包含 6-10 个卡片。每个卡片都必须包含 `category`、`label`、`summary`，可选 `evidence`。",
    "category 可以使用 opening、chapterFlow、sceneRhythm、disclosure、suspense、perspective、emotion、turningPoint、other。",
    "label 必须是大白话标题，8 字以内，比如'一开场就抓住人''每次化险为夷都埋新雷'，不要写'感官权威式开场''经济理性囚禁'这种术语。",
    "summary 写清楚这个手法具体怎么做，1-2 句大白话，让读者看完就明白怎么用。",
    "",
    "## 范例片段",
    "每个 section 可以附带可选的 `exemplar` 字段，内容是从输入文本中逐字摘取的 300-500 字片段。",
    "再提供一个 `exemplars` 数组，包含 4-6 个代表性片段，每个片段要有 label、tone 和逐字文本。",
    "范例片段规则：",
    "- 必须是输入文本的逐字副本，不得改写、缩写，也不得拼接不相邻的段落。",
    "- 每个片段长度控制在 300-500 字。",
    "- 选择最能代表作者手法的片段，覆盖紧张、舒缓、高潮等不同基调。",
    "",
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
  const hasApprovedStorySeed = Boolean(craftProfile.storySeed);

  const lines = [
    "## 写作手法指南",
    "",
    "以下是从参考作品中提取的写作拆文信息。请在创作中模仿这些手法，而不是只模仿表层措辞：",
    "",
    moduleSection,
    ...(!hasApprovedStorySeed && craftProfile.worldview?.trim()
      ? ["", "参考世界观（仅借鉴规则与机制）", craftProfile.worldview.trim()]
      : []),
    ...(!hasApprovedStorySeed && craftProfile.storyOutline?.trim()
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
    if (hasApprovedStorySeed) {
      lines.push(
        "",
        "## 视频节奏迁移指南",
        "原创故事设定已经确认。仅迁移参考视频的节拍功能、相对位置、升级间距和收束时机；不得引入参考视频的具体人物、事件、地点、反转真相、线索或因果链。",
        `- 观众承诺：${v.audiencePromise}`,
        `- 节奏曲线：${v.pacingCurve}`,
        `- 钩子策略：${v.hookStrategy}`,
        `- 高潮策略：${v.climaxStrategy}`,
        `- 结尾余味：${v.endingAftertaste}`,
        "### 节拍功能（只迁移位置与功能）",
        ...v.beats.map((beat) => `- ${Math.round(beat.position * 100)}% [${beat.kind}] 功能：${beat.function}；情绪：${beat.emotionalEffect}`),
        "### 反转与收束节奏（不迁移具体真相或线索）",
        ...v.reversals.map((reversal) => `- ${Math.round(reversal.position * 100)}%：前置节拍 ${reversal.setupBeatOrders.join(", ")}；情绪：${reversal.emotionalEffect}`),
        ...v.payoffs.map((payoff) => `- ${Math.round(payoff.position * 100)}%：情绪释放：${payoff.emotionalEffect}`),
        "### 原创化规则",
        ...v.originalizationRules.map((rule) => `- ${rule}`),
      );
    } else {
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
  }
  if (craftProfile.storySeed) {
    lines.push(
      "",
      "## 已确认的原创故事设定（建书时必须遵守）",
      "以下是用户已经确认的本书原创故事空间。参考素材只提供题材、现实感、节奏和叙事方法；不得为了重新创作而替换这份设定中的人物、因果链、规则或结局代价。",
      ...STORY_SEED_SECTION_DEFINITIONS.flatMap((definition) => {
        const value = craftProfile.storySeed?.[definition.key]?.trim();
        return value ? [`### ${definition.zh}`, value] : [];
      }),
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
  const hasApprovedStorySeed = Boolean(craftProfile.storySeed);
  const lines = [
    "## 短篇原创化写作契约",
    "",
    hasApprovedStorySeed
      ? "写作模式只提供可迁移的叙事功能和节奏。下方已确认的原创故事设定是本次短篇的唯一故事空间；用节拍功能丰富它，不得替换其人物、规则、因果链、反转或结局。"
      : "写作模式只提供可迁移的叙事功能和节奏，不提供可复述的原故事。先按改编方案重建故事，再按节拍功能组织新事件。",
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

  if (craftProfile.storySeed) {
    lines.push(
      "",
      "### 已确认的原创故事设定（短篇必须遵守）",
      "以下是用户已经确认的本次原创故事。它不是参考素材，必须保留其题材与基调、现实或超自然边界、人物关系、核心因果链、关键反转和结局代价；只能用前面的写作机制丰富表达，不能另起一套故事。",
      ...STORY_SEED_SECTION_DEFINITIONS.flatMap((definition) => {
        const value = craftProfile.storySeed?.[definition.key]?.trim();
        return value ? [`- ${definition.zh}: ${value}`] : [];
      }),
    );
  }

  lines.push(
    "",
    "### 硬性原创要求",
    "- 原始 worldview、故事大纲、视频 logline、具体事件、反转揭示、收束事件和范例原文不是创作素材，不得复述或改写。",
    hasApprovedStorySeed
      ? "- 已确认的原创故事设定是唯一的故事空间；不得用参考素材或新的默认设定替换其人物、规则、因果链、关键反转或结局代价。"
      : "- 新故事至少重建故事空间、职业/身份、关系结构、核心因果链、关键道具/规则、场景事件和结局代价。",
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
        "你在给朋友讲一个故事点子。像聊天一样自然，让人一听就想知道接下来怎样。",
      ],
      user: [
        "说人话，像讲故事一样写，不要写分析报告。大纲按时间顺序讲清楚：开头怎样→中间发生了什么→结局如何。",
        "故事名称要吸引人但不要标题党。世界观两三句话就够了，让人一看就懂这个世界是什么规则。",
        "大纲是重点——用大白话把整个故事从头到尾讲一遍，像跟朋友复述一部电影。不要写术语，不要分析手法。",
      ],
    };
  }

  return {
    system: [
      "You are telling a friend a story idea. Sound natural, like a conversation — make them want to know what happens next.",
    ],
    user: [
      "Plain language, like telling a story. The outline goes chronologically: how it starts → what happens → how it ends.",
      "The title should be catchy but not clickbait. The worldview is 2-3 sentences that make the world's rules instantly clear.",
      "The outline is the core — retell the whole story in plain words, like describing a movie to a friend. No jargon, no craft analysis.",
    ],
  };
}

export type CraftRealityLevel = "realistic" | "supernatural" | "science-fiction";

const SCIENCE_FICTION_CUES = [
  "科幻", "未来世界", "未来科技", "人工智能", "机器人", "赛博朋克", "外星人", "外星", "太空", "星际",
  "时间旅行", "穿越时空", "平行宇宙", "量子", "克隆", "基因改造",
  "science fiction", "sci-fi", "future world", "future technology", "artificial intelligence", "cyberpunk",
  "outer space", "spacecraft", "spaceship", "alien invasion", "interstellar", "time travel", "parallel universe",
  "quantum computing", "human cloning", "genetic modification",
];

const SUPERNATURAL_CUES = [
  "鬼故事", "鬼魂", "冤魂", "亡魂", "灵魂", "附身", "诅咒", "法术", "超自然", "灵异", "怪谈", "阴间",
  "复活法术", "鬼笔", "借活人的手", "轮回", "前世",
  "ghost story", "ghost", "spirit", "possession", "curse", "spell", "supernatural", "paranormal",
  "haunted", "afterlife", "reincarnation", "past life",
];

function craftProfileSourceText(craftProfile: CraftProfile): string {
  return [
    craftProfile.worldview,
    craftProfile.storyOutline,
    craftProfile.videoStory?.logline,
    craftProfile.videoStory?.audiencePromise,
    craftProfile.videoStory?.outline,
    craftProfile.ghostStory?.fearCore,
    craftProfile.ghostStory?.supernaturalRules,
  ].filter((value): value is string => Boolean(value?.trim())).join("\n");
}

/** Infer the source's reality level so generation cannot silently raise its world scale. */
export function inferCraftRealityLevel(craftProfile: CraftProfile): CraftRealityLevel {
  if (craftProfile.mode === "ghost-story" || craftProfile.ghostStory) return "supernatural";
  const source = craftProfileSourceText(craftProfile).toLowerCase();
  if (SCIENCE_FICTION_CUES.some((cue) => source.includes(cue))) return "science-fiction";
  if (SUPERNATURAL_CUES.some((cue) => source.includes(cue))) return "supernatural";
  return "realistic";
}

function buildRealityLevelGuidance(
  realityLevel: CraftRealityLevel,
  language: "zh" | "en",
): string[] {
  if (language === "zh") {
    if (realityLevel === "realistic") {
      return [
        "- 现实层级锁：这份参考模式按现实题材处理。新故事的恐怖和悬疑必须能落到人物行为、犯罪、失踪、物证、监控、职业风险、家庭关系或真实的身体/环境问题上。",
        "- 现实模式禁止新增鬼魂、附身、诅咒、法术、轮回、前世、时间循环、平行世界、未来科技、人工智能、赛博朋克、外星或其他大型世界规则；不能用一个新设定替代原来的现实压力。",
        "- 可以更换人物、地点和事件，但要留在同一类当代生活领域和问题类型中；不要从普通城市故事跳到跨时代旧案、秘密组织、宏大阴谋或无法验证的超自然真相。",
        "- 如果结尾需要恐怖感，优先使用证据缺口、人的选择、现实后果和无法确认的细节，不要突然宣布“其实是鬼”或建立一套新法则。",
      ];
    }
    if (realityLevel === "supernatural") {
      return [
        "- 超自然层级锁：参考素材明确包含超自然。只继承参考中已经出现的恐怖机制和规则数量，不要额外扩展成时间、宇宙、科技或跨时代体系。",
        "- 新故事可以换人物、地点和事件，但必须让超自然规则服务于原来的恐惧核心、线索方式和情绪余味；不能为了反转不断增加新规则。",
      ];
    }
    return [
      "- 科幻层级锁：参考素材明确包含科幻元素。保留其技术前提和尺度，不要无依据添加新的宇宙、时间或科技体系。",
    ];
  }

  if (realityLevel === "realistic") {
    return [
      "- Reality-level lock: treat this reference as realistic. The new suspense or horror must be grounded in human behavior, crime, disappearance, physical evidence, surveillance, occupational risk, family pressure, or plausible bodily/environmental danger.",
      "- In realistic mode, do not add ghosts, possession, curses, spells, reincarnation, past lives, time loops, parallel worlds, future technology, AI, cyberpunk, aliens, or any new large-scale world system.",
      "- Settings and events may change, but stay in the same kind of contemporary life domain and problem; do not jump from an ordinary urban story to a cross-era case, secret organization, grand conspiracy, or unverifiable supernatural truth.",
      "- For a frightening ending, prefer missing evidence, human choices, real consequences, and an unresolved detail. Do not suddenly reveal that it was a ghost or establish a new rule system.",
    ];
  }
  if (realityLevel === "supernatural") {
    return [
      "- Supernatural-level lock: the reference explicitly contains supernatural horror. Inherit only its existing fear mechanisms and rule scale; do not expand it into a new time, cosmic, technological, or cross-era system.",
      "- Change people, places, and events while serving the same fear core, clue method, and emotional aftertaste. Do not add new rules merely for another twist.",
    ];
  }
  return [
    "- Science-fiction-level lock: the reference explicitly contains science fiction. Preserve its technical premise and scale without inventing unrelated cosmic, temporal, or technological systems.",
  ];
}

/** Find hard reality-level violations before a seed is persisted. */
export function detectStorySeedRealityDrift(
  craftProfile: CraftProfile,
  storySeed: StorySeed,
): readonly string[] {
  if (inferCraftRealityLevel(craftProfile) !== "realistic") return [];
  const text = Object.values(storySeed)
    .filter((value): value is string => typeof value === "string")
    .join("\n");
  const violations: string[] = [];
  if (/鬼魂|冤魂|亡魂|灵魂|附身|诅咒|法术|超自然|灵异|鬼笔|借活人的手|轮回|前世|ghost|spirit|possession|curse|spell|supernatural|paranormal|haunted|afterlife|reincarnation|past life/iu.test(text)) {
    violations.push("unsupported supernatural mechanism");
  }
  if (/人工智能|机器人|赛博朋克|外星|太空|时间旅行|时间循环|穿越时空|平行宇宙|量子|克隆|基因改造|未来科技|artificial intelligence|cyberpunk|alien invasion|outer space|spacecraft|spaceship|time travel|time loop|parallel universe|quantum computing|human cloning|genetic modification|future technology/iu.test(text)) {
    violations.push("unsupported science-fiction mechanism");
  }
  return violations;
}

function buildStoryFoundationCraftContext(
  craftProfile: CraftProfile,
  language: "zh" | "en",
): string[] {
  const isZh = language === "zh";
  const mode = craftProfile.mode ?? "general";
  const realityLevel = inferCraftRealityLevel(craftProfile);
  const lines = isZh
    ? [
        "### 写作模式继承（高优先级）",
        `- 当前模式：${mode}`,
        "- 题材、时代、现实层级和情绪承诺，以参考世界观与故事大纲明确呈现的内容为准；创作新故事不等于改变题材。",
        "- 如果参考素材是现实都市里的悬疑、惊悚或恐怖故事，必须继续落在现实可发生的范围内，用人物动机、犯罪、关系、环境、身体和信息差制造压力。",
        "- 参考素材没有明确依据时，禁止主动加入科幻、未来科技、人工智能、赛博朋克、太空、外星、时间旅行、实验室等设定，也不要用科技解释恐怖。",
        "- 只有参考素材明确存在超自然或科幻元素时，才可以保留对应元素；不得因为“世界观”这个词就擅自扩展设定。",
      ]
    : [
        "### Craft-mode inheritance (high priority)",
        `- Current mode: ${mode}`,
        "- Preserve the genre, era, reality level, and emotional promise explicitly shown by the reference worldview and outline; creating a new story does not mean changing its genre.",
        "- If the reference is a realistic urban suspense, thriller, or horror story, stay within recognizable reality and create pressure through motives, crime, relationships, environment, the body, and missing information.",
        "- Unless the reference explicitly supports them, do not introduce science fiction, future technology, AI, cyberpunk, space, aliens, time travel, laboratories, or technological explanations for the horror.",
        "- Keep supernatural or science-fiction elements only when the reference clearly contains them; the word 'worldview' is not permission to invent a larger setting.",
      ];

  lines.push(...buildRealityLevelGuidance(realityLevel, language));

  if (mode === "ghost-story" && craftProfile.ghostStory) {
    const h = craftProfile.ghostStory;
    lines.push(
      ...(isZh
        ? [
            "- 这是恐怖鬼故事模式：保留恐怖核心、超自然规则、禁忌、线索和升级方式；可以换人物与地点，但不能改成科幻悬疑或普通冒险。",
            `- 恐怖核心：${compactStoryDirectionSource(h.fearCore, 600)}`,
            `- 规则与触发：${compactStoryDirectionSource(h.supernaturalRules, 600)}`,
            `- 恐怖升级：${compactStoryDirectionSource(h.escalationLadder, 600)}`,
            `- 结尾余味：${compactStoryDirectionSource(h.endingAftertaste, 600)}`,
          ]
        : [
            "- This is a horror ghost-story mode: preserve the fear core, supernatural rules, taboos, clues, and escalation; change people and places without turning it into science-fiction suspense or an adventure.",
            `- Fear core: ${compactStoryDirectionSource(h.fearCore, 600)}`,
            `- Rules and triggers: ${compactStoryDirectionSource(h.supernaturalRules, 600)}`,
            `- Escalation: ${compactStoryDirectionSource(h.escalationLadder, 600)}`,
            `- Ending aftertaste: ${compactStoryDirectionSource(h.endingAftertaste, 600)}`,
          ]),
    );
  }

  if (craftProfile.videoStory) {
    const v = craftProfile.videoStory;
    lines.push(
      ...(isZh
        ? [
            "- 视频模式只迁移叙事节拍和观众承诺，不迁移原视频的具体事件、人物、地点或因果链。",
            `- 观众承诺：${compactStoryDirectionSource(v.audiencePromise, 800)}`,
            `- 节奏曲线：${compactStoryDirectionSource(v.pacingCurve, 600)}`,
            `- 开场钩子：${compactStoryDirectionSource(v.hookStrategy, 600)}`,
            `- 高潮功能：${compactStoryDirectionSource(v.climaxStrategy, 600)}`,
            `- 结尾余味：${compactStoryDirectionSource(v.endingAftertaste, 600)}`,
          ]
        : [
            "- For video modes, transfer only beat functions and the audience promise, never the source video's concrete events, people, places, or causal chain.",
            `- Audience promise: ${compactStoryDirectionSource(v.audiencePromise, 800)}`,
            `- Pacing curve: ${compactStoryDirectionSource(v.pacingCurve, 600)}`,
            `- Opening hook: ${compactStoryDirectionSource(v.hookStrategy, 600)}`,
            `- Climax function: ${compactStoryDirectionSource(v.climaxStrategy, 600)}`,
            `- Ending aftertaste: ${compactStoryDirectionSource(v.endingAftertaste, 600)}`,
          ]),
    );
  }

  return lines;
}

/** Build a generation prompt that transfers craft mechanics into a new story direction. */
export function buildStoryDirectionPrompt(
  craftProfile: CraftProfile,
  kind: "long" | "short",
  language: "zh" | "en",
  previousDirection?: string,
): StoryDirectionPrompt {
  const referenceSections: string[] = [];
  if (craftProfile.worldview?.trim()) {
    referenceSections.push(`参考世界观：\n${compactStoryDirectionSource(craftProfile.worldview)}`);
  }
  if (craftProfile.storyOutline?.trim()) {
    referenceSections.push(`参考故事大纲：\n${compactStoryDirectionSource(craftProfile.storyOutline)}`);
  }

  const target = kind === "short" ? "一篇单章节短篇故事" : "一部十章长篇故事";
  const languageRule = language === "zh"
    ? "用简体中文输出结果。"
    : "Output the result in English.";
  const plainLanguageGuidance = buildPlainLanguageGuidance(language);

  const craftContext = buildStoryFoundationCraftContext(craftProfile, language);

  return {
    system: [
      "你是一位故事创作者。",
      languageRule,
      ...plainLanguageGuidance.system,
      language === "zh"
        ? `参考素材提供了世界观、故事骨架和写作模式。你要写一个同框架但细节不同的新故事：保留题材、时代、现实感、情绪承诺、悬念或恐怖强度和叙事功能，不是简单替换名字或地点，而是重新设计人物、空间、道具、因果链与结局代价。${craftProfile.mode === "bilibili-commentary" ? "这是影视解说型原创电影故事：先创作一部全新电影或故事，再用影视解说的角度讲述它，不要把原电影重新解说一遍。" : ""}`
        : `The reference provides a worldview, story skeleton, and craft mode. Write a new story with the same framework: preserve its genre, era, reality level, emotional promise, suspense or horror intensity, and narrative functions, while rebuilding the people, setting, props, causal chain, and ending cost.${craftProfile.mode === "bilibili-commentary" ? " Create a completely new film or story first, then tell it from a film-commentary viewpoint; do not retell the source movie." : ""}`,
      language === "zh"
        ? "换的是人物、空间和事件，不是题材和现实层级；没有参考依据时，不得把现实悬疑/恐怖升级成科幻。"
        : "Change the people, setting, and events — not the genre or reality level. Without evidence in the reference, never upgrade realistic suspense or horror into science fiction.",
    ].join("\n"),
    user: [
      `基于以下素材，创作${target}。`,
      ...plainLanguageGuidance.user,
      ...craftContext,
      ...(referenceSections.length > 0
        ? ["参考素材：", referenceSections.join("\n\n")]
        : []),
      previousDirection?.trim()
        ? `上一版（请生成一个不同的新方案）：\n${compactStoryDirectionSource(previousDirection, 3_000)}`
        : "",
    ].filter(Boolean).join("\n\n"),
  };
}

/** Build the background quality-check prompt for generated story foundations. */
export function buildStorySeedQualitySystemPrompt(
  craftProfile: CraftProfile | undefined,
  language: "zh" | "en",
): string {
  const reference = craftProfile
    ? [
        `参考模式：${craftProfile.mode ?? "general"}`,
        craftProfile.worldview?.trim() ? `参考世界观：${compactStoryDirectionSource(craftProfile.worldview, 1_200)}` : "",
        craftProfile.storyOutline?.trim() ? `参考故事大纲：${compactStoryDirectionSource(craftProfile.storyOutline, 1_200)}` : "",
        craftProfile.videoStory?.audiencePromise?.trim()
          ? `参考视频的观众承诺：${compactStoryDirectionSource(craftProfile.videoStory.audiencePromise, 800)}`
          : "",
      ].filter(Boolean).join("\n")
    : "";
  if (language === "zh") {
    return [
      "你是一个故事编辑，负责评估故事设定是否忠实继承了参考写作模式。",
      `参考现实层级：${craftProfile ? inferCraftRealityLevel(craftProfile) : "unknown"}`,
      reference ? `先以这份参考模式为准：\n${reference}` : "没有参考模式时，只检查故事自身是否完整。",
      "从以下几个维度打分（0-100 分），然后给出总分：",
      "- 题材与现实感一致性：是否保持参考素材的悬疑、惊悚、恐怖或其他明确类型；现实题材是否仍然贴近现实。没有依据时出现科幻、未来科技、AI、赛博朋克、太空、外星、时间旅行、实验室或科技解释恐怖，必须大幅扣分。",
      "- 钩子吸引力：开场能不能抓住人。",
      "- 冲突张力：主角面临的困境够不够紧迫、够不够有戏剧性。",
      "- 意外感：故事走向有没有让人意想不到的转折。",
      "- 情感共鸣：读者能不能代入主角、能不能被打动。",
      "- 完整性：故事从头到尾逻辑通不通、有没有明显漏洞。",
      "现实题材如果出现未经参考支持的超自然或大型新世界规则，总分不得高于 59 分；总分低于 70 分的故事设定需要重新生成。",
      "输出格式：第一行写总分数字（0-100），第二行起写一句简短评价（不超过 50 字）。",
      "只输出数字和评价，不要其他内容。",
    ].join("\n");
  }
  return [
    "You are a story editor evaluating whether a story foundation faithfully inherits its reference craft mode.",
    `Reference reality level: ${craftProfile ? inferCraftRealityLevel(craftProfile) : "unknown"}`,
    reference ? `Use this reference mode as the authority:\n${reference}` : "With no reference mode, check only whether the story is complete.",
    "Score 0-100 based on genre and reality-level fidelity, hook strength, conflict tension, surprise, emotional resonance, and completeness.",
    "For a realistic reference, heavily penalize unsupported science fiction, future technology, AI, cyberpunk, space, aliens, time travel, laboratories, or technological explanations for horror.",
    "For a realistic reference, unsupported supernatural or large new world systems cap the score at 59. Below 70 means it should be regenerated.",
    "Output format: first line is the numeric score (0-100), second line is a brief comment (max 50 words). Output only the score and comment.",
  ].join("\n");
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
          "你是一位故事创作者。",
          language === "zh" ? "用简体中文输出结果。" : "Output the result in English.",
          ...plainLanguageGuidance.system,
          language === "zh"
            ? "没有参考素材。从零创作一个有吸引力的原创短篇故事。"
            : "No reference material. Create an original, compelling short story from scratch.",
        ].join("\n"),
        user: [
          language === "zh"
            ? "从零创建一个单章节短篇故事种子。"
            : "Create a complete one-chapter short story seed.",
          ...plainLanguageGuidance.user,
          previousDirection?.trim()
            ? `上一版（请生成一个不同的新方案）：\n${compactStoryDirectionSource(previousDirection, 3_000)}`
            : "",
        ].filter(Boolean).join("\n\n"),
      };
  const labels = STORY_SEED_SECTION_DEFINITIONS
    .map((definition) => language === "zh" ? definition.zh : definition.en).join(", ");

  return {
    system: [
      base.system,
      language === "zh"
        ? "只返回下方要求的 Markdown 板块，不要输出前言、分析或代码围栏。"
        : "Return only the Markdown sections listed below — no prefaces, analysis, or code fences.",
      "Do not output <think>, reasoning, or analysis.",
      language === "zh"
        ? "这是一份会被后续大纲、正文、审稿和包装反复引用的创作契约，不是三段式梗概。每一板块都必须具体、互相一致：人物有明确欲望和代价，冲突有现实可执行的因果，反转必须由前文线索支撑，结局必须兑现开篇承诺。总长约 900-1400 字。"
        : "This is a creation contract reused by outline, drafting, review, and packaging — not a three-field synopsis. Make every section specific and consistent: characters need desire and cost, conflict needs executable causality, reversals need setup, and the ending must pay off the opening. Aim for 900-1400 words.",
    ].join("\n"),
    user: [
      base.user,
      language === "zh"
        ? `按以下顺序输出二级 Markdown 标题：${labels}。`
        : `Output these level-two Markdown headings in this order: ${labels}.`,
      language === "zh"
        ? [
            "填写要求：类型与基调要锁定现实感和情绪承诺；钩子要写第一屏发生的异常或危机；角色与关系要写主角目标、阻力和相互牵制；冲突要写失败的具体代价。",
            "分段故事大纲按开场→施压→反扑→反转→结局讲清场面与因果；关键反转与线索回收逐条说明“前面埋了什么、此处如何兑现”；结局写最终选择与余味。",
            "原创化改编方案必须明确替换故事空间、身份/职业、关系结构、核心因果链、关键道具或规则、关键场面和结局代价。不得只换名字、地点或措辞。",
          ].join("\n")
        : [
            "Fill each section precisely: genre and tone lock the reality level and emotional promise; hook states the first-screen anomaly or crisis; characters and relationships state the protagonist's goal, resistance, and leverage; conflict states the concrete cost of failure.",
            "Tell the beat outline through opening → pressure → counterattack → reversal → ending with scenes and causality; for each reversal, state the earlier setup and its payoff; state the final choice and aftertaste.",
            "The originality plan must explicitly replace the setting, identity/profession, relationship structure, causal chain, key prop or rule, key scenes, and ending cost. Never merely rename people or places.",
          ].join("\n"),
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
