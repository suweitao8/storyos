import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { fetchJson } from "../hooks/use-api";
import { tr } from "../lib/app-language";
import { useServiceStore } from "../store/service";
import { TextModelConfigPanel } from "./ServiceDetailPage";

interface Nav {
  toDashboard: () => void;
  toServiceDetail: (id: string) => void;
}

interface ProviderInfo {
  readonly service: string;
  readonly label: string;
  readonly baseUrl: string;
  readonly defaultModel: string;
  readonly models: readonly string[];
  readonly connected: boolean;
}

interface CoverConfigPayload {
  readonly service: string | null;
  readonly model: string | null;
  readonly providers: readonly ProviderInfo[];
}

interface VoiceConfigPayload {
  readonly service: string | null;
  readonly model: string | null;
  readonly providers: readonly ProviderInfo[];
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-lg border border-border/30 p-5">
      <div className="mb-3 h-4 w-24 rounded bg-muted" />
      <div className="space-y-2">
        <div className="h-10 rounded-lg bg-muted/40" />
        <div className="h-10 rounded-lg bg-muted/40" />
        <div className="h-10 rounded-lg bg-muted/40" />
      </div>
    </div>
  );
}

function resolveSingleModel(
  provider: { readonly defaultModel: string; readonly models: readonly string[] } | undefined,
  currentModel: string,
  fallbackModel: string,
): string {
  if (provider?.defaultModel && provider.models.includes(provider.defaultModel)) {
    return provider.defaultModel;
  }
  if (provider?.models[0]) {
    return provider.models[0];
  }
  return currentModel || fallbackModel;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="block text-xs font-medium text-muted-foreground/70">{label}</span>
      {children}
    </label>
  );
}

function ReadonlyValue({ value }: { value: string }) {
  return (
    <input
      type="text"
      value={value}
      readOnly
      className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground"
    />
  );
}

