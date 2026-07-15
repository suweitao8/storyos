import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Sparkles } from "lucide-react";

import { postApi, useApi } from "../hooks/use-api";
import type { Theme } from "../hooks/use-theme";
import type { UnifiedScriptDocument, UnifiedScriptShot } from "../api/story-production";

interface ProductionResponse {
  readonly script: UnifiedScriptDocument & { readonly exists: boolean; readonly content: string; readonly generatedAt?: string | null };
  readonly video: { readonly exists: boolean; readonly durationMs?: number | null; readonly voiceEnabled?: boolean; readonly warning?: string | null };
  readonly warning?: string | null;
}

export function hasStoryProductionContent(value: { readonly script?: { readonly exists?: boolean } } | null | undefined): boolean {
  return value?.script?.exists === true;
}

export function buildStoryProductionPath(kind: "book" | "short", storyId: string): string {
  return `/${kind === "short" ? "shorts" : "books"}/${encodeURIComponent(storyId)}/production`;
}

/** 按 scene 字段把镜头聚合成有序分组，保持镜头出场顺序。 */
export function groupShotsByScene(shots: readonly UnifiedScriptShot[]): ReadonlyArray<readonly [string, ReadonlyArray<UnifiedScriptShot>]> {
  const grouped = new Map<string, UnifiedScriptShot[]>();
  for (const shot of shots) {
    const current = grouped.get(shot.scene) ?? [];
    current.push(shot);
    grouped.set(shot.scene, current);
  }
  return [...grouped.entries()];
}

/** 镜头稳定标识，用于选中态与列表 key。 */
function shotKey(shot: UnifiedScriptShot): string {
  return `${shot.scene}#${shot.number}`;
}

interface StoryScriptPanelProps {
  readonly kind: "book" | "short";
  readonly storyId: string | null;
  readonly theme: Theme;
  readonly isZh: boolean;
}

