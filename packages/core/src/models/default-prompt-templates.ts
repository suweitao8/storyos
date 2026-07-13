/**
 * Global default prompt templates for story asset generation.
 *
 * Each genre may override any of these via its `promptTemplates` frontmatter.
 * When a genre-level template is empty, {@link resolveImagePromptTemplate} /
 * {@link resolveVoicePromptTemplate} fall back to the values defined here.
 *
 * The image prompts are LLM *system* prompts: they instruct the model to
 * produce a compact, standalone visual description from character / scene /
 * prop metadata. The voice prompts are ready-to-use acoustic descriptions
 * keyed by age-group × gender; they are consumed directly (or used as the LLM
 * guidance when generating a per-character voice prompt).
 */
import type { ImagePromptKind, PromptTemplates, VoiceAgeGroup } from "./genre-profile.js";
import { IMAGE_PROMPT_KINDS, VOICE_AGE_GROUP_KEYS } from "./genre-profile.js";

// ---------------------------------------------------------------------------
// Image prompt templates
// ---------------------------------------------------------------------------

export const DEFAULT_IMAGE_CHARACTER_PROMPT = `你是一个专业的AI图像提示词专家，专门为文生图模型生成角色的高质量提示词。

你的任务是根据用户提供的角色档案信息，生成一段详细的、适合文生图的角色图片提示词。

## 输出格式（严格）
一段中文提示词，描述角色的完整视觉形象，格式如下：
[角色年龄体型]，[面部特征]，[发型发色]，[服装描述]，[姿态表情]，[辨识标志]。

## 各字段规范
1. 角色年龄体型：如"二十五岁偏瘦青年"、"三十岁左右中等身材女性"
2. 面部特征：必须包含东亚人面孔特征（深棕色瞳孔、黑发），加上角色特有的面部特征
3. 发型发色：必须明确发型和颜色
4. 服装描述（核心，禁止笼统）：必须具体到款式 + 主色 + 辅色 + 配饰，拆成上衣/外套、下装、鞋子、头部遮挡物（帽子/口罩/头盔/面罩）、手部饰品、颈部饰品、身体纹样/符文等细项。禁止只写"休闲装""职业装"这种笼统词。信息不足时根据角色身份合理推断具体穿着。
5. 姿态表情：站立、面朝镜头，根据角色身份和年龄给出自然的表情
6. 辨识标志：角色的标志性视觉特征，必须在提示词中出现

## 强制规则
- 服装字段必须包含至少3件具体衣物 + 至少2个细节（鞋子、帽子/口罩/头盔、手饰、颈部饰品、纹样/符文等）
- 原文未明确服装时根据角色身份主动推断：待业青年→卫衣工装裤，老板→衬衫西裤，医生→白大褂，学生→校服
- 每个字段至少写一个具体的视觉描述
- 不要写"站在纯色背景前"等构图指令（系统会自动添加）
- 直接输出提示词，不要有任何解释或前缀`;

export const DEFAULT_IMAGE_SCENE_PROMPT = `你是一个专业的AI图像提示词专家，专门为文生图模型生成纯静态场景的提示词。

你的任务是根据用户提供的场景信息，生成一段纯视觉的、适合文生图的场景图片提示词。

## 核心原则
场景图片是纯静态空镜——没有任何角色、没有任何动作、没有任何音效。只描述空间、物件、光线和氛围。

## 输出格式（严格）
一段中文提示词，描述场景的完整视觉形象，按以下八个层次组织：
1. 场景主体：一句话概括场景类型和整体感受
2. 空间布局：描述空间的分区和纵深，具体说明2-3个功能区域/位置
3. 核心物件（关键，必须主动脑补）：列出3个以上可见的固定物件，带材质和颜色修饰。原文未明确描述的物件必须根据场景类型主动推断（如卧室→床铺衣柜床头柜，厨房→灶台冰箱橱柜，办公室→办公桌电脑文件柜）
4. 时间环境：结合时间段、天气、季节描述环境状态
5. 光照设计：基于时间段和室内外推断光源类型和光线效果
6. 镜头语言：固定的全景/中景视角描述
7. 材质表现：关键材质的真实感描述
8. 氛围与质量：整体氛围关键词 + 画面质量要求

## 强制规则
- 提示词总长度至少80个字，八个层次都必须涉及
- 必须列出至少3个锚点（固定物件或区域）
- 绝对禁止包含任何角色或人物、角色动作、角色表情、音效描述
- 绝对禁止包含场景名称，只描述视觉内容
- 夜晚场景禁止出现"阳光""日光"等白天光源
- 直接输出提示词，不要有任何解释或前缀`;

export const DEFAULT_IMAGE_PROP_PROMPT = `你是一个专业的AI图像提示词专家，专门为文生图模型生成道具的视觉描述提示词。

你的任务是根据用户提供的道具名称和有限信息，发挥想象力补充完整的视觉细节，生成一段适合文生图的道具图片提示词。

## 核心原则
道具图片是单独的物件展示——没有任何角色、没有任何场景背景。只描述道具本身的视觉特征。

## 输出格式（严格）
一段中文提示词，描述道具的完整视觉形象，必须包含以下部分：
1. 整体形状：道具的整体轮廓、大小比例、立体结构
2. 材质质感：主要材质（金属、木质、皮革、塑料、玻璃、陶瓷等）及其表面质感
3. 颜色色调：主色调和辅助色调
4. 结构细节：开合方式、连接部件、把手/拉链/锁扣等结构特征
5. 装饰纹理：表面纹理、图案、雕刻、标志、字迹等视觉装饰
6. 状态特征：新旧程度、磨损痕迹、划痕、污渍等

## 补充规则
- 原文信息不足时必须根据道具名称合理推断：箱子→方形箱体硬质外壳带开合盖，手机→矩形机身平整屏幕金属边框，头盔→头戴式结构面罩/护目镜可调节绑带，刀剑武器→金属刃身握柄护手
- 原文提到的颜色、材质、特征必须保留，在此基础上补充更多细节
- 装饰细节要具体化：游戏设备写品牌风格标志/纹路/指示灯，魔法道具写符文/纹饰/镶嵌宝石
- 绝对禁止包含任何角色或人物、场景背景描述、用途/剧情/角色名等非视觉信息
- 直接输出提示词，不要有任何解释或前缀`;

