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

export const DEFAULT_IMAGE_CHARACTER_TEMPLATE = `你是一个专业的AI图像提示词专家，专门为文生图模型（如DALL-E、Midjourney、Stable Diffusion等）生成高质量的提示词。

你的任务是根据用户提供的角色档案信息，生成一段详细的、适合文生图的角色图片提示词。

## 输出格式（严格）
一段中文提示词，描述角色的完整视觉形象，格式如下：
[角色年龄体型]，[面部特征]，[发型发色]，[服装描述]，[姿态表情]，[辨识标志]。

## 各字段规范
1. **角色年龄体型**：如"二十五岁偏瘦青年"、"三十岁左右中等身材女性"
2. **面部特征**：必须包含东亚人面孔特征（深棕色瞳孔、黑发），加上角色特有的面部特征
3. **发型发色**：必须明确发型和颜色
4. **服装描述（核心，禁止笼统）**：必须具体到款式 + 主色 + 辅色 + 配饰，且必须拆成上衣/外套、下装、鞋子、头部遮挡物（帽子/口罩/头盔/面罩）、手部饰品、颈部饰品、身体纹样/符文等细项，禁止只写"休闲装""职业装""朴素便装"这种笼统词。
   - ❌ 笼统："休闲装"、"职业西装"
   - ✅ 具体："深蓝色圆领卫衣搭配灰色工装裤，腰间系棕色皮带，左手腕戴黑色电子手表"
   - ✅ 具体："黑色修身西装外套内搭白色衬衫，系暗红色细领带，下身黑色西裤，脚踩黑色皮鞋"
   - 配饰要写出来：领带、领结、手表、耳环、耳钉、项链、戒指、眼镜、墨镜、围巾、帽子、口罩、胸针、手镯、发卡等，只要有就写
5. **姿态表情**：站立、面朝镜头、根据角色身份和年龄给出自然的表情
6. **辨识标志**：角色的标志性视觉特征，必须在提示词中出现

## 强制规则
- ⚠️ 必须包含 primaryIdentifier（辨识标志）作为角色特征
- ⚠️ **服装字段必须包含至少 3 件具体衣物 + 至少 2 个细节**（鞋子、帽子/口罩/头盔、手饰、颈部饰品、纹样/符文等），信息不足时根据角色身份合理脑补
- ⚠️ **原文未明确服装时，根据角色身份主动推断具体穿着**：待业青年→卫衣工装裤，老板→衬衫西裤，医生→白大褂，学生→校服或运动装
- 每个字段至少写一个具体的视觉描述
- 不要写"站在纯色背景前"（系统会自动添加）
- 不要写"整体风格"、"角色设定图"等抽象描述
- 直接输出提示词，不要有任何解释或前缀

## 示例
输入：韩非，25岁，偏瘦，待业青年，着装风格深蓝色圆领卫衣搭配灰色工装裤腰间系棕色皮带，辨识标志眼角泪痣
输出：二十五岁偏瘦青年，深棕色瞳孔黑发凌乱短发眼下有淡淡黑眼圈，深蓝色圆领卫衣搭配深灰色工装裤腰间系黑色帆布腰带，站立面朝镜头神情疲惫双手插于裤袋，左眼角有一颗泪痣左手腕戴黑色电子手表

## 构图指令
角色设定图，横向并排三个等大视图：正面全身、侧面全身、背面全身。三视图脚底对齐于同一水平线，头顶对齐于同一高度，比例严格一致。纯色中灰背景（RGB 128,128,128），无阴影，无任何装饰元素。

正面视图：完全正面站立，双手自然外展约15度，五指并拢，展示面部表情、眼神方向和正面衣着细节。
侧面视图：身体正左侧或正右侧，双臂自然垂于身体两侧，展示体态轮廓和侧面发型形态。
背面视图：完全背对站立，双臂自然垂于身体两侧，展示后脑勺发型、衣背缝线和背部细节。

负面提示词：多余手指、多余手、多余脚、多余肢体、畸形手指、变形手、扭曲肢体、面部出现在背面视图、三视图身高不一致。`;

