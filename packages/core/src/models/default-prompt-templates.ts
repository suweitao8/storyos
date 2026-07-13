/**
 * Global default prompt templates for story asset generation.
 *
 * Each genre may override any of these via its `promptTemplates` frontmatter.
 * When a genre-level template is empty, {@link resolveImagePromptTemplate} /
 * {@link resolveVoicePromptTemplate} fall back to the values defined here.
 *
 * ## Architecture
 *
 * Image generation separates **content** from **style**:
 *
 * 1. **Templates** (`image.templates.*`) — style-agnostic LLM system prompts.
 *    They tell the model *what* visual facts to extract (age, body type,
 *    clothing, materials, composition…) and are identical regardless of the
 *    final art style.
 *
 * 2. **Style descriptions** (`image.styles.*`) — short, editable text blocks
 *    that describe the desired visual look (realistic film-grade, 3D 国漫 CGI,
 *    …).  These are appended to the template at generation time.
 *
 * At generation time {@link resolveImagePromptTemplate} combines them:
 * `template + "\n\n" + styleDescription`.
 */
import type { ArtStyle, ImagePromptKind, VoiceAgeGroup } from "./genre-profile.js";
import { IMAGE_PROMPT_KINDS, VOICE_AGE_GROUP_KEYS } from "./genre-profile.js";

// ===========================================================================
// Image prompt templates (style-agnostic content extraction guidance)
// ===========================================================================

export const DEFAULT_IMAGE_CHARACTER_TEMPLATE = `你的任务是根据用户提供的角色档案信息，为 GPT-Image-2 图片生成模型编写一段直接可用的中文图片提示词。

## 输出格式
输出一段流畅的中文描述段落，涵盖角色的完整视觉形象。结构为：年龄体型 → 面部特征 → 发型发色 → 服装配饰 → 姿态表情 → 辨识标志。

## 各字段规范
1. **角色年龄体型**：如"二十五岁偏瘦青年"、"三十岁左右中等身材女性"
2. **面部特征**：东亚人面孔（深棕色瞳孔、黑发），加上角色特有的面部特征（黑眼圈、疤痕、泪痣等）
3. **发型发色**：明确发型和颜色，如"凌乱黑色短发"、"齐肩栗色卷发"
4. **服装配饰（核心）**：具体到款式 + 主色 + 辅色 + 配饰，拆成上衣/外套、下装、鞋子、头部遮挡、手部饰品、颈部饰品等细项。
   - 笼统："休闲装"、"职业西装"
   - 具体："深蓝色圆领卫衣搭配灰色工装裤，腰间系棕色皮带，左手腕戴黑色电子手表"
   - 具体："黑色修身西装外套内搭白色衬衫，系暗红色细领带，下身黑色西裤，脚踩黑色皮鞋"
   - 配饰有就写：领带、手表、耳环、项链、眼镜、围巾、帽子等
5. **姿态表情**：站立面朝镜头，根据角色身份给出自然表情
6. **辨识标志**：角色的标志性视觉特征，必须出现

## 强制规则
- 必须包含角色的辨识标志
- 服装至少写 3 件具体衣物 + 2 个配饰细节；原文未明确时根据角色身份推断（待业青年→卫衣工装裤，老板→衬衫西裤，医生→白大褂）
- 只描述角色本身的视觉特征，不写背景、构图、画幅等画面指令
- 直接输出提示词段落，不写解释、前缀或标题

## 示例
输入：韩非，25岁，偏瘦，待业青年，着装风格深蓝色圆领卫衣搭配灰色工装裤腰间系棕色皮带，辨识标志眼角泪痣
输出：二十五岁偏瘦青年，深棕色瞳孔，黑发凌乱短发，眼下有淡淡黑眼圈。深蓝色圆领卫衣搭配深灰色工装裤，腰间系黑色帆布腰带，脚穿白色帆布鞋，左手腕戴黑色电子手表。站立面朝镜头，神情疲惫，双手插于裤袋。左眼角有一颗泪痣。`;

