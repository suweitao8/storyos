import { useEffect, useMemo, useState } from "react";
import { Image, RefreshCw, Sparkles } from "lucide-react";

import type { Theme } from "../hooks/use-theme";
import { fetchJson, postApi, useApi } from "../hooks/use-api";

export type StoryAssetKind = "character" | "scene" | "prop";
export type StoryAssetImageStatus = "missing" | "generating" | "ready" | "error";
export type StoryAssetFilter = StoryAssetKind | "all";
export type StoryAssetTextField = "name" | "summary" | "imagePrompt" | "details";

export interface StoryAsset {
  readonly id: string;
  readonly kind: StoryAssetKind;
  readonly name: string;
  readonly summary: string;
  readonly details: Readonly<Record<string, string>>;
  readonly imagePrompt: string;
  readonly image?: {
    readonly status: StoryAssetImageStatus;
    readonly path?: string;
    readonly error?: string;
  };
}

export interface StoryAssetManifest {
  readonly version?: number;
  readonly storyId?: string;
  readonly updatedAt?: string;
  readonly assets: ReadonlyArray<StoryAsset>;
}

export function filterStoryAssets(
  assets: ReadonlyArray<StoryAsset>,
  filter: StoryAssetFilter,
): ReadonlyArray<StoryAsset> {
  return filter === "all" ? assets : assets.filter((asset) => asset.kind === filter);
}

export function chooseStoryAssetId(
  assets: ReadonlyArray<StoryAsset>,
  selectedId: string | null,
): string | null {
  if (selectedId && assets.some((asset) => asset.id === selectedId)) return selectedId;
  return assets[0]?.id ?? null;
}

export function hasUnreadyStoryAssetImages(assets: ReadonlyArray<StoryAsset>): boolean {
  return assets.some((asset) => (asset.image?.status ?? "missing") !== "ready");
}

export function buildStoryAssetImagePath(kind: "book" | "short", storyId: string, assetId: string): string {
  return `${buildStoryAssetsPath(kind, storyId)}/images/${encodeURIComponent(assetId)}`;
}

export function buildStoryAssetGenerateImagePath(kind: "book" | "short", storyId: string, assetId: string): string {
  return `${buildStoryAssetsPath(kind, storyId)}/${encodeURIComponent(assetId)}/generate-image`;
}

export function buildStoryAssetGenerateMissingImagesPath(kind: "book" | "short", storyId: string): string {
  return `${buildStoryAssetsPath(kind, storyId)}/generate-missing-images`;
}

export function getStoryAssetActionLabel(status: StoryAssetImageStatus, isZh: boolean): string {
  if (status === "generating") return isZh ? "生成中..." : "Generating...";
  if (status === "ready" || status === "error") return isZh ? "重新生成" : "Regenerate image";
  return isZh ? "生成图片" : "Generate image";
}

export function chooseStoryAssetAction<T>(
  callback: ((value: T) => void | Promise<void>) | undefined,
  fallback: (value: T) => void | Promise<void>,
): (value: T) => void | Promise<void> {
  return callback ?? fallback;
}

export function getStoryAssetStatusLabel(status: StoryAssetImageStatus, isZh: boolean): string {
  const labels: Record<StoryAssetImageStatus, { readonly zh: string; readonly en: string }> = {
    missing: { zh: "缺图", en: "Missing" },
    generating: { zh: "生成中", en: "Generating" },
    ready: { zh: "已就绪", en: "Ready" },
    error: { zh: "生成失败", en: "Error" },
  };
  return labels[status][isZh ? "zh" : "en"];
}

export function getAssetEmptyState(isZh: boolean): string {
  return isZh ? "还没有故事资产" : "No story assets yet";
}

export function buildStoryAssetsPath(kind: "book" | "short", storyId: string): string {
  return `/stories/${kind}/${encodeURIComponent(storyId)}/assets`;
}

interface StoryAssetsPanelProps {
  readonly kind: "book" | "short";
  readonly storyId: string | null;
  readonly theme: Theme;
  readonly isZh: boolean;
  readonly onExtractAssets?: () => void | Promise<void>;
  readonly onGenerateAsset?: (asset: StoryAsset) => void | Promise<void>;
  readonly onGenerateMissing?: () => void | Promise<void>;
  readonly onEditAsset?: (
    assetId: string,
    field: StoryAssetTextField,
    value: string,
    detailKey?: string,
  ) => void | Promise<void>;
}

const KIND_LABELS: Record<StoryAssetKind, { readonly zh: string; readonly en: string }> = {
  character: { zh: "角色", en: "Characters" },
  scene: { zh: "场景", en: "Scenes" },
  prop: { zh: "道具", en: "Props" },
};

const STATUS_CLASS: Record<StoryAssetImageStatus, string> = {
  missing: "border-border/60 bg-secondary/40 text-muted-foreground",
  generating: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  ready: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  error: "border-destructive/30 bg-destructive/10 text-destructive",
};

function actionLabel(isZh: boolean, action: "extract" | "generateAll"): string {
  if (action === "extract") return isZh ? "提取资产" : "Extract assets";
  return isZh ? "生成全部缺失图片" : "Generate all missing images";
}

