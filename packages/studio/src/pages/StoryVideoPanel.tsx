import { useState } from "react";
import { Film, Sparkles, Volume2, VolumeX } from "lucide-react";

import { postApi, useApi } from "../hooks/use-api";
import type { Theme } from "../hooks/use-theme";
import type { UnifiedScriptDocument } from "../api/story-production";
import { buildStoryProductionPath } from "./StoryScriptPanel";

interface SceneEntry {
  readonly index: number;
  readonly name: string;
  readonly shotCount: number;
  readonly videoExists: boolean;
}

interface ProductionResponse {
  readonly script: UnifiedScriptDocument & { readonly exists: boolean; readonly content: string };
  readonly video: { readonly exists: boolean; readonly durationMs?: number | null; readonly voiceEnabled?: boolean; readonly warning?: string | null; readonly generatedAt?: string | null };
  readonly scenes: ReadonlyArray<SceneEntry>;
  readonly warning?: string | null;
}

interface StoryVideoPanelProps {
  readonly kind: "book" | "short";
  readonly storyId: string | null;
  readonly theme: Theme;
  readonly isZh: boolean;
}

type Selection = { readonly type: "collection" } | { readonly type: "scene"; readonly index: number };

export function StoryVideoPanel({ kind, storyId, theme: _theme, isZh }: StoryVideoPanelProps) {
  const path = storyId ? buildStoryProductionPath(kind, storyId) : "";
  const { data, loading, error, refetch } = useApi<ProductionResponse>(path);
  const [withVoice, setWithVoice] = useState(true);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>({ type: "collection" });

  const collectionVideoUrl = storyId
    ? `${path}/video/file?ts=${encodeURIComponent(data?.video.generatedAt ?? "0")}`
    : "";
  const scenes = data?.scenes ?? [];

  if (!loading && (!storyId || (data && !data.script.exists))) {
    return (
      <section className="flex h-full min-h-0 w-full items-center justify-center bg-card/20" data-testid="story-video-panel">
        <EmptyState text={isZh ? "暂无内容" : "No content"} />
      </section>
    );
  }

  const generate = async () => {
    if (!storyId) return;
    setBusy(true);
    setActionError(null);
    try {
      await postApi(`${path}/video`, { voice: withVoice });
      await refetch();
    } catch (failure) {
      setActionError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };

  const selectedScene = selection.type === "scene" ? scenes.find((s) => s.index === selection.index) : null;
  const selectedSceneVideoUrl =
    selection.type === "scene" && storyId
      ? `${path}/video/scene/${selection.index}/file`
      : null;

  return (
    <section className="flex h-full min-h-0 w-full overflow-hidden bg-card/20" data-testid="story-video-panel">
      {!storyId ? (
        <EmptyState text={isZh ? "创建故事后，这里会显示视频。" : "Video will appear after a story is created."} />
      ) : loading && !data ? (
        <EmptyState text={isZh ? "正在加载..." : "Loading..."} />
      ) : error ? (
        <div className="m-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>
      ) : !data?.script.exists ? (
        <EmptyState text={isZh ? "暂无内容" : "No content"} />
      ) : (
        <div className="flex h-full min-h-0 w-full">
          {/* 左侧：场景列表 */}
          <aside className="flex h-full w-56 shrink-0 flex-col border-r border-border/40 bg-card/30">
            <div className="shrink-0 border-b border-border/30 px-3 py-2">
              <p className="text-xs font-semibold text-muted-foreground">{isZh ? "场景列表" : "Scenes"}</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {/* 合集 */}
              <button
                type="button"
                onClick={() => setSelection({ type: "collection" })}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                  selection.type === "collection"
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-foreground/80 hover:bg-secondary/60 hover:text-foreground"
                }`}
              >
                <Film size={14} className="shrink-0" />
                <span className="truncate">{isZh ? "合集" : "Collection"}</span>
                {data?.video.exists ? (
                  <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                ) : null}
              </button>

              {scenes.length > 0 ? <div className="my-1 border-t border-border/20" /> : null}

              {/* 各场景 */}
              {scenes.map((scene) => (
                <button
                  key={scene.index}
                  type="button"
                  onClick={() => setSelection({ type: "scene", index: scene.index })}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
                    selection.type === "scene" && selection.index === scene.index
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-foreground/80 hover:bg-secondary/60 hover:text-foreground"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${scene.videoExists ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                  <span className="truncate">{scene.name}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground/50">{scene.shotCount}</span>
                </button>
              ))}
            </div>

            {/* 底部操作栏 */}
            <div className="shrink-0 space-y-2 border-t border-border/30 p-2">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={withVoice}
                  onChange={(e) => setWithVoice(e.target.checked)}
                  className="h-3.5 w-3.5"
                />
                {withVoice ? <Volume2 size={12} /> : <VolumeX size={12} />}
                {isZh ? "合成语音" : "Voice"}
              </label>
              <button
                type="button"
                onClick={() => void generate()}
                disabled={busy}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                <Sparkles size={12} />
                {busy ? (isZh ? "生成中..." : "Generating...") : isZh ? "生成视频" : "Generate video"}
              </button>
            </div>
          </aside>

          {/* 右侧：视频预览 */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col p-4">
            {actionError || data.warning || data.video.warning ? (
              <div className="mb-3 shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                {actionError ?? data.warning ?? data.video.warning}
              </div>
            ) : null}

            {selection.type === "collection" ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <h2 className="mb-3 shrink-0 text-base font-semibold">{isZh ? "合集 — 全部场景" : "Collection — All scenes"}</h2>
                {data.video.exists ? (
                  <video
                    key={collectionVideoUrl}
                    className="aspect-video w-full max-w-4xl rounded-xl border border-border/50 bg-black"
                    src={collectionVideoUrl}
                    controls
                    preload="metadata"
                  />
                ) : (
                  <div className="flex aspect-video max-w-4xl items-center justify-center rounded-xl border border-dashed border-border bg-background/50 text-sm text-muted-foreground">
                    {isZh ? "还没有合集视频，点击左下角生成。" : "No collection video yet. Generate from the left panel."}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <h2 className="mb-3 shrink-0 text-base font-semibold">
                  {selectedScene?.name ?? (isZh ? "场景" : "Scene")}
                </h2>
                {selectedSceneVideoUrl && selectedScene?.videoExists ? (
                  <video
                    key={selectedSceneVideoUrl}
                    className="aspect-video w-full max-w-4xl rounded-xl border border-border/50 bg-black"
                    src={selectedSceneVideoUrl}
                    controls
                    preload="metadata"
                  />
                ) : (
                  <div className="flex aspect-video max-w-4xl items-center justify-center rounded-xl border border-dashed border-border bg-background/50 text-sm text-muted-foreground">
                    {isZh ? "该场景暂无视频，生成后会自动出现。" : "No video for this scene yet. It will appear after generation."}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function EmptyState({ text }: { readonly text: string }) {
  return (
    <div className="flex min-h-56 flex-1 items-center justify-center rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