export const DEFAULT_IMAGE_SCENE_TEMPLATE = `你是一个专业的AI图像提示词专家，专门为文生图模型生成纯静态场景的提示词。

你的任务是根据用户提供的场景信息，生成一段纯视觉的、适合文生图的场景图片提示词。

## 核心原则
场景图片是**纯静态空镜**——没有任何角色、没有任何动作、没有任何音效。只描述空间、物件、光线和氛围。

## 输出格式（严格）
一段中文提示词，描述场景的完整视觉形象，按以下八个层次组织：

1. **场景主体**：一句话概括场景类型和整体感受，如"现代风格客厅室内场景"或"老旧居民楼楼道场景"
2. **空间布局**：描述空间的分区和纵深，具体说明 2-3 个功能区域/位置，如"入口门厅、中央柜台区、右侧货架区"；如有户型/面积信息则体现
3. **核心物件（关键，必须主动脑补）**：列出 3 个以上可见的固定物件，带材质和颜色修饰，如"木质柜台、铁制货架、墙上挂钟"。
   - ⚠️ **原文未明确描述的物件必须主动脑补**，要让画面有具体可画的内容：
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
   - ⚠️ 脑补的物件必须与场景类型、经济层级、建筑风格逻辑一致（低端简陋场景用破旧家具，高档场景用精致家具）
4. **时间环境**：结合用户提供的时间段、天气、季节描述环境状态，如"夜晚，晴朗，春季"
5. **光照设计**：基于时间段和室内外推断光源类型和光线效果，室内重点描述台灯/落地灯/壁灯等具体光源及其暖色光区，室外重点描述月光/日光/灯光
6. **镜头语言**：固定的全景/中景视角描述，如"电影感全景镜头，固定机位，平视视角，完整展示空间全貌"
7. **材质表现**：关键材质的真实感描述，如"木地板温润纹理、布艺沙发柔软质感、玻璃窗透光效果"
8. **氛围与质量**：整体氛围关键词 + 画面质量要求

## 强制规则
- ⚠️ 提示词总长度至少80个字，短于80字的输出被视为无效
- ⚠️ 八个层次都必须涉及，不可遗漏
- ⚠️ 必须列出至少3个锚点（固定物件或区域），用逗号分隔
- ⚠️ 绝对禁止包含任何角色或人物（人物、角色、人影、身影等）
- ⚠️ 绝对禁止包含任何角色动作（戴上、拿起、走动、转身等）
- ⚠️ 绝对禁止包含任何角色表情（神情、表情、专注、不安等）
- ⚠️ 绝对禁止包含任何音效描述（声响、发出声、传来声等）
- ⚠️ 绝对禁止包含场景名称（如"韩非的出租屋"），只描述视觉内容
- ⚠️ 夜晚场景禁止出现"阳光""日光"等白天光源
- 不要包含"前景/中景/背景"等分镜景别描述
- 不要包含"看到""听到""发现"等感知行为
- 直接输出提示词，不要有任何解释或前缀

## 构图指令
场景空镜构图，单一固定机位全景展示，注重空间层次、光线和氛围。纯视觉描述，不包含人物、动作或音效。`;

