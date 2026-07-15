import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";

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

export function shouldShowStoryAssetEmptyState(
  manifest: StoryAssetManifest | null,
  storyId: string | null,
  loading: boolean,
): boolean {
  return !loading && (!storyId || manifest?.assets.length === 0);
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

export function getStoryNoContentState(isZh: boolean): string {
  return isZh ? "暂无内容" : "No content";
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

const KIND_ORDER: ReadonlyArray<StoryAssetKind> = ["character", "scene", "prop"];

const STATUS_DOT: Record<StoryAssetImageStatus, string> = {
  missing: "bg-muted-foreground/40",
  generating: "bg-amber-500",
  ready: "bg-emerald-500",
  error: "bg-destructive",
};

const STATUS_CLASS: Record<StoryAssetImageStatus, string> = {
  missing: "border-border/60 bg-secondary/40 text-muted-foreground",
  generating: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  ready: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  error: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function StoryAssetsPanel({
  kind,
  storyId,
  theme: _theme,
  isZh,
  onExtractAssets: _onExtractAssets,
  onGenerateAsset,
  onGenerateMissing: _onGenerateMissing,
  onEditAsset,
}: StoryAssetsPanelProps) {
  const path = storyId ? buildStoryAssetsPath(kind, storyId) : "";
  const { data, loading, error, refetch } = useApi<StoryAssetManifest>(path);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [backgroundPendingAssetId, setBackgroundPendingAssetId] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const assets = data?.assets ?? [];
  const showEmptyState = shouldShowStoryAssetEmptyState(data, storyId, loading);

  // 按类型分组
  const grouped = useMemo(() => {
    const map: Record<StoryAssetKind, ReadonlyArray<StoryAsset>> = {
      character: [],
      scene: [],
      prop: [],
    };
    for (const asset of assets) {
      map[asset.kind] = [...map[asset.kind], asset];
    }
    return map;
  }, [assets]);

  const allAssets = useMemo(() => Object.values(grouped).flat(), [grouped]);

  const selectedAsset = allAssets.find((a) => a.id === selectedAssetId) ?? allAssets[0] ?? null;

  useEffect(() => {
    setSelectedAssetId((currentId) => chooseStoryAssetId(allAssets, currentId));
  }, [allAssets]);

  useEffect(() => {
    if (!backgroundPendingAssetId) return;
    const asset = assets.find((candidate) => candidate.id === backgroundPendingAssetId);
    if (asset?.image?.status === "ready" || asset?.image?.status === "error") {
      setBackgroundPendingAssetId(null);
      return;
    }
    const interval = window.setInterval(() => { void refetch(); }, 4_000);
    return () => window.clearInterval(interval);
  }, [assets, backgroundPendingAssetId, refetch]);

  const runAction = async (key: string, action: () => void | Promise<void>) => {
    setBusyAction(key);
    try {
      await action();
      await refetch();
    } finally {
      setBusyAction(null);
    }
  };

  const generateAsset = async (asset: StoryAsset) => {
    const key = `generate:${asset.id}`;
    setBusyAction(key);
    try {
      if (onGenerateAsset) await onGenerateAsset(asset);
      else await postApi(`${buildStoryAssetGenerateImagePath(kind, storyId ?? "", asset.id)}?background=true`);
      setBackgroundPendingAssetId(asset.id);
    } finally {
      setBusyAction(null);
    }
  };

  const editAsset = (asset: StoryAsset, field: StoryAssetTextField, value: string, detailKey?: string) => {
    if (onEditAsset) {
      void runAction(
        `edit:${asset.id}:${field}:${detailKey ?? ""}`,
        () => onEditAsset(asset.id, field, value, detailKey),
      );
      return;
    }
    const body =
      field === "details" && detailKey
        ? { details: { ...asset.details, [detailKey]: value } }
        : { [field]: value };
    void runAction(
      `edit:${asset.id}:${field}:${detailKey ?? ""}`,
      () =>
        fetchJson(`${path}/${encodeURIComponent(asset.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
    );
  };

  if (showEmptyState) {
    return (
      <section className="flex h-full min-h-0 w-full items-center justify-center bg-card/20" data-testid="story-assets-panel">
        <EmptyState text={getStoryNoContentState(isZh)} />
      </section>
    );
  }

  return (
    <section className="flex h-full min-h-0 w-full overflow-hidden bg-card/20" data-testid="story-assets-panel">
      {!storyId ? (
        <EmptyState text={isZh ? "创建故事后，这里会显示资产。" : "Assets will appear after a story is created."} />
      ) : loading && !data ? (
        <EmptyState text={isZh ? "正在加载故事资产..." : "Loading story assets..."} />
      ) : error ? (
        <div className="m-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>
      ) : assets.length === 0 ? (
        <EmptyState text={getAssetEmptyState(isZh)} />
      ) : (
        <div className="flex h-full min-h-0 w-full" data-testid="story-assets-list">
          {/* 左半边：三个分类列表水平并排 */}
          <div className="flex h-full min-h-0 w-1/2 shrink-0 border-r border-border/40">
            {KIND_ORDER.map((kindName, index) => (
              <div
                key={kindName}
                className={`flex h-full min-w-0 flex-1 flex-col overflow-hidden ${
                  index < KIND_ORDER.length - 1 ? "border-r border-border/30" : ""
                }`}
              >
                <AssetGroup
                  kind={kindName}
                  isZh={isZh}
                  assets={grouped[kindName]}
                  selectedId={selectedAsset?.id ?? null}
                  onSelect={setSelectedAssetId}
                />
              </div>
            ))}
          </div>

          {/* 右半边：编辑区铺满 */}
          <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
            {selectedAsset ? (
              <AssetDetails
                key={selectedAsset.id}
                asset={selectedAsset}
                isZh={isZh}
                imageUrl={
                  storyId && selectedAsset.image?.status === "ready"
                    ? `/api/v1${buildStoryAssetImagePath(kind, storyId, selectedAsset.id)}`
                    : undefined
                }
                busy={busyAction === `generate:${selectedAsset.id}` || backgroundPendingAssetId === selectedAsset.id}
                onGenerate={() => void generateAsset(selectedAsset)}
                onEdit={(field, value, detailKey) => editAsset(selectedAsset, field, value, detailKey)}
              />
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// 左侧：单个分类列表（角色 / 场景 / 道具）
// ---------------------------------------------------------------------------

function AssetGroup({
  kind,
  isZh,
  assets,
  selectedId,
  onSelect,
}: {
  readonly kind: StoryAssetKind;
  readonly isZh: boolean;
  readonly assets: ReadonlyArray<StoryAsset>;
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
}) {
  return (
    <>
      <div className="shrink-0 border-b border-border/30 px-2 py-2 text-center">
        <p className="text-xs font-semibold text-muted-foreground">
          {KIND_LABELS[kind][isZh ? "zh" : "en"]}
          <span className="ml-1 text-muted-foreground/50">{assets.length}</span>
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {assets.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground/40">{isZh ? "暂无" : "Empty"}</p>
        ) : (
          assets.map((asset) => {
            const isSelected = selectedId === asset.id;
            const status = asset.image?.status ?? "missing";
            return (
              <button
                key={asset.id}
                type="button"
                data-testid={`story-asset-item-${asset.id}`}
                aria-pressed={isSelected}
                onClick={() => onSelect(asset.id)}
                className={`flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-sm transition-colors ${
                  isSelected
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-foreground/80 hover:bg-secondary/60 hover:text-foreground"
                }`}
              >
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[status]}`} />
                <span className="truncate">{asset.name}</span>
              </button>
            );
          })
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// 右侧：资产编辑区（铺满）
// ---------------------------------------------------------------------------

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
    <section className="min-h-0 flex-1 overflow-y-auto bg-card/20 p-4" data-testid="story-asset-details">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {/* 标题行：左侧分类标签，右侧状态+生成按钮，紧凑一行 */}
        <div className="flex shrink-0 items-center justify-between gap-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {KIND_LABELS[asset.kind][isZh ? "zh" : "en"]}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-[11px] ${STATUS_CLASS[status]}`}>
              {getStoryAssetStatusLabel(status, isZh)}
            </span>
            <button
              type="button"
              onClick={onGenerate}
              disabled={busy || status === "generating"}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-sm hover:border-primary/50 disabled:opacity-50"
            >
              <Sparkles size={14} />
              {busy ? (isZh ? "正在生成..." : "Generating...") : getStoryAssetActionLabel(status, isZh)}
            </button>
          </div>
        </div>

        {/* 图片预览 */}
        <div className="shrink-0">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={asset.name}
              className="aspect-[16/9] w-full rounded-xl border border-border/50 object-cover"
            />
          ) : (
            <div
              className="flex aspect-[16/9] items-center justify-center rounded-xl border border-dashed border-border/60 bg-secondary/40"
              data-testid={`asset-placeholder-${asset.id}`}
            >
              <span className="text-base font-semibold text-foreground/60">{asset.name}</span>
            </div>
          )}
        </div>

        {/* 表单字段 */}
        <div className="min-h-0 flex-1 space-y-4">
          <Field label={isZh ? "名称" : "Name"}>
            <input
              defaultValue={asset.name}
              onBlur={(e) => onEdit("name", e.target.value)}
              className="w-full rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </Field>
          <Field label={isZh ? "摘要" : "Summary"}>
            <textarea
              defaultValue={asset.summary}
              rows={3}
              onBlur={(e) => onEdit("summary", e.target.value)}
              className="w-full resize-y rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm leading-6 text-foreground outline-none focus:border-primary"
            />
          </Field>
          <Field label={isZh ? "图片提示词" : "Image prompt"}>
            <textarea
              defaultValue={asset.imagePrompt}
              rows={6}
              onBlur={(e) => onEdit("imagePrompt", e.target.value)}
              className="w-full resize-y rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm leading-6 text-foreground outline-none focus:border-primary"
            />
          </Field>
          {Object.entries(asset.details).map(([key, value]) => (
            <Field key={key} label={key}>
              <textarea
                defaultValue={value}
                rows={2}
                onBlur={(e) => onEdit("details", e.target.value, key)}
                className="w-full resize-y rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm leading-6 text-foreground outline-none focus:border-primary"
              />
            </Field>
          ))}
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5 text-xs text-muted-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}

function EmptyState({ text }: { readonly text: string }) {
  return (
    <div className="flex min-h-56 flex-1 items-center justify-center rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