export const DEFAULT_IMAGE_SCENE_TEMPLATE = `你的任务是根据用户提供的场景信息，为 GPT-Image-2 图片生成模型编写一段直接可用的中文场景图片提示词。

## 核心原则
场景图片是纯静态空镜——画面中只有空间、物件、光线和氛围，是一个没有人的环境。

## 输出格式
输出一段流畅的中文描述段落，涵盖场景的完整视觉形象。内容层次：

1. **场景主体**：一句话概括场景类型和整体感受，如"现代风格客厅室内场景"或"老旧居民楼楼道场景"
2. **空间布局**：描述空间的分区和纵深，具体说明 2-3 个功能区域/位置
3. **核心物件（关键）**：列出 3 个以上可见的固定物件，带材质和颜色修饰。
   - 原文未明确描述的物件要主动补充，让画面有具体可画的内容：
     - 出租屋/单身公寓 → 单人床铺、简易木书桌、暖色台灯、旧布艺沙发、简易衣柜
     - 客厅 → 布艺沙发、木质茶几、电视柜、落地灯、窗帘
     - 卧室 → 床铺、衣柜、床头柜、台灯、梳妆台
     - 厨房 → 灶台、橱柜、冰箱、抽油烟机、餐具架
     - 卫生间/浴室 → 洗手台、镜子、马桶、淋浴区、毛巾架
     - 办公室/工位 → 办公桌、电脑（多屏）、主机、人体工学椅、文件柜
     - 商店/旧货商店 → 货架、木质柜台、收银台、商品陈列
     - 医院/诊所 → 病床、医疗设备、白色墙面、候诊椅
     - 学校/教室 → 课桌椅、黑板、讲台
     - 街道/楼道 → 路灯、建筑外墙、栏杆、楼梯
   - 补充的物件要与场景类型、经济层级、建筑风格一致（低端场景用旧家具，高档场景用精致家具）
4. **时间环境**：时间段、天气、季节，如"夜晚，晴朗，春季"
5. **光照设计**：明确光源类型和光线效果，室内写台灯/落地灯/壁灯等具体光源及其暖色光区，室外写月光/日光/路灯
6. **材质表现**：关键材质的真实感描述，如"木地板温润纹理、布艺沙发柔软质感、玻璃窗透光效果"
7. **氛围与色调**：整体氛围关键词 + 色调倾向

## 强制规则
- 提示词总长度至少 80 个字
- 必须列出至少 3 个锚点物件（带材质和颜色修饰）
- 这是一个无人的纯环境空镜，只描述空间、物件、光线和氛围
- 夜晚场景只写夜晚光源（月光、路灯、室内灯光等）
- 直接输出提示词段落，不写解释、前缀或标题`;

export const DEFAULT_IMAGE_PROP_TEMPLATE = `你的任务是根据用户提供的道具名称和有限信息，为 GPT-Image-2 图片生成模型编写一段直接可用的中文道具图片提示词。

## 核心原则
道具图片是纯物件特写——画面中只有道具本身，居中展示在纯色背景上。

## 输出格式
输出一段流畅的中文描述段落，涵盖道具的完整视觉形象：

1. **整体形状**：整体轮廓、大小比例、立体结构（如"约30cm高的方形箱体"、"扁平矩形卡片"）
2. **材质质感**：主要材质（金属、木质、皮革、塑料、玻璃、陶瓷等）及表面质感（光滑、粗糙、磨砂、反光等）
3. **颜色色调**：主色调和辅助色调（如"主色调黑色，辅色调银灰色金属边框"）
4. **结构细节**：开合方式、连接部件、把手/拉链/锁扣等结构特征
5. **装饰纹理**：表面纹理、图案、雕刻、标志、字迹等视觉装饰
6. **状态特征**：新旧程度、磨损痕迹、划痕、污渍等（如果原文提到）

## 补充规则
- 原文信息不足时，根据道具名称合理推断补充：
  - 名称含"箱子/盒子" → 方形/矩形箱体、硬质外壳、带开合盖
  - 名称含"手机/通讯器" → 矩形机身、平整屏幕、金属边框
  - 名称含"头盔" → 头戴式结构、面罩/护目镜、可调节绑带
  - 名称含"杯/瓶" → 圆柱形容器、开口或瓶口
  - 名称含"钥匙" → 金属材质、齿状边缘
  - 名称含"纸条/信件/卡片" → 纸质表面、矩形扁平形状
  - 名称含"包/背包" → 软质外壳、开合结构、提手/肩带
  - 名称含"电脑/笔记本(电子)" → 矩形机身、屏幕、键盘、触控板
  - 名称含"刀/剑/武器" → 金属刃身、握柄、护手
- 原文提到的颜色、材质、特征必须保留，在此基础上补充更多细节
- 推断内容与道具名称和已有信息逻辑一致
- 装饰细节和标志要具体化：游戏设备写标志/纹路/指示灯，魔法道具写符文/纹饰/镶嵌宝石，书写物写纸上的具体文字内容（若有）
- 颜色推断要具体：黑色箱子 → 主色调深黑，辅色调暗灰色金属铰链

## 强制规则
- 提示词长度至少 40 个字
- 每个特征只写一次，颜色、材质、状态等不重复提及
- 这是纯物件特写，只描述道具本身的形态、材质与结构
- 直接输出提示词段落，不写解释、前缀或标题`;