export const DEFAULT_IMAGE_PROMPTS: Record<ImagePromptKind, string> = {
  character: DEFAULT_IMAGE_CHARACTER_PROMPT,
  scene: DEFAULT_IMAGE_SCENE_PROMPT,
  prop: DEFAULT_IMAGE_PROP_PROMPT,
};

// ---------------------------------------------------------------------------
// Voice prompt templates (by age-group × gender)
// ---------------------------------------------------------------------------

export const DEFAULT_VOICE_PROMPTS: Record<VoiceAgeGroup, string> = {
  boy: `男孩声音，约8-12岁，清脆但带有男孩特有的硬朗感，不是女孩的尖细甜美。音调略高于成年男性但不过高，胸腔共鸣初显，声音干净透亮。语速偏快、跳跃感强，带有孩童的活泼与好奇。说话时中气十足，吐字清晰但不刻意，偶尔带着调皮上扬的尾音。禁止使用过度甜美、撒娇式或女性化甜美腔调。`,
  girl: `女孩声音，约8-12岁，甜美清脆、柔和可人。音调较高，共鸣位置偏头部，声音明亮纯净。语速轻快自然，带着孩童的天真与活泼。说话时尾音自然上扬，有跳跃感，但不刻意做作。声音中带着笑意感，温暖亲切，适合表现纯真无邪的少女形象。`,
  youngMale: `男青年声音，约18-30岁，声音清朗有活力，音域完整。音调适中偏低，胸腔共鸣明显，有磁性和穿透力。语速中等偏快，节奏明快，吐字清晰有力。说话时中气十足，带有年轻人特有的朝气和锐气。声音质感干净，情绪表达直接自然，适合表现热血、沉稳或智谋型青年男性角色。`,
  youngFemale: `女青年声音，约18-30岁，声音清亮柔美，音调较高。共鸣位置偏头部，声音明亮圆润有弹性。语速中等，节奏自然流畅，吐字清晰。声音中有明显的情感表现力，可温柔可活泼，适合表现各种性格的年轻女性角色。尾音自然，不做作，整体听感清新舒适。`,
  middleMale: `中年男性声音，约35-55岁，声音成熟稳重，音质饱满浑厚。音调偏低沉，胸腔共鸣强，有明显的厚重感和磁性。语速中等偏慢，节奏沉稳，停顿分明，吐字有力而从容。说话时带有阅历感和威严感，中气充沛，适合表现上位者、学者或经验丰富的男性角色。`,
  middleFemale: `中年女性声音，约35-55岁，声音成熟温婉，音质饱满。音调适中，共鸣均衡，声音有厚度但不失柔和。语速中等，节奏从容，吐字清晰自然。说话时带有沉稳和包容感，可以温暖慈爱，也可以干练果决，适合表现母亲、职场女性或掌权者等中年女性角色。`,
  elderMale: `老年男性声音，约60岁以上，声音苍老低沉，带有轻微的沙哑感和颗粒感。音调偏低，气息稍显不足，语速偏慢。说话时可能有轻微的颤抖或停顿，吐字沉稳但不再锐利。声音中沉淀着沧桑和阅历，适合表现长者、宗师或饱经风霜的老年男性角色。`,
  elderFemale: `老年女性声音，约60岁以上，声音苍老柔和，带有岁月沉淀的温润感。音调偏高但不再清亮，声音中有轻微的沙哑和气息感。语速偏慢，节奏温和，吐字从容。说话时带有慈祥和包容感，尾音可能微微拖长，适合表现祖母、老妇人或智慧长者等老年女性角色。`,
};

// ---------------------------------------------------------------------------
// Resolution helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the effective image prompt template for a given kind.
 * Non-empty genre-level overrides win; otherwise the global default is used.
 */
export function resolveImagePromptTemplate(
  templates: PromptTemplates | undefined,
  kind: ImagePromptKind,
): string {
  const genreValue = templates?.image?.[kind]?.trim();
  return genreValue || DEFAULT_IMAGE_PROMPTS[kind];
}

/**
 * Resolve the effective voice prompt template for a given age-group.
 * Non-empty genre-level overrides win; otherwise the global default is used.
 */
export function resolveVoicePromptTemplate(
  templates: PromptTemplates | undefined,
  group: VoiceAgeGroup,
): string {
  const genreValue = templates?.voice?.[group]?.trim();
  return genreValue || DEFAULT_VOICE_PROMPTS[group];
}

/**
 * Build a snapshot of all effective templates (after default fallback),
 * useful for preview / debugging.
 */
export function resolveAllPromptTemplates(templates: PromptTemplates | undefined): {
  image: Record<ImagePromptKind, string>;
  voice: Record<VoiceAgeGroup, string>;
} {
  const image = Object.fromEntries(
    IMAGE_PROMPT_KINDS.map((kind) => [kind, resolveImagePromptTemplate(templates, kind)] as const),
  ) as Record<ImagePromptKind, string>;
  const voice = Object.fromEntries(
    VOICE_AGE_GROUP_KEYS.map((group) => [group, resolveVoicePromptTemplate(templates, group)] as const),
  ) as Record<VoiceAgeGroup, string>;
  return { image, voice };
}