export function StoryAssetsPanel({
  kind,
  storyId,
  theme: _theme,
  isZh,
  onExtractAssets,
  onGenerateAsset,
  onGenerateMissing,
  onEditAsset,
}: StoryAssetsPanelProps) {
  const path = storyId ? buildStoryAssetsPath(kind, storyId) : "";
  const { data, loading, error, refetch } = useApi<StoryAssetManifest>(path);
  const [filter, setFilter] = useState<StoryAssetFilter>("all");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const assets = data?.assets ?? [];
  const visibleAssets = useMemo(() => filterStoryAssets(assets, filter), [assets, filter]);
  const selectedAsset = visibleAssets.find((asset) => asset.id === selectedAssetId) ?? visibleAssets[0] ?? null;
  const basePath = path;

  useEffect(() => {
    setSelectedAssetId((currentId) => chooseStoryAssetId(visibleAssets, currentId));
  }, [visibleAssets]);

  const runAction = async (key: string, action: () => void | Promise<void>) => {
    setBusyAction(key);
    setActionError(null);
    try {
      await action();
      await refetch();
    } catch (actionFailure) {
      setActionError(actionFailure instanceof Error ? actionFailure.message : String(actionFailure));
    } finally {
      setBusyAction(null);
    }
  };

  const extractAssets = () => runAction("extract", onExtractAssets ?? (() => postApi(`${basePath}/extract`)));
  const generateMissing = () => runAction(
    "generate-all",
    onGenerateMissing ?? (() => postApi(buildStoryAssetGenerateMissingImagesPath(kind, storyId ?? ""))),
  );
  const generateAsset = (asset: StoryAsset) => runAction(
    `generate:${asset.id}`,
    () => chooseStoryAssetAction(
      onGenerateAsset,
      () => postApi(buildStoryAssetGenerateImagePath(kind, storyId ?? "", asset.id)),
    )(asset),
  );
  const editAsset = (asset: StoryAsset, field: StoryAssetTextField, value: string, detailKey?: string) => {
    if (onEditAsset) {
      void runAction(
        `edit:${asset.id}:${field}:${detailKey ?? ""}`,
        () => onEditAsset(asset.id, field, value, detailKey),
      );
      return;
    }
    const body = field === "details" && detailKey
      ? { details: { ...asset.details, [detailKey]: value } }
      : { [field]: value };
    void runAction(
      `edit:${asset.id}:${field}:${detailKey ?? ""}`,
      () => fetchJson(`${basePath}/${encodeURIComponent(asset.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  };

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-card/20" data-testid="story-assets-panel">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border/40 px-4 py-3">
        <div>
          <div className="flex items-center gap-2.5">
            <Image size={18} className="text-primary" />
            <h1 className="text-base font-semibold">{isZh ? "故事资产" : "Story assets"}</h1>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isZh ? "管理角色、场景和道具的文字设定与图片状态。" : "Manage character, scene, and prop descriptions and image status."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void refetch()} disabled={loading || !storyId} className="rounded-lg border border-border/60 p-2 text-muted-foreground hover:text-foreground disabled:opacity-40" aria-label={isZh ? "刷新资产" : "Refresh assets"}>
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
          <button type="button" onClick={() => void extractAssets()} disabled={!storyId || busyAction !== null} className="rounded-lg border border-border/60 px-3 py-2 text-sm hover:border-primary/50 disabled:opacity-40">
            {actionLabel(isZh, "extract")}
          </button>
          <button type="button" onClick={() => void generateMissing()} disabled={!storyId || busyAction !== null || !hasUnreadyStoryAssetImages(assets)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40">
            <Sparkles size={14} />
            {actionLabel(isZh, "generateAll")}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 md:p-4">
        {!storyId ? (
          <EmptyState text={isZh ? "创建故事后，这里会显示资产。" : "Assets will appear after a story is created."} />
        ) : loading && !data ? (
          <EmptyState text={isZh ? "正在加载故事资产..." : "Loading story assets..."} />
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>
        ) : (
          <>
            {visibleAssets.length === 0 ? (
              <EmptyState text={getAssetEmptyState(isZh)} />
            ) : (
              <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(170px,220px)_minmax(0,1fr)]">
                <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border/60 bg-card/40" data-testid="story-assets-list">
                  <div className="shrink-0 border-b border-border/50 px-3 py-2.5">
                    <p className="text-xs font-semibold text-foreground">{isZh ? "资产列表" : "Assets"}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>{isZh ? "全部" : "All"}</FilterButton>
                      {(Object.keys(KIND_LABELS) as StoryAssetKind[]).map((kindName) => (
                        <FilterButton key={kindName} active={filter === kindName} onClick={() => setFilter(kindName)}>
                          {KIND_LABELS[kindName][isZh ? "zh" : "en"]}
                        </FilterButton>
                      ))}
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
                    {visibleAssets.map((asset) => {
                      const isSelected = selectedAsset?.id === asset.id;
                      return (
                        <button
                          key={asset.id}
                          type="button"
                          data-testid={`story-asset-item-${asset.id}`}
                          aria-pressed={isSelected}
                          onClick={() => setSelectedAssetId(asset.id)}
                          className={`mb-1 flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition-colors last:mb-0 ${isSelected ? "bg-primary/10 font-medium text-primary" : "text-foreground/80 hover:bg-secondary/70 hover:text-foreground"}`}
                        >
                          <span className="truncate">{asset.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </aside>
                <div className="min-h-0 flex flex-col gap-3">
                  {actionError ? <p className="shrink-0 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{actionError}</p> : null}
                  {selectedAsset ? (
                    <AssetDetails
                      key={selectedAsset.id}
                      asset={selectedAsset}
                      isZh={isZh}
                      imageUrl={storyId && selectedAsset.image?.status === "ready" ? `/api/v1${buildStoryAssetImagePath(kind, storyId, selectedAsset.id)}` : undefined}
                      busy={busyAction === `generate:${selectedAsset.id}`}
                      onGenerate={() => void generateAsset(selectedAsset)}
                      onEdit={(field, value, detailKey) => editAsset(selectedAsset, field, value, detailKey)}
                    />
                  ) : null}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function FilterButton({ active, onClick, children }: { readonly active: boolean; readonly onClick: () => void; readonly children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${active ? "border-primary bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground"}`}>{children}</button>;
}

function EmptyState({ text }: { readonly text: string }) {
  return <div className="flex min-h-56 flex-1 items-center justify-center rounded-2xl border border-dashed border-border/60 text-center text-sm text-muted-foreground">{text}</div>;
}

function AssetDetails({
  asset,
  isZh,
  imageUrl,
  busy,
  onGenerate,
  onEdit,
}: {
  readonly asset: StoryAsset;
  readonly isZh: boolean;
  readonly imageUrl?: string;
  readonly busy: boolean;
  readonly onGenerate: () => void;
  readonly onEdit: (field: StoryAssetTextField, value: string, detailKey?: string) => void;
}) {
  const status = asset.image?.status ?? "missing";
  return (
    <section className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-border/60 bg-card/40 p-4" data-testid="story-asset-details">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(220px,34%)]">
        <div className="min-w-0 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{KIND_LABELS[asset.kind][isZh ? "zh" : "en"]}</p>
              <h2 className="mt-1 truncate text-lg font-semibold">{asset.name}</h2>
            </div>
            <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] ${STATUS_CLASS[status]}`}>{getStoryAssetStatusLabel(status, isZh)}</span>
          </div>
          <label className="block space-y-1.5 text-xs text-muted-foreground"><span>{isZh ? "名称" : "Name"}</span><input defaultValue={asset.name} onBlur={(event) => onEdit("name", event.target.value)} className="w-full rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm text-foreground outline-none focus:border-primary" /></label>
          <label className="block space-y-1.5 text-xs text-muted-foreground"><span>{isZh ? "摘要" : "Summary"}</span><textarea defaultValue={asset.summary} rows={3} onBlur={(event) => onEdit("summary", event.target.value)} className="w-full resize-y rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm leading-6 text-foreground outline-none focus:border-primary" /></label>
          <label className="block space-y-1.5 text-xs text-muted-foreground"><span>{isZh ? "图片提示词" : "Image prompt"}</span><textarea defaultValue={asset.imagePrompt} rows={3} onBlur={(event) => onEdit("imagePrompt", event.target.value)} className="w-full resize-y rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm leading-6 text-foreground outline-none focus:border-primary" /></label>
          {Object.entries(asset.details).map(([key, value]) => <label key={key} className="block space-y-1.5 text-xs text-muted-foreground"><span>{key}</span><textarea defaultValue={value} rows={2} onBlur={(event) => onEdit("details", event.target.value, key)} className="w-full resize-y rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm leading-6 text-foreground outline-none focus:border-primary" /></label>)}
        </div>
        <div className="space-y-3 xl:sticky xl:top-0 xl:self-start">
          {imageUrl ? <img src={imageUrl} alt={asset.name} className="aspect-[4/3] w-full rounded-lg border border-border/50 object-cover" /> : <div className="flex aspect-[4/3] items-center justify-center rounded-lg border border-dashed border-border/60 bg-secondary/60 p-4 text-center" data-testid={`asset-placeholder-${asset.id}`}><span className="text-base font-semibold text-foreground/80">{asset.name}</span></div>}
          <p className={`rounded-lg border px-3 py-2 text-xs ${STATUS_CLASS[status]}`}>{getStoryAssetStatusLabel(status, isZh)}{status === "error" && asset.image?.error ? ` · ${asset.image.error}` : ""}</p>
          <button type="button" onClick={onGenerate} disabled={busy || status === "generating"} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm hover:border-primary/50 disabled:opacity-50"><Sparkles size={14} />{busy ? (isZh ? "正在生成..." : "Generating...") : getStoryAssetActionLabel(status, isZh)}</button>
        </div>
      </div>
    </section>
  );
}