export function StoryScriptPanel({ kind, storyId, theme: _theme, isZh }: StoryScriptPanelProps) {
  const path = storyId ? buildStoryProductionPath(kind, storyId) : "";
  const { data, loading, error, refetch } = useApi<ProductionResponse>(path);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const shots = useMemo(() => data?.script.shots ?? [], [data?.script.shots]);
  const scenes = useMemo(() => groupShotsByScene(shots), [shots]);

  const allKeys = useMemo(() => shots.map(shotKey), [shots]);
  useEffect(() => {
    if (allKeys.length === 0) {
      if (selectedKey !== null) setSelectedKey(null);
      return;
    }
    if (!selectedKey || !allKeys.includes(selectedKey)) setSelectedKey(allKeys[0] ?? null);
  }, [allKeys, selectedKey]);

  const selectedShot = useMemo(() => shots.find((shot) => shotKey(shot) === selectedKey) ?? null, [shots, selectedKey]);

  async function generate(): Promise<void> {
    if (!storyId) return;
    setBusy(true);
    setActionError(null);
    try {
      await postApi(`${path}/script`);
      await refetch();
    } catch (failure) {
      setActionError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  }

  const emptyBody = (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-6">
      <EmptyState text={isZh ? "暂无剧本" : "No script yet"} />
      {storyId ? (
        <button type="button" onClick={() => void generate()} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? <Sparkles size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {busy ? (isZh ? "生成中..." : "Generating...") : isZh ? "生成剧本" : "Generate script"}
        </button>
      ) : null}
    </div>
  );

  // 空内容 / 加载 / 出错：只保留必要的生成入口，隐藏表格与编辑区。
  if (!loading && (!storyId || (data && !hasStoryProductionContent(data)))) {
    return (
      <section className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-card/20" data-testid="story-script-panel">
        {emptyBody}
      </section>
    );
  }

  return (
    <section className="flex h-full min-h-0 w-full overflow-hidden bg-card/20" data-testid="story-script-panel">
      {loading && !data ? (
        <div className="flex h-full w-full items-center justify-center">
          <EmptyState text={isZh ? "正在加载剧本..." : "Loading script..."} />
        </div>
      ) : error ? (
        <div className="flex h-full w-full items-center justify-center p-6">
          <ErrorState text={error} />
        </div>
      ) : !data?.script.exists || shots.length === 0 ? (
        emptyBody
      ) : (
        <div className="flex h-full min-h-0 w-full">
          {/* 左侧（2/3）：按场景分组的分镜表格 */}
          <div className="flex h-full min-h-0 w-2/3 shrink-0 flex-col border-r border-border/40" data-testid="story-script-list">
            <div className="shrink-0 border-b border-border/30 px-3 py-2">
              <p className="text-xs font-semibold text-muted-foreground">{isZh ? "分镜" : "Shots"}<span className="ml-1 text-muted-foreground/50">{shots.length}</span></p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {actionError || data.warning ? <div className="mx-3 mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">{actionError ?? data.warning}</div> : null}
              {scenes.map(([scene, sceneShots]) => (
                <div key={scene} className="border-b border-border/30 last:border-b-0">
                  {/* 场景标题行（sticky） */}
                  <div className="sticky top-0 z-[1] flex items-baseline gap-2 bg-background/95 px-3 py-1.5 backdrop-blur">
                    <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{scene}</p>
                    <span className="shrink-0 text-[11px] text-muted-foreground/50">{sceneShots.length}</span>
                  </div>
                  {/* 表头 */}
                  <div className="grid grid-cols-[2fr_3fr] gap-px border-b border-border/20 bg-border/20 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                    <div className="bg-background/60 px-3 py-1">{isZh ? "分镜内容" : "Visual"}</div>
                    <div className="bg-background/60 px-3 py-1">{isZh ? "旁白" : "Narration"}</div>
                  </div>
                  {/* 分镜行 */}
                  {sceneShots.map((shot) => (
                    <ShotRow key={shotKey(shot)} shot={shot} isZh={isZh} selected={shotKey(shot) === selectedKey} onSelect={() => setSelectedKey(shotKey(shot))} />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* 右半边：分镜编辑面板 */}
          <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
            {selectedShot ? <ShotDetails key={shotKey(selectedShot)} shot={selectedShot} isZh={isZh} /> : (
              <div className="flex h-full items-center justify-center p-6">
                <EmptyState text={isZh ? "选择左侧分镜查看详情" : "Select a shot to view details"} />
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// 左侧：单行分镜（两列表格行：左=分镜内容，右=旁白分行）
// ---------------------------------------------------------------------------

/** 把已断句换行的旁白拆成独立的行，去掉每行末尾标点，用于表格内分行展示。 */
function splitNarrationLines(subtitle: string): string[] {
  return subtitle
    .split(/\n/u)
    .map((line) => line.trim().replace(/[，。！？；,.!?;]$/u, "").trim())
    .filter(Boolean);
}

function ShotRow({ shot, isZh, selected, onSelect }: {
  readonly shot: UnifiedScriptShot;
  readonly isZh: boolean;
  readonly selected: boolean;
  readonly onSelect: () => void;
}) {
  const visual = shot.visual.trim();
  const narrationLines = splitNarrationLines(shot.subtitle);
  const camera = shot.camera?.trim();
  return (
    <button
      type="button"
      data-testid={`story-script-shot-${shot.number}`}
      aria-pressed={selected}
      onClick={onSelect}
      className={`grid w-full grid-cols-[2fr_3fr] gap-px border-b border-border/20 bg-border/20 text-left transition-colors ${selected ? "ring-1 ring-inset ring-primary/40" : ""}`}
    >
      {/* 左列：分镜内容 */}
      <div className={`min-w-0 px-3 py-2 ${selected ? "bg-primary/10" : "bg-background/60"}`}>
        <div className="mb-1 flex items-center gap-1.5">
          <span className={`shrink-0 text-xs font-semibold tabular-nums ${selected ? "text-primary" : "text-muted-foreground/70"}`}>{shot.number}</span>
          {camera ? <span className="shrink-0 rounded border border-border/50 bg-secondary/50 px-1.5 py-px text-[10px] text-muted-foreground">{camera}</span> : null}
          <span className="shrink-0 text-[10px] text-muted-foreground/40">{shot.durationMs ? `${Math.round(shot.durationMs / 1000)}s` : isZh ? "自动" : "auto"}</span>
        </div>
        <p className={`text-xs leading-5 ${selected ? "font-medium text-primary" : "text-foreground/80"}`}>
          {visual || (isZh ? "画面待补充" : "No visual")}
        </p>
      </div>
      {/* 右列：旁白（分行显示，行间水平线分隔，标点隐藏） */}
      <div className={`min-w-0 px-3 py-2 ${selected ? "bg-primary/10" : "bg-background/60"}`}>
        {narrationLines.length > 0 ? (
          narrationLines.map((line, i) => (
            <p
              key={i}
              className={`text-xs leading-5 text-foreground/80 ${i > 0 ? "mt-1 border-t border-dashed border-border/40 pt-1" : ""}`}
            >
              {line}
            </p>
          ))
        ) : (
          <p className="text-xs leading-5 text-muted-foreground/40">{isZh ? "（无旁白）" : "(none)"}</p>
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// 右侧：分镜详情编辑面板
// ---------------------------------------------------------------------------

function ShotDetails({ shot, isZh }: { readonly shot: UnifiedScriptShot; readonly isZh: boolean }) {
  return (
    <section className="min-h-0 flex-1 overflow-y-auto p-4" data-testid="story-script-details">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        {/* 标题行：场景 + 镜头号 + 景别（只显示一次） */}
        <div className="flex shrink-0 items-baseline gap-2">
          <p className="shrink-0 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{shot.scene}</p>
          <h2 className="truncate text-lg font-semibold">{isZh ? `镜头 ${shot.number}` : `Shot ${shot.number}`}</h2>
          {shot.camera ? <span className="shrink-0 text-xs text-muted-foreground">{shot.camera}</span> : null}
        </div>

        {/* 字段区：只保留核心信息，去掉冗余 */}
        <div className="space-y-3">
          <Field label={isZh ? "分镜内容" : "Visual"}>
            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground/80">{shot.visual || (isZh ? "画面待补充" : "No visual description")}</p>
          </Field>
          <Field label={isZh ? "旁白" : "Narration"}>
            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground/80">{shot.subtitle || (isZh ? "无旁白" : "No narration")}</p>
          </Field>
          {shot.imagePrompt ? (
            <Field label={isZh ? "图像提示词" : "Image prompt"}>
              <p className="whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">{shot.imagePrompt}</p>
            </Field>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function EmptyState({ text }: { readonly text: string }) {
  return <div className="flex min-h-56 items-center justify-center rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{text}</div>;
}

function ErrorState({ text }: { readonly text: string }) {
  return <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{text}</div>;
}