export const DEFAULT_IMAGE_TEMPLATES: Record<ImagePromptKind, string> = {
  character: DEFAULT_IMAGE_CHARACTER_TEMPLATE,
  scene: DEFAULT_IMAGE_SCENE_TEMPLATE,
  prop: DEFAULT_IMAGE_PROP_TEMPLATE,
};

// ===========================================================================
// Image style descriptions (appended to templates at generation time)
// ===========================================================================
//
// Each art style has a separate description per kind (character / scene /
// prop), so e.g. the cg3d character style can talk about skin and hair while
// the cg3d scene style can talk about volumetric fog and architecture.

export const DEFAULT_IMAGE_STYLE_REALISTIC: Record<ImagePromptKind, string> = {
  character: `写实摄影风格，人物面部与服装细节真实自然，皮肤纹理细腻，光影层次分明，环境光反射自然，景深柔和。`,
  scene: `写实摄影风格，空间层次自然真实，光照与材质表现细腻，建筑和物件质感真实可信，自然的环境光和柔和的阴影过渡。`,
  prop: `写实摄影风格，材质质感真实清晰，金属反光、木质纹理、皮革质感等细节可辨识，柔和均匀的打光，自然的环境光反射。`,
};

export const DEFAULT_IMAGE_STYLE_CG3D: Record<ImagePromptKind, string> = {
  character: `3D国漫风格，高质量CG人物渲染，建模精细。皮肤质感细腻有光泽，发丝根根分明有动态感。服装材质层次丰富，丝绸光泽、金属反光、皮革纹理清晰可辨。整体色调高饱和，光影对比强烈，带有体积光和边缘光。`,
  scene: `3D国漫风格，高质量CG场景渲染，建筑和物件建模精细。大气透视，体积雾效，丁达尔光线穿透云层或窗棂。整体色调偏冷暖对比或高饱和奇幻色调，光影戏剧性强，带有强烈的氛围光。`,
  prop: `3D国漫风格，高质量CG道具渲染，材质层次丰富。金属反光、宝石折射、木质纹理清晰，魔法道具带发光符文和粒子特效。整体色调高饱和，光影对比强烈，带有边缘光和体积光。`,
};

export const DEFAULT_IMAGE_STYLES: Record<ArtStyle, Record<ImagePromptKind, string>> = {
  realistic: DEFAULT_IMAGE_STYLE_REALISTIC,
  cg3d: DEFAULT_IMAGE_STYLE_CG3D,
};

// ===========================================================================
// Voice prompt templates (by age-group × gender)
// ===========================================================================

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

// ===========================================================================
// Resolution helpers
// ===========================================================================

/**
 * Get the full image prompt for a given kind + style by combining the
 * style-agnostic template with the style description.
 *
 * This is the main entry point for generation: callers pass the desired
 * art style (from the genre's `artStyle` field) and get back a ready-to-use
 * LLM system prompt.
 */
export function resolveImagePromptTemplate(
  kind: ImagePromptKind,
  style: ArtStyle = "realistic",
): string {
  const template = DEFAULT_IMAGE_TEMPLATES[kind];
  const styleDesc = DEFAULT_IMAGE_STYLES[style]?.[kind];
  return styleDesc ? `${template}\n\n${styleDesc}` : template;
}

/**
 * Get the voice prompt for a given age-group.
 */
export function resolveVoicePromptTemplate(group: VoiceAgeGroup): string {
  return DEFAULT_VOICE_PROMPTS[group];
}

/**
 * Build a snapshot of all templates for a given style, useful for preview.
 */
export function resolveAllPromptTemplates(style: ArtStyle = "realistic"): {
  image: Record<ImagePromptKind, string>;
  voice: Record<VoiceAgeGroup, string>;
} {
  const image = Object.fromEntries(
    IMAGE_PROMPT_KINDS.map((kind) => [kind, resolveImagePromptTemplate(kind, style)] as const),
  ) as Record<ImagePromptKind, string>;
  const voice = Object.fromEntries(
    VOICE_AGE_GROUP_KEYS.map((group) => [group, resolveVoicePromptTemplate(group)] as const),
  ) as Record<VoiceAgeGroup, string>;
  return { image, voice };
}

/**
 * Build per-kind image prompt guides for the story-asset extractor.
 *
 * Each value is the full template (content guidance + style description),
 * ready to be injected into the extractor's system prompt so the LLM
 * generates `imagePrompt` values that follow the detailed Chinese norms.
 */
export function buildImagePromptGuides(
  style: ArtStyle = "realistic",
): { character: string; scene: string; prop: string } {
  return {
    character: resolveImagePromptTemplate("character", style),
    scene: resolveImagePromptTemplate("scene", style),
    prop: resolveImagePromptTemplate("prop", style),
  };
}
