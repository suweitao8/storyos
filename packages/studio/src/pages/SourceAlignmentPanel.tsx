import { useEffect, useMemo, useState } from "react";
import { Check, Film, Loader2, RefreshCw, Upload, X } from "lucide-react";

export interface SourceAlignmentFile {
  readonly key: string;
  readonly fileName: string;
  readonly downloadName: string;
  readonly size: number;
  readonly mimeType: string;
}

export interface SourceAlignmentSource {
  readonly sourceType: "bilibili" | "novel";
  readonly sourceName: string;
  readonly originalName: string;
  readonly importedAt: string;
  readonly files: ReadonlyArray<SourceAlignmentFile>;
}

export interface SourceAlignmentTimeline {
  readonly version: 1;
  readonly sourceFileKey: "sourceVideo";
  readonly durationSeconds: number;
  readonly scenes: ReadonlyArray<{
    readonly id: string;
    readonly startSeconds: number;
    readonly endSeconds: number;
    readonly thumbnailFile: string;
    readonly visualSummary: string;
  }>;
}

export interface SourceAlignmentAnchor {
  readonly id: string;
  readonly commentaryStartSeconds: number;
  readonly commentaryEndSeconds: number;
  readonly text: string;
}

export interface SourceAlignmentMatch {
  readonly id: string;
  readonly anchorId: string;
  readonly sceneId: string;
  readonly sourceStartSeconds: number;
  readonly sourceEndSeconds: number;
  readonly confidence: number;
  readonly reason: string;
  readonly status: "suggested" | "confirmed" | "rejected";
}

export interface SourceAlignmentData {
  readonly timeline: SourceAlignmentTimeline;
  readonly anchors: ReadonlyArray<SourceAlignmentAnchor>;
  readonly matches: ReadonlyArray<SourceAlignmentMatch>;
}

export interface SourceAlignmentPanelProps {
  readonly craftId: string;
  readonly source: SourceAlignmentSource | null;
  readonly initialData?: SourceAlignmentData | null;
}

