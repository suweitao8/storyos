# 原片画面对齐与片段引用设计

## 背景

当前 B 站影视解说导入链路已经能够保留解说视频、字幕 JSON、字幕文本，并从字幕中提取带时间的剧情节拍。但解说视频中的画面可能经过裁切、加字幕、加水印或二次包装，不能作为最终画面来源。

目标是让系统把“解说的一句话”对应到“原电影中的具体时间段”，再从原电影中取关键帧或片段用于后续脚本与成片。解说视频只负责提供叙事文本和结构参考，不能作为最终视觉素材。

## 范围与边界

本期实现以下闭环：

1. 一个影视解说写作模式可以额外关联一份原片素材（本地视频文件，或之后扩展为用户确认过的授权来源）。
2. 系统保留原片视频，并为原片生成低分辨率关键帧和场景段索引。
3. 系统将解说字幕按语义段落切成 `NarrationAnchor`，为每段寻找原片候选时间段和关键帧。
4. 匹配结果带置信度、证据和状态，低置信度不能直接进入成片。
5. 用户可以在模式详情中查看“解说句子—原片画面—原片时间码”，手动修正起止时间并确认。
6. 已确认的原片片段可以被故事脚本镜头引用，后续渲染从原片文件裁切，不读取解说视频画面。

本期不做：

- 仅凭 B 站解说链接自动在互联网寻找并下载原电影。
- 绕过登录、付费、地域限制或版权限制获取原片。
- 让模型直接凭电影名称和记忆猜测时间码。
- 一开始就自动剪出完整成片；先建立可审查、可修正的素材引用层。

原片必须由用户提供或由用户确认拥有可使用权限。没有原片时，系统继续支持现有文本拆解，但明确显示“缺少原片素材，无法生成原片画面引用”。

## 推荐架构

### 1. 双来源素材

现有 `CraftSourceManifest` 继续表示解说来源，新增独立的原片来源文件和元数据：

- `commentaryVideo`：原有 B 站解说视频，保留但只用于字幕/结构分析。
- `sourceVideo`：用户提供的原电影视频，所有最终画面引用只允许指向它。
- `subtitlesJson` / `subtitlesText`：解说字幕保持现有用途。
- `sourceVideoSubtitles`：可选的原电影字幕，用于提高语义对齐准确率。
- `timeline.json`：原片时间轴索引。
- `frames/`：原片关键帧缩略图。

为兼容旧数据，旧的 `video` key 继续可读；新建数据使用明确的 `commentaryVideo` 和 `sourceVideo`，UI 标签区分“解说视频”和“原片素材”。

### 2. 原片时间轴索引

新增 `SourceTimeline` 数据模型：

```ts
interface SourceTimeline {
  version: 1;
  sourceFileKey: "sourceVideo";
  durationSeconds: number;
  scenes: ReadonlyArray<SourceScene>;
}

interface SourceScene {
  id: string;
  startSeconds: number;
  endSeconds: number;
  thumbnailFile: string;
  visualSummary: string;
  ocrText?: string;
}
```

场景切分使用 ffmpeg 做低成本预处理：先按固定间隔抽样，再按画面变化保留代表帧；第一版不追求电影级镜头边界，只要每个时间段有可追溯的原片缩略图。关键帧文件保存在 craft 的 source 目录内，不散落到项目根目录。

### 3. 解说句子与原片场景对齐

字幕先按相邻时间、标点和句意合并为 `NarrationAnchor`：

```ts
interface NarrationAnchor {
  id: string;
  commentaryStartSeconds: number;
  commentaryEndSeconds: number;
  text: string;
  beatOrder?: number;
}
```

匹配器为每个 anchor 生成候选 `SourceMatch`：

```ts
interface SourceMatch {
  anchorId: string;
  sceneId: string;
  sourceStartSeconds: number;
  sourceEndSeconds: number;
  confidence: number;
  reason: string;
  status: "suggested" | "confirmed" | "rejected";
}
```

匹配顺序：

