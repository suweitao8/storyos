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
import type { ArtStyle, ImagePromptKind } from "./genre-profile.js";
import { IMAGE_PROMPT_KINDS } from "./genre-profile.js";

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
  character: `3D国漫风格，高质量CG人物渲染，建模精细。皮肤质感细腻有光泽，发丝根根分明有动态感。服装材质层次丰富，丝绸光泽、金属反光、皮革纹理清晰可辨。整体色调饱满，光影过渡自然，人物立体感强。`,
  scene: `3D国漫风格，高质量CG场景渲染，建筑和物件建模精细，材质表现丰富真实。色彩层次分明，明暗对比自然有层次，整体氛围有影视感。光照效果依据场景本身的光源条件自然呈现。`,
  prop: `3D国漫风格，高质量CG道具渲染，材质层次丰富。金属反光、宝石折射、木质纹理清晰。整体色调饱满，光影过渡自然，物件立体感强，细节刻画精致。`,
};

export const DEFAULT_IMAGE_STYLES: Record<ArtStyle, Record<ImagePromptKind, string>> = {
  realistic: DEFAULT_IMAGE_STYLE_REALISTIC,
  cg3d: DEFAULT_IMAGE_STYLE_CG3D,
};

// ===========================================================================
// Voice prompt template (generic — character-driven)
// ===========================================================================

/**
 * Generic voice prompt template.
 *
 * This template does NOT prescribe a fixed timbre. Instead it tells the model
 * how to *derive* the right voice characteristics (pitch, resonance, tempo,
 * texture) from the character's profile — age, gender, body type, personality.
 *
 * Concrete voice parameters should be driven by character assets at generation
 * time; this template only provides the reasoning framework so it stays
 * universal across any character.
 */
export const DEFAULT_VOICE_PROMPT = `你的任务是根据角色的完整档案信息，为语音合成模型推导出一段准确、可用、贴合角色形象的音色描述。

## 核心原则
音色由角色本身决定——年龄、性别、体型、性格、身份与说话习惯共同塑造一个人的声音。不要套用刻板的"某年龄段=某音色"公式，而要根据角色的具体特征综合推导。

## 推导维度

根据角色档案中可用的信息，逐项推导（档案未提及的维度合理推断即可）：

1. **年龄与性别**：决定基础音区和声音成熟度。儿童声音清脆、尚未定型；青年声音清朗、中气充足；中年声音沉稳、质感饱满；老年声音苍老、带有岁月痕迹。男性整体音区低于女性，胸腔共鸣更明显。
2. **体型**：影响共鸣和声音厚度。体型壮硕/偏胖的人通常胸腔共鸣更强、声音更浑厚低沉；体型纤细/偏瘦的人声音偏清亮单薄、共鸣位置偏高。
3. **性格**：决定语速、节奏和情绪底色。大大咧咧/外向的人语速偏快、尾音上扬、声音中有笑意和跳跃感；内向/沉稳的人语速偏慢、节奏平稳、尾音克制；冷酷或阴鸷的人声音压抑、气息重、缺乏起伏。
4. **身份与说话习惯**：上位者、军人、学者、市井小民——身份影响说话的力度、吐字的讲究程度和停顿习惯。注意角色档案中提到的口癖、方言、特殊说话方式。

## 输出要求
输出一段流畅的中文音色描述段落，涵盖：基础音区 → 共鸣位置 → 语速节奏 → 音色质感 → 情绪底色 → 特殊说话习惯（如有）。描述要具体到可执行，不要笼统。

## 强制规则
- 必须基于角色档案推导，不要凭空编造与角色矛盾的声音特征
- 不要使用"适合表现某类角色"之类的元描述，直接描述声音本身
- 声音特征之间要自洽（体型壮硕的人不能声音尖细单薄，除非档案明确说明反差）
- 直接输出音色描述段落，不写解释、前缀或标题`;

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
 * Build a snapshot of all templates for a given style, useful for preview.
 */
export function resolveAllPromptTemplates(style: ArtStyle = "realistic"): {
  image: Record<ImagePromptKind, string>;
  voice: string;
} {
  const image = Object.fromEntries(
    IMAGE_PROMPT_KINDS.map((kind) => [kind, resolveImagePromptTemplate(kind, style)] as const),
  ) as Record<ImagePromptKind, string>;
  return { image, voice: DEFAULT_VOICE_PROMPT };
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