function CoverConfigCard() {
  const [providers, setProviders] = useState<readonly ProviderInfo[]>([]);
  const [service, setService] = useState("grsai");
  const [model, setModel] = useState("gpt-image-2");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "testing" | "saved" | "error">("loading");
  const [message, setMessage] = useState("");
  const [configLoaded, setConfigLoaded] = useState(false);
  const [secretLoaded, setSecretLoaded] = useState(false);
  const saveTimerRef = useRef<number | null>(null);
  const savedSnapshotRef = useRef("");

  const selected = providers.find((provider) => provider.service === service);
  const modelOptions = useMemo(() => {
    const resolved = resolveSingleModel(selected, model, "gpt-image-2");
    return resolved ? [resolved] : [];
  }, [model, selected]);

  useEffect(() => {
    let cancelled = false;
    void fetchJson<CoverConfigPayload>("/cover/config")
      .then((payload) => {
        if (cancelled) return;
        setProviders(payload.providers);
        const nextService = payload.service ?? payload.providers[0]?.service ?? "grsai";
        const provider = payload.providers.find((item) => item.service === nextService) ?? payload.providers[0];
        setService(nextService);
        setModel(resolveSingleModel(provider, payload.model ?? "", "gpt-image-2"));
        setStatus("idle");
        setConfigLoaded(true);
      })
      .catch((error) => {
        if (cancelled) return;
        setStatus("error");
        setMessage(error instanceof Error ? error.message : tr("读取图片配置失败", "Failed to load image config"));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!service) return;
    let cancelled = false;
    setSecretLoaded(false);
    void fetchJson<{ apiKey?: string }>(`/cover/secret/${encodeURIComponent(service)}`)
      .then((payload) => {
        if (cancelled) return;
        setApiKey(payload.apiKey ?? "");
      })
      .catch(() => {
        if (!cancelled) setApiKey("");
      })
      .finally(() => {
        if (!cancelled) setSecretLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [service]);

  const handleProviderChange = (nextService: string) => {
    const provider = providers.find((item) => item.service === nextService);
    setService(nextService);
    setModel(resolveSingleModel(provider, "", "gpt-image-2"));
    setStatus("idle");
    setMessage("");
  };

  const saveConfig = useCallback(async (reason: "manual" | "auto") => {
    const provider = selected;
    if (!provider) return;
    setStatus("saving");
    setMessage("");
    const snapshot = JSON.stringify({
      service: provider.service,
      model,
      apiKey: apiKey.trim(),
    });
    try {
      await fetchJson(`/cover/secret/${encodeURIComponent(provider.service)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      await fetchJson("/cover/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: provider.service, model }),
      });
      savedSnapshotRef.current = snapshot;
      setStatus("saved");
      setMessage(reason === "auto" ? tr("图片配置已自动保存", "Image config auto-saved") : tr("图片配置已保存", "Image config saved"));
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : tr("保存图片配置失败", "Failed to save image config"));
    }
  }, [apiKey, model, selected]);

  useEffect(() => {
    if (!configLoaded || !secretLoaded) return;
    const snapshot = JSON.stringify({
      service,
      model,
      apiKey: apiKey.trim(),
    });
    if (!savedSnapshotRef.current) {
      savedSnapshotRef.current = snapshot;
      return;
    }
    if (status === "saving" || status === "testing" || status === "error") return;
    if (snapshot === savedSnapshotRef.current) return;
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void saveConfig("auto");
    }, 700);
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [apiKey, configLoaded, model, saveConfig, secretLoaded, service, status]);

  const handleTest = async () => {
    const provider = selected;
    if (!provider) return;
    setStatus("testing");
    setMessage("");
    try {
      await fetchJson(`/cover/secret/${encodeURIComponent(provider.service)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      await fetchJson("/cover/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: provider.service, model }),
      });
      const result = await fetchJson<{ success?: boolean; error?: string; message?: string }>("/cover/test", {
        method: "POST",
      });
      if (result.success === false) {
        setStatus("error");
        setMessage(result.error ?? result.message ?? tr("连接失败", "Connection failed"));
      } else {
        setStatus("saved");
        setMessage(result.message ?? tr("连接成功", "Connection successful"));
      }
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : tr("连接失败", "Connection failed"));
    }
  };

  if (providers.length === 0 && status !== "error") return null;

  return (
    <section className="space-y-5 rounded-xl border border-border/50 bg-card/50 p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={tr("服务商", "Provider")}>
          <ReadonlyValue value={selected?.label ?? ""} />
        </Field>

        <Field label={tr("语音模型", "Voice model")}>
          <select
            value={model}
            onChange={(event) => setModel(event.target.value)}
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
          >
            {modelOptions.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <Field label="API Key">
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="sk-..."
              className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 pr-10 text-sm font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground"
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </Field>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => void handleTest()}
              disabled={status === "saving" || status === "testing" || !selected}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3.5 py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary/50 disabled:opacity-50"
            >
              {status === "testing" && <Loader2 size={12} className="animate-spin" />}
              {tr("测试连接", "Test connection")}
            </button>
            <button
              onClick={() => void saveConfig("manual")}
              disabled={status === "saving" || status === "testing" || !selected}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {status === "saving" && <Loader2 size={12} className="animate-spin" />}
              {tr("保存", "Save")}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {message && (
              <span className={status === "error" ? "text-destructive" : "text-emerald-500"}>
                {message}
              </span>
            )}
          </div>
        </div>
      </div>

      <select
        value={service}
        onChange={(event) => handleProviderChange(event.target.value)}
        className="hidden"
        aria-hidden
        tabIndex={-1}
      >
        {providers.map((provider) => (
          <option key={provider.service} value={provider.service}>{provider.label}</option>
        ))}
      </select>
    </section>
  );
}

function VoiceConfigCard() {
  const [providers, setProviders] = useState<readonly ProviderInfo[]>([]);
  const [service, setService] = useState("bailian");
  const [model, setModel] = useState("cosyvoice-v3.5-plus");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "testing" | "saved" | "error">("loading");
  const [message, setMessage] = useState("");
  const [configLoaded, setConfigLoaded] = useState(false);
  const [secretLoaded, setSecretLoaded] = useState(false);
  const saveTimerRef = useRef<number | null>(null);
  const savedSnapshotRef = useRef("");

  const selected = providers.find((provider) => provider.service === service);
  const modelOptions = useMemo(() => {
    const resolved = resolveSingleModel(selected, model, "cosyvoice-v3.5-plus");
    return resolved ? [resolved] : [];
  }, [model, selected]);

  useEffect(() => {
    let cancelled = false;
    void fetchJson<VoiceConfigPayload>("/voice/config")
      .then((payload) => {
        if (cancelled) return;
        setProviders(payload.providers);
        const nextService = payload.service ?? payload.providers[0]?.service ?? "bailian";
        const provider = payload.providers.find((item) => item.service === nextService) ?? payload.providers[0];
        setService(nextService);
        setModel(resolveSingleModel(provider, payload.model ?? "", "cosyvoice-v3.5-plus"));
        setStatus("idle");
        setConfigLoaded(true);
      })
      .catch((error) => {
        if (cancelled) return;
        setStatus("error");
        setMessage(error instanceof Error ? error.message : tr("读取语音配置失败", "Failed to load voice config"));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!service) return;
    let cancelled = false;
    setSecretLoaded(false);
    void fetchJson<{ apiKey?: string }>(`/voice/secret/${encodeURIComponent(service)}`)
      .then((payload) => {
        if (cancelled) return;
        setApiKey(payload.apiKey ?? "");
      })
      .catch(() => {
        if (!cancelled) setApiKey("");
      })
      .finally(() => {
        if (!cancelled) setSecretLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [service]);

  const handleProviderChange = (nextService: string) => {
    const provider = providers.find((item) => item.service === nextService);
    setService(nextService);
    setModel(resolveSingleModel(provider, "", "cosyvoice-v3.5-plus"));
    setStatus("idle");
    setMessage("");
  };

  const saveConfig = useCallback(async (reason: "manual" | "auto") => {
    const provider = selected;
    if (!provider) return;
    setStatus("saving");
    setMessage("");
    const snapshot = JSON.stringify({
      service: provider.service,
      model,
      apiKey: apiKey.trim(),
    });
    try {
      await fetchJson(`/voice/secret/${encodeURIComponent(provider.service)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      await fetchJson("/voice/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: provider.service, model }),
      });
      savedSnapshotRef.current = snapshot;
      setStatus("saved");
      setMessage(reason === "auto" ? tr("语音配置已自动保存", "Voice config auto-saved") : tr("语音配置已保存", "Voice config saved"));
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : tr("保存语音配置失败", "Failed to save voice config"));
    }
  }, [apiKey, model, selected]);

  useEffect(() => {
    if (!configLoaded || !secretLoaded) return;
    const snapshot = JSON.stringify({
      service,
      model,
      apiKey: apiKey.trim(),
    });
    if (!savedSnapshotRef.current) {
      savedSnapshotRef.current = snapshot;
      return;
    }
    if (status === "saving" || status === "testing" || status === "error") return;
    if (snapshot === savedSnapshotRef.current) return;
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void saveConfig("auto");
    }, 700);
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [apiKey, configLoaded, model, saveConfig, secretLoaded, service, status]);

  const handleTest = async () => {
    const provider = selected;
    if (!provider) return;
    setStatus("testing");
    setMessage("");
    try {
      await fetchJson(`/voice/secret/${encodeURIComponent(provider.service)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      await fetchJson("/voice/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: provider.service, model }),
      });
      const result = await fetchJson<{ success?: boolean; message?: string }>("/voice/test", {
        method: "POST",
      });
      setStatus(result.success === false ? "error" : "saved");
      setMessage(result.message ?? (result.success === false ? tr("连接失败", "Connection failed") : tr("连接成功", "Connection successful")));
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : tr("连接失败", "Connection failed"));
    }
  };

  if (providers.length === 0 && status !== "error") return null;

  return (
    <section className="space-y-5 rounded-xl border border-border/50 bg-card/50 p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={tr("服务商", "Provider")}>
          <ReadonlyValue value={selected?.label ?? ""} />
        </Field>

        <Field label={tr("语音模型", "Voice model")}>
          <select
            value={model}
            onChange={(event) => setModel(event.target.value)}
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
          >
            {modelOptions.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <Field label="API Key">
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="sk-..."
              className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 pr-10 text-sm font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground"
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </Field>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => void handleTest()}
              disabled={status === "saving" || status === "testing" || !selected}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3.5 py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary/50 disabled:opacity-50"
            >
              {status === "testing" && <Loader2 size={12} className="animate-spin" />}
              {tr("测试连接", "Test connection")}
            </button>
            <button
              onClick={() => void saveConfig("manual")}
              disabled={status === "saving" || status === "testing" || !selected}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {status === "saving" && <Loader2 size={12} className="animate-spin" />}
              {tr("保存", "Save")}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {message && (
              <span className={status === "error" ? "text-destructive" : "text-emerald-500"}>
                {message}
              </span>
            )}
          </div>
        </div>
      </div>

      <select
        value={service}
        onChange={(event) => handleProviderChange(event.target.value)}
        className="hidden"
        aria-hidden
        tabIndex={-1}
      >
        {providers.map((provider) => (
          <option key={provider.service} value={provider.service}>{provider.label}</option>
        ))}
      </select>
    </section>
  );
}

export function ServiceListPage({ nav: _nav }: { nav: Nav }) {
  const services = useServiceStore((s) => s.services);
  const loading = useServiceStore((s) => s.servicesLoading);
  const fetchServices = useServiceStore((s) => s.fetchServices);

  useEffect(() => {
    void fetchServices();
  }, [fetchServices]);

  const textServices = useMemo(
    () => services.filter((svc) => svc.service === "astronCodingPlan"),
    [services],
  );

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-8">
      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{tr("文本大模型", "Text Models")}</h2>
        {loading && <SkeletonCard />}
        {!loading && textServices.length > 0 && (
          <TextModelConfigPanel serviceId={textServices[0]!.service} compact />
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{tr("图片大模型", "Image Models")}</h2>
        <CoverConfigCard />
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{tr("语音大模型", "Voice Models")}</h2>
        <VoiceConfigCard />
      </section>
    </div>
  );
}