export function SourceAlignmentPanel({ craftId, source, initialData = null }: SourceAlignmentPanelProps) {
  const [data, setData] = useState<SourceAlignmentData | null>(initialData);
  const [busy, setBusy] = useState<"upload" | "timeline" | "alignment" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState(initialData?.matches[0]?.id ?? null);
  const selectedMatch = useMemo(
    () => data?.matches.find((match) => match.id === selectedMatchId) ?? data?.matches[0] ?? null,
    [data, selectedMatchId],
  );
  const selectedScene = data?.timeline.scenes.find((scene) => scene.id === selectedMatch?.sceneId) ?? null;
  const selectedAnchor = data?.anchors.find((anchor) => anchor.id === selectedMatch?.anchorId) ?? null;
  const [startSeconds, setStartSeconds] = useState(selectedMatch?.sourceStartSeconds ?? 0);
  const [endSeconds, setEndSeconds] = useState(selectedMatch?.sourceEndSeconds ?? 1);

  useEffect(() => {
    if (!selectedMatch) return;
    setStartSeconds(selectedMatch.sourceStartSeconds);
    setEndSeconds(selectedMatch.sourceEndSeconds);
  }, [selectedMatch?.id, selectedMatch?.sourceStartSeconds, selectedMatch?.sourceEndSeconds]);

  const reload = async (): Promise<void> => {
    const response = await fetch(`/api/v1/crafts/${craftId}/source/timeline`);
    if (!response.ok) throw new Error("原片时间线尚未生成");
    setData(await response.json() as SourceAlignmentData);
  };

  const uploadOriginal = async (file: File): Promise<void> => {
    setBusy("upload");
    setError(null);
    try {
      const response = await fetch(`/api/v1/crafts/${craftId}/source/original-video`, {
        method: "POST",
        headers: { "Content-Type": file.type || "video/mp4", "X-Filename": encodeURIComponent(file.name) },
        body: file,
      });
      if (!response.ok) throw new Error("原片上传失败");
      await reload().catch(() => undefined);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : String(uploadError));
    } finally {
      setBusy(null);
    }
  };

  const buildTimeline = async (): Promise<void> => {
    setBusy("timeline");
    setError(null);
    try {
      const response = await fetch(`/api/v1/crafts/${craftId}/source/timeline/build`, { method: "POST" });
      if (!response.ok) throw new Error("原片关键帧生成失败");
      await reload();
    } catch (timelineError) {
      setError(timelineError instanceof Error ? timelineError.message : String(timelineError));
    } finally {
      setBusy(null);
    }
  };

  const runAlignment = async (): Promise<void> => {
    setBusy("alignment");
    setError(null);
    try {
      const response = await fetch(`/api/v1/crafts/${craftId}/source/alignment`, { method: "POST" });
      if (!response.ok) throw new Error("原片匹配失败");
      setData(await response.json() as SourceAlignmentData);
    } catch (alignmentError) {
      setError(alignmentError instanceof Error ? alignmentError.message : String(alignmentError));
    } finally {
      setBusy(null);
    }
  };

  const updateMatch = async (status: "confirmed" | "rejected"): Promise<void> => {
    if (!selectedMatch) return;
    const response = await fetch(`/api/v1/crafts/${craftId}/source/matches/${selectedMatch.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, startSeconds, endSeconds }),
    });
    if (!response.ok) {
      setError("保存原片匹配失败");
      return;
    }
    await reload();
  };

  const sourceVideo = source?.files.some((file) => file.key === "sourceVideo");
  if (!sourceVideo) {
    return (
      <section className="space-y-4 rounded-2xl border border-dashed border-border p-5">
        <div className="flex items-center gap-2 text-base font-semibold"><Film size={18} />原片素材</div>
        <p className="text-sm leading-6 text-muted-foreground">请上传你有权使用的电影原片。系统只会从原片关键帧中匹配画面，不会把解说视频截图当作电影素材。</p>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
          <Upload size={15} />{busy === "upload" ? "上传中…" : "上传原片"}
          <input className="hidden" type="file" accept="video/*,.mkv,.mov" disabled={busy !== null} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadOriginal(file); }} />
        </label>
        {error && <div className="text-sm text-destructive">{error}</div>}
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-base font-semibold"><Film size={18} />原片素材</div>
          <p className="mt-1 text-xs text-muted-foreground">候选画面来自原片；确认后才允许进入后续视频生产。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void buildTimeline()} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs hover:bg-secondary/30 disabled:opacity-50"><RefreshCw size={13} />{busy === "timeline" ? "生成中…" : "生成关键帧"}</button>
          <button type="button" onClick={() => void runAlignment()} disabled={busy !== null || !data?.timeline} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 px-3 py-2 text-xs text-primary hover:bg-primary/10 disabled:opacity-50"><RefreshCw size={13} />{busy === "alignment" ? "匹配中…" : "重新匹配"}</button>
        </div>
      </div>
      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>}
      {!data?.timeline ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">还没有原片时间线，请先生成关键帧。</div>
      ) : data.matches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">还没有匹配结果，请点击“重新匹配”。</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div className="space-y-2">
            {data.matches.map((match) => {
              const anchor = data.anchors.find((item) => item.id === match.anchorId);
              const suggestedOnly = match.status === "suggested" && match.confidence < 0.6;
              return (
                <button key={match.id} type="button" onClick={() => setSelectedMatchId(match.id)} className={`w-full rounded-xl border p-3 text-left ${selectedMatch?.id === match.id ? "border-primary bg-primary/[0.05]" : "border-border/60 hover:bg-secondary/20"}`}>
                  <div className="flex items-center justify-between gap-2 text-xs"><span className="font-medium">{anchor?.text ?? "未命名解说段"}</span><span className={match.status === "confirmed" ? "text-emerald-600" : suggestedOnly ? "text-amber-600" : "text-muted-foreground"}>{match.status === "confirmed" ? "已确认" : suggestedOnly ? "仅供建议" : "待确认"}</span></div>
                  <div className="mt-1 text-xs text-muted-foreground">原片 {match.sourceStartSeconds.toFixed(1)}s–{match.sourceEndSeconds.toFixed(1)}s · 置信度 {Math.round(match.confidence * 100)}%</div>
                </button>
              );
            })}
          </div>
          {selectedMatch && selectedScene && (
            <div className="space-y-3 rounded-xl border border-border/60 bg-background/40 p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <img className="aspect-video w-full rounded-lg bg-black object-cover" src={`/api/v1/crafts/${craftId}/source/timeline/frame/${selectedScene.id}`} alt="原片关键帧" />
                <video className="aspect-video w-full rounded-lg bg-black" controls preload="metadata" src={`/api/v1/crafts/${craftId}/source/sourceVideo#t=${startSeconds},${endSeconds}`} />
              </div>
              <div className="text-sm leading-6">{selectedAnchor?.text ?? "未命名解说段"}</div>
              <div className="text-xs text-muted-foreground">候选窗口：{selectedScene.startSeconds}s–{selectedScene.endSeconds}s。{selectedMatch.reason}</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-muted-foreground">开始秒数<input type="number" min={selectedScene.startSeconds} max={selectedScene.endSeconds} step="0.1" value={startSeconds} onChange={(event) => setStartSeconds(Number(event.target.value))} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" /></label>
                <label className="text-xs text-muted-foreground">结束秒数<input type="number" min={selectedScene.startSeconds} max={selectedScene.endSeconds} step="0.1" value={endSeconds} onChange={(event) => setEndSeconds(Number(event.target.value))} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" /></label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={selectedMatch.status === "suggested" && selectedMatch.confidence < 0.6} onClick={() => void updateMatch("confirmed")} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"><Check size={13} />确认使用原片</button>
                <button type="button" onClick={() => void updateMatch("rejected")} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs hover:bg-secondary/30"><X size={13} />拒绝</button>
              </div>
            </div>
          )}
        </div>
      )}
      {busy && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 size={13} className="animate-spin" />正在处理原片素材…</div>}
    </section>
  );
}
