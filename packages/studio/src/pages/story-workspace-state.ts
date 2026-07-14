import type { PageToolbarTab } from "../components/PageToolbar";

export type StoryWorkspaceStage =
  | "list"
  | "create"
  | "settings"
  | "assets"
  | "adjust"
  | "script"
  | "storyboard"
  | "video";

export const STORY_WORKSPACE_STAGES = [
  "list",
  "create",
  "settings",
  "assets",
  "script",
  "storyboard",
  "video",
] as const satisfies ReadonlyArray<StoryWorkspaceStage>;

export const DEFAULT_STORY_WORKSPACE_STAGE: StoryWorkspaceStage = "list";

const STORY_WORKSPACE_STAGE_LABELS: Readonly<Record<StoryWorkspaceStage, { readonly zh: string; readonly en: string }>> = {
  list: { zh: "故事列表", en: "Story list" },
  create: { zh: "创建故事", en: "Create story" },
  settings: { zh: "故事设定", en: "Story Settings" },
  assets: { zh: "故事资产", en: "Story Assets" },
  adjust: { zh: "对话调整", en: "Chat Adjustment" },
  script: { zh: "剧本", en: "Script" },
  storyboard: { zh: "分镜", en: "Storyboard" },
  video: { zh: "视频", en: "Video" },
};

function isStoryWorkspaceStage(value: unknown): value is StoryWorkspaceStage {
  return typeof value === "string"
    && (STORY_WORKSPACE_STAGES as ReadonlyArray<string>).includes(value);
}

export function resolveStoryWorkspaceStage(value: unknown): StoryWorkspaceStage {
  return isStoryWorkspaceStage(value) ? value : "settings";
}

export function buildStoryWorkspaceTabs(isZh: boolean): ReadonlyArray<PageToolbarTab> {
  return STORY_WORKSPACE_STAGES.map((id) => ({
    id,
    label: STORY_WORKSPACE_STAGE_LABELS[id][isZh ? "zh" : "en"],
    ...(id === "script" || id === "storyboard" || id === "video" ? { disabled: true } : {}),
  }));
}