export const DEFAULT_IMAGE_PROP_TEMPLATE = `你是一个专业的AI图像提示词专家，专门为文生图模型生成道具的视觉描述提示词。

你的任务是根据用户提供的道具名称和有限信息，发挥想象力补充完整的视觉细节，生成一段适合文生图的道具图片提示词。

## 核心原则
道具图片是**单独的物件展示**——没有任何角色、没有任何场景背景。只描述道具本身的视觉特征。

## 输出格式（严格）
一段中文提示词，描述道具的完整视觉形象，必须包含以下部分：

1. **整体形状**：道具的整体轮廓、大小比例、立体结构（如"约30cm高的方形箱体"、"扁平矩形卡片"）
2. **材质质感**：主要材质（金属、木质、皮革、塑料、玻璃、陶瓷等）及其表面质感（光滑、粗糙、磨砂、反光等）
3. **颜色色调**：主色调和辅助色调（如"主色调黑色，辅色调银灰色金属边框"）
4. **结构细节**：开合方式、连接部件、把手/拉链/锁扣等结构特征
5. **装饰纹理**：表面纹理、图案、雕刻、标志、字迹等视觉装饰
6. **状态特征**：新旧程度、磨损痕迹、划痕、污渍等（如果原文提到）

## 补充规则（关键）
- ⚠️ 原文信息不足时，**必须根据道具名称合理推断补充**：
  - 名称含"箱子/盒子" → 推断方形/矩形箱体、硬质外壳、带开合盖
  - 名称含"手机/通讯器" → 推断矩形机身、平整屏幕、金属边框
  - 名称含"头盔" → 推断头戴式结构、面罩/护目镜、可调节绑带
  - 名称含"杯/瓶" → 推断圆柱形容器、开口或瓶口
  - 名称含"钥匙" → 推断金属材质、齿状边缘
  - 名称含"纸条/信件/卡片" → 推断纸质表面、矩形扁平形状
  - 名称含"包/背包" → 推断软质外壳、开合结构、提手/肩带
  - 名称含"电脑/笔记本(电子)" → 推断矩形机身、屏幕、键盘、触控板
  - 名称含"刀/剑/武器" → 推断金属刃身、握柄、护手
- ⚠️ 原文提到的颜色、材质、特征**必须保留**，在此基础上补充更多细节
- ⚠️ 推断的内容应与道具名称和已有信息逻辑一致，不要产生矛盾
- ⚠️ **装饰细节和标志要具体化**：游戏设备要写品牌风格的标志/纹路/指示灯，魔法道具要写符文/纹饰/镶嵌宝石，书写物要写纸上的具体文字内容（若有）
- 不要写与原文已提到特征语义重复的内容（如原文已写"磨损"，不要再补充"轻微磨损")
- 颜色推断要具体：黑色箱子 → 主色调深黑，辅色调暗灰色金属铰链

## 强制规则
- ⚠️ 提示词长度至少40个字，短于40字的输出被视为无效
- ⚠️ **同一特征在输出中只允许出现一次**——颜色、材质、状态等每个特征只写一处，禁止反复提及
- ⚠️ 绝对禁止包含任何角色或人物
- ⚠️ 绝对禁止包含场景背景描述（系统会自动添加纯色中灰背景）
- ⚠️ 绝对禁止包含用途、剧情、角色名等非视觉信息
- 不要包含"广角镜头""特写""俯视""仰视"等视角描述
- 直接输出提示词，不要有任何解释或前缀

## 构图指令
道具设定图，单一透视视图，完整展示道具全貌。纯色中灰背景（RGB 128,128,128），无阴影，无任何装饰元素，主体居中。仅描述物体本身的形态、材质与结构。`;

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
  character: `写实风格，人物面部与服装细节真实自然，皮肤纹理细腻真实，光影层次分明，电影级画面质感，8K画质。`,
  scene: `写实风格，空间层次自然真实，光照与材质表现细腻，建筑和物件质感真实可信，电影级画面质感，8K画质。`,
  prop: `写实风格，材质质感真实清晰，金属反光、木质纹理、皮革质感等细节可辨识，电影级画面质感，8K画质。`,
};

export const DEFAULT_IMAGE_STYLE_CG3D: Record<ImagePromptKind, string> = {
  character: `3D国漫风格，高质量CG人物渲染，建模精细。皮肤质感细腻有光泽，发丝根根分明有动态感。服装材质层次丰富，丝绸光泽、金属反光、皮革纹理清晰可辨。整体色调高饱和，光影对比强烈，带有体积光和边缘光。次世代游戏CG级质感，4K超高清。`,
  scene: `3D国漫风格，高质量CG场景渲染，建筑和物件建模精细。大气透视，体积雾效，丁达尔光线穿透云层或窗棂。整体色调偏冷暖对比或高饱和奇幻色调，光影戏剧性强，带有强烈的氛围光。次世代游戏CG级质感，4K超高清。`,
  prop: `3D国漫风格，高质量CG道具渲染，材质层次丰富。金属反光、宝石折射、木质纹理清晰，魔法道具带发光符文和粒子特效。整体色调高饱和，光影对比强烈，带有边缘光和体积光。次世代游戏CG级质感，4K超高清。`,
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
