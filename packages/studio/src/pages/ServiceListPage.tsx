import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, Loader2, Plus } from "lucide-react";
import { tr } from "../lib/app-language";
import { fetchJson } from "../hooks/use-api";
import { useServiceStore } from "../store/service";
import { TextModelConfigPanel } from "./ServiceDetailPage";

interface Nav {
  toDashboard: () => void;
  toServiceDetail: (id: string) => void;
}

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-border/30 p-5 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-4 w-24 bg-muted rounded" />
        <div className="w-2 h-2 rounded-full bg-muted" />
      </div>
      <div className="h-3 w-16 bg-muted/60 rounded" />
    </div>
  );
}

interface CoverProviderInfo {
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
  readonly providers: readonly CoverProviderInfo[];
}

function ServiceCard(_: { svc: { service: string }; onClick: () => void }) {
  return null;
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

function CoverConfigCard() {
  const [providers, setProviders] = useState<readonly CoverProviderInfo[]>([]);
  const [service, setService] = useState("kkaiapi");
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
        const nextService = payload.service ?? payload.providers[0]?.service ?? "kkaiapi";
        const provider = payload.providers.find((item) => item.service === nextService) ?? payload.providers[0];
        setService(nextService);
        setModel(resolveSingleModel(provider, payload.model ?? "", "gpt-image-2"));
        setStatus("idle");
        setConfigLoaded(true);
      })
      .catch((error) => {
        if (cancelled) return;
        setStatus("error");
        setMessage(error instanceof Error ? error.message : tr("读取封面配置失败", "Failed to load cover config"));
      });
    return () => { cancelled = true; };
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
    return () => { cancelled = true; };
  }, [service]);

  const handleServiceChange = (nextService: string) => {
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
      setMessage(reason === "auto" ? tr("封面配置已自动保存", "Cover config auto-saved") : tr("封面配置已保存", "Cover config saved"));
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : tr("保存封面配置失败", "Failed to save cover config"));
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
      const result = await fetchJson<{ ok?: boolean; error?: string; message?: string }>(
        `/services/${encodeURIComponent(provider.service)}/test`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey: apiKey.trim(),
            apiFormat: "chat",
            stream: true,
          }),
        },
      );
      if (result.ok === false) {
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
    <section className="rounded-xl border border-border/50 bg-card/50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-foreground">{tr("封面生成", "Cover generation")}</h2>
          <p className="mt-1 text-xs text-muted-foreground/70">
            {tr(
              "只配置封面通道和模型；封面尺寸由短篇封面提示词和内部默认处理。",
              "Only configures the cover provider and model; cover size is handled by the short-story cover prompt and internal defaults.",
            )}
          </p>
        </div>
        {selected?.connected && (
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500">
            {tr("已有密钥", "Key saved")}
          </span>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="block text-xs font-medium text-muted-foreground/70">{tr("服务", "Service")}</span>
          <select
            value={service}
            onChange={(event) => handleServiceChange(event.target.value)}
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
          >
            {providers.map((provider) => (
              <option key={provider.service} value={provider.service}>{provider.label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="block text-xs font-medium text-muted-foreground/70">{tr("封面模型", "Cover model")}</span>
          <select
            value={model}
            onChange={(event) => setModel(event.target.value)}
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
          >
            {modelOptions.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="space-y-1.5">
        <span className="block text-xs font-medium text-muted-foreground/70">API Key</span>
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
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => void saveConfig("manual")}
          disabled={status === "saving" || status === "testing" || !selected}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {status === "saving" && <Loader2 size={12} className="animate-spin" />}
          {tr("保存封面配置", "Save cover config")}
        </button>
        <button
          onClick={() => void handleTest()}
          disabled={status === "saving" || status === "testing" || !selected}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3.5 py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary/50 disabled:opacity-50"
        >
          {status === "testing" && <Loader2 size={12} className="animate-spin" />}
          {tr("测试连接", "Test connection")}
        </button>
        {selected?.baseUrl && (
          <span className="text-xs text-muted-foreground/60">
            Base URL: <span className="font-mono">{selected.baseUrl}</span>
          </span>
        )}
        {message && (
          <span className={`text-xs ${status === "error" ? "text-destructive" : "text-emerald-500"}`}>
            {message}
          </span>
        )}
      </div>
    </section>
  );
}

interface VoiceProviderInfo {
  readonly service: string;
  readonly label: string;
  readonly baseUrl: string;
  readonly defaultModel: string;
  readonly models: readonly string[];
  readonly connected: boolean;
}

interface VoiceConfigPayload {
  readonly service: string | null;
  readonly model: string | null;
  readonly providers: readonly VoiceProviderInfo[];
}

function VoiceConfigCard() {
  const [providers, setProviders] = useState<readonly VoiceProviderInfo[]>([]);
  const [service, setService] = useState("");
  const [model, setModel] = useState("");
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
    const resolved = resolveSingleModel(selected, model, "");
    return resolved ? [resolved] : [];
  }, [model, selected]);

  useEffect(() => {
    let cancelled = false;
    void fetchJson<VoiceConfigPayload>("/voice/config")
      .then((payload) => {
        if (cancelled) return;
        setProviders(payload.providers);
        const nextService = payload.service ?? payload.providers[0]?.service ?? "";
        const provider = payload.providers.find((item) => item.service === nextService) ?? payload.providers[0];
        setService(nextService);
        setModel(resolveSingleModel(provider, payload.model ?? "", ""));
        setStatus("idle");
        setConfigLoaded(true);
      })
      .catch((error) => {
        if (cancelled) return;
        setStatus("error");
        setMessage(error instanceof Error ? error.message : tr("读取语音配置失败", "Failed to load voice config"));
      });
    return () => { cancelled = true; };
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
    return () => { cancelled = true; };
  }, [service]);

  const handleServiceChange = (nextService: string) => {
    const provider = providers.find((item) => item.service === nextService);
    setService(nextService);
    setModel(resolveSingleModel(provider, "", ""));
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
    setStatus("testing");
    setMessage("");
    try {
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
    <section className="rounded-xl border border-border/50 bg-card/50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-foreground">{tr("语音合成", "Voice synthesis")}</h2>
          <p className="mt-1 text-xs text-muted-foreground/70">
            {tr(
              "配置语音服务商和模型；用于文本转语音。",
              "Configure the voice provider and model; used for text-to-speech.",
            )}
          </p>
        </div>
        {selected?.connected && (
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500">
            {tr("已有密钥", "Key saved")}
          </span>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="block text-xs font-medium text-muted-foreground/70">{tr("服务", "Service")}</span>
          <select
            value={service}
            onChange={(event) => handleServiceChange(event.target.value)}
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
          >
            {providers.map((provider) => (
              <option key={provider.service} value={provider.service}>{provider.label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="block text-xs font-medium text-muted-foreground/70">{tr("语音模型", "Voice model")}</span>
          <select
            value={model}
            onChange={(event) => setModel(event.target.value)}
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
          >
            {modelOptions.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="space-y-1.5">
        <span className="block text-xs font-medium text-muted-foreground/70">API Key</span>
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
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => void saveConfig("manual")}
          disabled={status === "saving" || status === "testing" || !selected}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {status === "saving" && <Loader2 size={12} className="animate-spin" />}
          {tr("保存语音配置", "Save voice config")}
        </button>
        <button
          onClick={handleTest}
          disabled={status === "saving" || status === "testing" || !selected}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3.5 py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary/50 disabled:opacity-50"
        >
          {status === "testing" && <Loader2 size={12} className="animate-spin" />}
          {tr("测试连接", "Test connection")}
        </button>
        {selected?.baseUrl && (
          <span className="text-xs text-muted-foreground/60">
            Base URL: <span className="font-mono">{selected.baseUrl}</span>
          </span>
        )}
        {message && (
          <span className={`text-xs ${status === "error" ? "text-destructive" : "text-emerald-500"}`}>
            {message}
          </span>
        )}
      </div>
    </section>
  );
}

export function ServiceListPage({ nav }: { nav: Nav }) {
  const services = useServiceStore((s) => s.services);
  const loading = useServiceStore((s) => s.servicesLoading);
  const fetchServices = useServiceStore((s) => s.fetchServices);

  useEffect(() => { void fetchServices(); }, [fetchServices]);

  const bankServices = useMemo(
    () => services.filter((svc) => svc.service === "astronCodingPlan"),
    [services],
  );
  const filteredCustom: Array<{ service: string }> = [];
  const canCreateCustom = false;
  const showCustomSection = false;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* --- Text Models --- */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{tr("文本大模型", "Text Models")}</h2>

      {loading && (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {!loading && bankServices.length > 0 && (
        <TextModelConfigPanel serviceId={bankServices[0]!.service} compact />
      )}

      {showCustomSection && (
        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
            {tr("自定义服务", "Custom services")}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {filteredCustom.map((svc) => (
              <ServiceCard
                key={svc.service}
                svc={svc}
                onClick={() => nav.toServiceDetail(svc.service)}
              />
            ))}
            {canCreateCustom && (
              <button
                onClick={() => nav.toServiceDetail("custom")}
                className="flex min-h-[92px] flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/40 p-5 text-muted-foreground/60 transition-all hover:border-primary/30 hover:text-muted-foreground"
              >
                <Plus size={18} />
                <span className="text-xs">{tr("自定义服务", "Custom service")}</span>
              </button>
            )}
          </div>
        </section>
      )}

      {!loading && bankServices.length === 0 && filteredCustom.length === 0 && !canCreateCustom && (
        <div className="rounded-lg border border-dashed border-border/40 p-8 text-center text-sm text-muted-foreground">
          {tr("没有匹配的服务商", "No matching providers")}
        </div>
      )}
      </section>

      {/* --- Image Models --- */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{tr("图片大模型", "Image Models")}</h2>
        <CoverConfigCard />
      </section>

      {/* --- Voice Models --- */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{tr("语音大模型", "Voice Models")}</h2>
        <VoiceConfigCard />
      </section>
    </div>
  );
}