1. 如果有原片字幕，先做解说文本与原片字幕的语义检索，得到候选时间窗口。
2. 在候选窗口内读取原片关键帧摘要，确认人物、地点、动作和事件是否一致。
3. 如果没有原片字幕，则直接用解说 anchor 的剧情描述检索关键帧摘要，但置信度上限降低，并要求人工确认。
4. 将最优候选和备选候选一起保存，避免一次匹配错误后无法回溯。

AI 的职责是“从候选时间轴中选择并解释”，不是自由生成时间码。所有时间码都必须落在原片视频的 duration 范围内。

### 4. 人工确认页

模式详情新增“原片对齐”页签：

- 左栏：解说句子、解说时间码、所属剧情节拍。
- 中栏：原片候选关键帧和 AI 匹配理由。
- 右栏：原片视频播放器，支持跳到起止时间，手动编辑 `start/end`。
- 操作：确认、拒绝、选择候选、重新匹配、保存修正。
- 显示：置信度和“仅供建议/已确认”状态。

未确认的匹配只能用于预览，不能进入最终视频脚本。

### 5. 脚本与渲染引用

脚本镜头新增可选的原片引用：

```ts
interface SourceSegmentRef {
  matchId: string;
  sourceFileKey: "sourceVideo";
  startSeconds: number;
  endSeconds: number;
  thumbnailFile?: string;
  status: "confirmed";
}
```

故事脚本生成时只传递已确认的 `SourceSegmentRef`。成片渲染使用 ffmpeg 从 `sourceVideo` 裁切 `startSeconds/endSeconds`；如果当前渲染阶段只需要图片，则从同一时间段抽取原片帧。解说视频永远不作为 `SourceSegmentRef.sourceFileKey` 的值。

## 处理流程

```text
导入解说视频 + 字幕
        │
        ├── 生成影视解说拆解 / NarrationAnchor
        │
用户上传或确认原片
        │
        ├── 保留 sourceVideo
        ├── 抽取原片关键帧 / 场景摘要 / 可选原片字幕
        │
        ├── 语义候选检索
        ├── 关键帧复核
        └── 保存 SourceMatch（suggested）
                         │
                   用户确认/修正
                         │
                 SourceSegmentRef（confirmed）
                         │
              脚本镜头与 ffmpeg 成片引用
```

## 失败与降级

- 没有原片：保留文本拆解，禁用原片画面引用入口并提示补充原片。
- 原片无法读取或 ffmpeg 不可用：显示处理失败原因，不删除已保留的视频和字幕。
- 没有原片字幕：使用关键帧语义匹配，但所有建议标为低置信度，必须人工确认。
- 找不到候选：保存 anchor 和失败原因，允许用户手动输入时间码后确认。
- AI 返回越界或反向时间：服务端拒绝保存，并把时间裁剪/校验错误返回给 UI。
- 用户重新解析：保留原始视频和字幕，重新生成 timeline/matches，并保留上一版结果作为可回退快照。

## 分阶段交付

### 阶段一：原片素材与关键帧索引

先完成原片上传/保留、时间轴模型、ffmpeg 关键帧抽取、原片预览和手动时间段标记。这一步不依赖 AI，能先验证素材是否真的来自原片。

### 阶段二：AI 对齐建议

加入字幕 anchor 切分、候选场景检索、关键帧复核、置信度和人工确认页。先支持一条 anchor 对应一段原片，避免一次引入复杂的多镜头剪辑。

### 阶段三：脚本和成片引用

脚本镜头持久化 `SourceSegmentRef`，渲染阶段使用原片裁切或抽帧，并在成片预览中展示引用来源和时间码。

## 验证标准

1. 原片视频、解说视频、字幕、关键帧在文件层面可区分且可下载/预览。
2. 任意一条已确认引用都能通过 `sourceFileKey=sourceVideo` 找到原片文件，并在播放器跳到正确时间段。
3. 没有原片时不会生成伪造的原片引用。
4. 越界时间、未确认匹配、解说视频 key 都不能进入最终镜头引用。
5. 从字幕 anchor 到原片场景、再到脚本镜头的链路可追溯。
