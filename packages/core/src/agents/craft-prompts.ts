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
    ? mode === "bilibili-commentary"
      ? language === "en"
        ? [
            "This is a Bilibili film or television commentary reference. The creator narrated someone else's movie or show in their own style. Treat the commentary as a compressed plot retelling, and extract the causal chain, character pressure, reversals, reveals, and payoff timing that can be rebuilt as an original story.",
            "The profile must support making a similar-feeling original story from the commentary structure, while replacing the source film or series identities, setting, scenes, causal chain, and ending. The goal is to create your own original commentary-style story, not to retell the same movie.",
          ]
        : [
            "这是B站影视解说参考。UP主用自己的风格解说了一部电影或电视剧。把解说当作被压缩的剧情来分析：重点提取因果链、人物压力、反转、信息揭示节奏和情绪回报。",
            "目标是参考这个解说的叙事结构，创作一个剧情完全原创的解说故事。必须替换原影视作品的人物、场景、因果链、具体事件和结局——只迁移叙事节奏和结构手法。",
          ]
      : mode === "bilibili-review"
        ? language === "en"
          ? [
              "This is a Bilibili commentary/review/roast reference. The creator shares opinions, roasts, or hot takes on a trending topic. Extract the angle of approach, core argument, reasoning structure, roast techniques, emotional rhythm, and memorable phrasing that can be reused for an original piece.",
              "The profile must support creating an original commentary piece on a similar topic with a fresh perspective. Replace the specific topic, people, and events — only transfer the argumentation style, comedic timing, and rhetorical techniques.",
            ]
          : [
              "这是B站评论/调侃/吐槽类视频参考。UP主对某个热门话题发表观点、吐槽或调侃。重点提取以下可复用的手法：",
              "- 选题角度：UP主从什么切入点切入这个话题，怎么找到让人共鸣的吐槽点。",
              "- 核心观点：UP主想表达什么立场，怎么用通俗的话说清楚。",
              "- 论证结构：怎么一步步展开论述，先说什么后说什么。",
              "- 调侃手法：用什么修辞制造笑点（夸张、反讽、类比、金句）。",
              "- 情绪节奏：怎么控制观众情绪起伏，什么时候正经什么时候搞笑。",
              "- 金句模式：UP主怎么造出传播力强的短句。",
              "目标是参考这个视频的表达风格和论证结构，创作一个话题相近但观点和内容完全原创的评论/调侃作品。必须替换具体的话题、人物和事件——只迁移表达手法和节奏。",
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
        "你是在给朋友讲一个故事点子，用最短的话把剧情说清楚就行。",
      ],
      user: [
        "极简。全部板块加起来控制在 500 字左右。每个板块一两句话就够了，不要展开。",
        "说人话，不写术语。大纲只写'发生了什么→主角怎么应对→结果怎样'。",
      ],
    };
  }

  return {
    system: [
      "You are pitching a story idea to a friend in the shortest way possible.",
    ],
    user: [
      "Keep it minimal. All sections combined should be around 500 words. One or two sentences per section.",
      "Plain language, no jargon. The outline only tells what happens.",
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
    // Only inject rhythm/mechanism fields, NOT the original story's
    // logline/outline — those are the source story's actual content and
    // must not leak into the new story.
    referenceSections.push(
      [
        "视频节奏参考",
        [
          `节奏: ${video.pacingCurve}`,
          `钩子策略: ${video.hookStrategy}`,
          `高潮策略: ${video.climaxStrategy}`,
          `结尾余味: ${video.endingAftertaste}`,
          ...video.beats.map((beat) => `${Math.round(beat.position * 100)}% [${beat.kind}] ${beat.function}`),
          ...video.reversals.map((reversal) => `${Math.round(reversal.position * 100)}% 反转`),
          ...video.payoffs.map((payoff) => `${Math.round(payoff.position * 100)}% 收束`),
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
      "你是一位原创故事创作者。",
      languageRule,
      ...plainLanguageGuidance.system,
      "参考素材只提供创作机制和节奏灵感——比如'前半段慢后半段快''中段有一个大反转'这类规律。",
      "严禁照搬参考素材里的故事。你必须创造一个全新的故事：新的人物、新的空间、新的因果关系、新的核心事件。如果新故事和参考素材放在一起让人觉得'这不是同一个故事换了个皮吗'，那就是失败的。",
      "不要复用参考素材中的角色名、地名、道具名、标志性对白或连续的事件顺序。只借鉴'它为什么好看'的底层逻辑，不借鉴'它讲了什么'的具体内容。",
      "只返回可直接使用的故事方向简报，不要分析参考素材，也不要写前言。",
    ].join("\n"),
    user: [
      `参考以下创作机制，创作一个全新的、独立的${target}。`,
      ...plainLanguageGuidance.user,
      "创作参考（只借鉴规律，不照搬内容）：",
      referenceSections.join("\n\n"),
      previousDirection?.trim()
        ? `待改进或替换的上一版方向：\n${compactStoryDirectionSource(previousDirection, 3_000)}\n生成一个实质上不同的新方案。`
        : "没有上一版方向。请从零创作一个有力的原创故事。",
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
      language === "zh"
        ? "极简输出。全部板块正文加起来控制在 500 字左右。每个板块一两句话就行，概括核心即可，不要展开细节。"
        : "Be extremely concise. All section bodies combined should be around 500 words. One or two sentences per section — summarize the core, do not elaborate.",
    ].join("\n"),
    user: [
      base.user,
      language === "zh"
        ? `严格按以下顺序输出十一个二级 Markdown 标题：${labels}。每个标题下面写一两句话就行，不要展开。`
        : `Output exactly these eleven level-two Markdown headings in this order: ${labels}. One or two sentences under each heading.`,
      language === "zh"
        ? "这是给短片创作使用的故事种子：大纲按'发生了什么→主角怎么应对→结果怎样'概括剧情走向就行，不写写作手法。"
        : "This seed is for a short film: summarize the plot flow as what happens, how the protagonist responds, and the outcome. No writing techniques.",
      language === "zh"
        ? "记住：你是在创作一个全新的原创故事，不是在改编参考素材。参考素材只提供'为什么好看'的规律，绝不照搬它的人物、情节、对白或事件。如果读者看完觉得和参考作品太像，那就是失败的。"
        : "Remember: you are creating an original story, not adapting the reference material. Only borrow why it works, never copy its characters, plot, dialogue, or events. If the result feels like the same story with different names, it has failed.",
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
