import { useCallback, useEffect, useState } from "react";
import { fetchJson } from "../hooks/use-api";
import type { Theme } from "../hooks/use-theme";
import type { TFunction } from "../hooks/use-i18n";
import { useColors } from "../hooks/use-colors";
import { Stethoscope, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface DoctorChecks {
  readonly inkosJson: boolean;
  readonly projectEnv: boolean;
  readonly globalEnv: boolean;
  readonly booksDir: boolean;
  readonly llmConnected: boolean;
  readonly bookCount: number;
}

// Module-level cache so switching to the diagnostics tab does not re-trigger
// the (slow, LLM-probing) /doctor request every time. The cache is populated
// on the first fetch and updated whenever the user clicks "recheck".
let doctorCache: DoctorChecks | null = null;

function CheckRow({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border/30 last:border-0">
      {ok ? (
        <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
      ) : (
        <XCircle size={18} className="text-destructive shrink-0" />
      )}
      <span className="text-sm font-medium flex-1">{label}</span>
      {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
    </div>
  );
}

export function EnvironmentDiagnostics({ theme, t }: { theme: Theme; t: TFunction }) {
  const c = useColors(theme);
  const [data, setData] = useState<DoctorChecks | null>(doctorCache);
  const [loading, setLoading] = useState<boolean>(doctorCache === null);

  const runCheck = useCallback(async () => {
    setLoading(true);
    try {
      const json = await fetchJson<DoctorChecks>("/doctor");
      doctorCache = json;
      setData(json);
    } catch {
      // Leave the previous result (if any) in place on transient errors.
    } finally {
      setLoading(false);
    }
  }, []);

  // Only auto-fetch when there is no cached result (first visit).
  useEffect(() => {
    if (doctorCache === null) void runCheck();
  }, [runCheck]);

  return (
    <section className="rounded-2xl border border-border/50 bg-card/70 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl bg-primary/10 p-2 text-primary"><Stethoscope size={18} /></div>
          <div>
            <h2 className="text-base font-bold">{t("doctor.title")}</h2>
          </div>
        </div>
        <button onClick={() => void runCheck()} disabled={loading} className={`px-4 py-2 text-sm rounded-lg ${c.btnSecondary} disabled:opacity-50`}>
          {loading && data ? <Loader2 size={14} className="mr-1.5 inline animate-spin" /> : null}
          {t("doctor.recheck")}
        </button>
      </div>

      {!data ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      ) : (
        <div className={`border ${c.cardStatic} rounded-xl p-4`}>
          <CheckRow label={t("doctor.inkosJson")} ok={data.inkosJson} />
          <CheckRow label={t("doctor.projectEnv")} ok={data.projectEnv} />
          <CheckRow label={t("doctor.globalEnv")} ok={data.globalEnv} />
          <CheckRow label={t("doctor.booksDir")} ok={data.booksDir} detail={`${data.bookCount} book(s) / books/`} />
          <CheckRow label={t("doctor.llmApi")} ok={data.llmConnected} detail={data.llmConnected ? t("doctor.connected") : t("doctor.failed")} />
        </div>
      )}

      {data && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium ${
          data.inkosJson && (data.projectEnv || data.globalEnv) && data.llmConnected
            ? "bg-emerald-500/10 text-emerald-600"
            : "bg-amber-500/10 text-amber-600"
        }`}>
          {data.inkosJson && (data.projectEnv || data.globalEnv) && data.llmConnected
            ? t("doctor.allPassed")
            : t("doctor.someFailed")
          }
        </div>
      )}
    </section>
  );
}

/** @deprecated Use EnvironmentDiagnostics from the System settings page. */
export const DoctorView = EnvironmentDiagnostics;
