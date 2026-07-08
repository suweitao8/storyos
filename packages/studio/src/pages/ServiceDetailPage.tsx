import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { fetchJson } from "../hooks/use-api";
import { tr } from "../lib/app-language";
import { useServiceStore } from "../store/service";
import {
  matchServiceConfigEntryForDetail,
  probeServiceForDetail,
  rehydrateServiceConnectionStatus,
  saveServiceConfig,
  type ServiceDetailConnectionStatus as ConnectionStatus,
  type ServiceDetailDetectedConfig as DetectedConfig,
  type ServiceDetailVerifiedProbe as VerifiedProbe,
} from "./service-detail-state";

interface Nav {
  toServices: () => void;
}

function DetailSkeleton() {
  return (
    <div className="max-w-xl mx-auto space-y-6 animate-pulse">
      <div className="h-4 w-16 rounded bg-muted" />
      <div className="h-7 w-40 rounded bg-muted" />
      <div className="space-y-2">
        <div className="h-3 w-16 rounded bg-muted/60" />
        <div className="h-10 w-full rounded-lg bg-muted/40" />
      </div>
      <div className="h-9 w-24 rounded-lg bg-muted/40" />
    </div>
  );
}

export function ServiceDetailPage({ serviceId, nav }: { serviceId: string; nav: Nav }) {
  const services = useServiceStore((s) => s.services);
  const loading = useServiceStore((s) => s.servicesLoading);
  const fetchServices = useServiceStore((s) => s.fetchServices);
  const refreshServices = useServiceStore((s) => s.refreshServices);
  const setStoreModels = useServiceStore((s) => s.setLiveModels);
  const clearStoreModels = useServiceStore((s) => s.clearModels);
  const fetchLiveModels = useServiceStore((s) => s.fetchLiveModels);

  useEffect(() => {
    void fetchServices();
  }, [fetchServices]);

  const svc = services.find((s) => s.service === serviceId);
  const isCustom = serviceId === "custom" || serviceId.startsWith("custom:");
  const persistedCustomName = serviceId.startsWith("custom:") ? decodeURIComponent(serviceId.slice("custom:".length)) : "";

  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [customName, setCustomName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [temperature, setTemperature] = useState("0.7");
  const [apiFormat, setApiFormat] = useState<"chat" | "responses">("chat");
  const [stream, setStream] = useState(true);
  const [selectedModel, setSelectedModel] = useState("");
  const [detectedConfig, setDetectedConfig] = useState<DetectedConfig | null>(null);
  const [verifiedProbe, setVerifiedProbe] = useState<VerifiedProbe | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [secretLoaded, setSecretLoaded] = useState(false);
  const saveTimerRef = useRef<number | null>(null);
  const savedSnapshotRef = useRef("");
  const [status, setStatus] = useState<ConnectionStatus>({ state: "idle" });

  useEffect(() => {
    let cancelled = false;
    void fetchJson<{ services: Array<Record<string, unknown>>; defaultModel?: string }>("/services/config")
      .then((data) => {
        if (cancelled) return;
        const matched = matchServiceConfigEntryForDetail(data.services ?? [], serviceId);
        if (matched) {
          if (isCustom) {
            setCustomName(String(matched.name ?? persistedCustomName));
            setBaseUrl(String(matched.baseUrl ?? ""));
          }
          if (typeof matched.temperature === "number") setTemperature(String(matched.temperature));
          if (matched.apiFormat === "chat" || matched.apiFormat === "responses") setApiFormat(matched.apiFormat);
          if (typeof matched.stream === "boolean") setStream(matched.stream);
        }
        if (typeof data.defaultModel === "string") setSelectedModel(data.defaultModel);
        setConfigLoaded(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isCustom, persistedCustomName, serviceId]);

  const resolvedCustomName = persistedCustomName || customName.trim() || "Custom";
  const effectiveServiceId = isCustom ? `custom:${resolvedCustomName}` : serviceId;
  const label = isCustom ? (customName || persistedCustomName || tr("自定义服务", "Custom service")) : (svc?.label ?? serviceId);
  const storeModels = useServiceStore((s) => s.modelsByService[effectiveServiceId]);

  useEffect(() => {
    let cancelled = false;
    setSecretLoaded(false);
    void rehydrateServiceConnectionStatus({
      effectiveServiceId,
      shouldVerify: Boolean(svc?.connected),
      isCustom,
      baseUrl,
      apiFormat,
      stream,
    })
      .then((result) => {
        if (cancelled) return;
        setApiKey(result.apiKey);
        setDetectedConfig(result.detectedConfig);
        if (result.status.state === "connected") {
          setStoreModels(effectiveServiceId, result.status.models);
        }
        setStatus(result.status);
      })
      .catch(() => {
        if (cancelled) return;
        setStatus({ state: "idle" });
      })
      .finally(() => {
        if (!cancelled) setSecretLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [
    apiFormat,
    baseUrl,
    effectiveServiceId,
    isCustom,
    setStoreModels,
    stream,
    svc?.connected,
  ]);

  useEffect(() => {
    if (!secretLoaded) return;
    void fetchLiveModels(effectiveServiceId);
  }, [effectiveServiceId, fetchLiveModels, secretLoaded]);

  const models = status.state === "connected" ? status.models : (storeModels ?? []);
  const isConnected = Boolean(svc?.connected);
  const isBusy = status.state === "testing" || status.state === "saving";
  const selectedModelLabel = models.find((model) => model.id === selectedModel)?.name ?? selectedModel;
  const currentSnapshot = JSON.stringify({
    apiKey: apiKey.trim(),
    customName: customName.trim(),
    baseUrl: baseUrl.trim(),
    selectedModel,
    temperature: temperature.trim(),
    apiFormat,
    stream,
  });

  useEffect(() => {
    if (models.length === 0) return;
    if (selectedModel && models.some((model) => model.id === selectedModel)) return;
    setSelectedModel(models[0]?.id ?? "");
  }, [models, selectedModel]);

  const persistConfig = useCallback(async (redirectAfterSave: boolean) => {
    const trimmedKey = apiKey.trim();
    const trimmedBaseUrl = baseUrl.trim();
    const nextSelectedModel = selectedModel.trim();
    setApiKey(trimmedKey);
    if (isCustom && !trimmedBaseUrl) {
      setStatus({ state: "error", message: tr("请先填写 Base URL", "Enter a base URL first") });
      return;
    }
    if (!nextSelectedModel) {
      setStatus({ state: "error", message: tr("请先选择模型", "Select a model first") });
      return;
    }

    setStatus({ state: "saving" });
    try {
      const result = await saveServiceConfig({
        effectiveServiceId,
        serviceId,
        isCustom,
        resolvedCustomName,
        apiKey: trimmedKey,
        baseUrl,
        apiFormat,
        stream,
        temperature,
        detectedModel: nextSelectedModel,
        verifiedProbe,
      });
      if (result.status.state === "connected") {
        const nextApiFormat = result.detectedConfig?.apiFormat ?? apiFormat;
        const nextStream = typeof result.detectedConfig?.stream === "boolean" ? result.detectedConfig.stream : stream;
        const nextBaseUrl = isCustom ? (result.detectedConfig?.baseUrl ?? trimmedBaseUrl) : "";
        if (result.detectedConfig?.apiFormat) setApiFormat(result.detectedConfig.apiFormat);
        if (typeof result.detectedConfig?.stream === "boolean") setStream(result.detectedConfig.stream);
        if (isCustom && result.detectedConfig?.baseUrl) setBaseUrl(result.detectedConfig.baseUrl);
        if (result.detectedModel) setSelectedModel(result.detectedModel);
        setDetectedConfig(result.detectedConfig);
        setStoreModels(effectiveServiceId, result.status.models);
        setStatus(result.status);
        const savedModel = result.detectedModel || nextSelectedModel;
        savedSnapshotRef.current = JSON.stringify({
          apiKey: trimmedKey,
          customName: customName.trim(),
          baseUrl: nextBaseUrl,
          selectedModel: savedModel,
          temperature: temperature.trim(),
          apiFormat: nextApiFormat,
          stream: nextStream,
        });
      } else {
        setStatus(result.status);
        if (result.status.state === "error") return;
      }
      await refreshServices();
      if (redirectAfterSave) nav.toServices();
    } catch (error) {
      setStatus({ state: "error", message: error instanceof Error ? error.message : tr("保存失败", "Save failed") });
    }
  }, [
    apiFormat,
    apiKey,
    baseUrl,
    customName,
    effectiveServiceId,
    isCustom,
    nav,
    refreshServices,
    resolvedCustomName,
    selectedModel,
    serviceId,
    setStoreModels,
    stream,
    temperature,
    verifiedProbe,
  ]);

  useEffect(() => {
    if (!configLoaded || !secretLoaded) return;
    if (!savedSnapshotRef.current) {
      savedSnapshotRef.current = currentSnapshot;
      return;
    }
    if (status.state === "saving" || status.state === "testing" || status.state === "error") return;
    if (currentSnapshot === savedSnapshotRef.current) return;
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void persistConfig(false);
    }, 700);
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [configLoaded, currentSnapshot, persistConfig, secretLoaded, status.state]);

  const handleTest = async () => {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey && !isCustom) {
      setStatus({ state: "error", message: tr("请先输入 API Key", "Enter an API key first") });
      return;
    }
    if (isCustom && !baseUrl.trim()) {
      setStatus({ state: "error", message: tr("请先填写 Base URL", "Enter a base URL first") });
      return;
    }
    if (!selectedModel.trim()) {
      setStatus({ state: "error", message: tr("请先选择模型", "Select a model first") });
      return;
    }

    setApiKey(trimmedKey);
    setStatus({ state: "testing" });
    try {
      const result = await probeServiceForDetail(effectiveServiceId, {
        apiKey: trimmedKey,
        apiFormat,
        stream,
        ...(isCustom ? { baseUrl: baseUrl.trim() } : {}),
      });
      if (result.ok) {
        const models = result.models ?? [];
        const verifiedApiFormat = result.detected?.apiFormat ?? apiFormat;
        const verifiedStream = typeof result.detected?.stream === "boolean" ? result.detected.stream : stream;
        const verifiedBaseUrl = isCustom ? (result.detected?.baseUrl ?? baseUrl.trim()) : "";
        if (result.detected?.apiFormat) setApiFormat(result.detected.apiFormat);
        if (typeof result.detected?.stream === "boolean") setStream(result.detected.stream);
        if (isCustom && result.detected?.baseUrl) setBaseUrl(result.detected.baseUrl);
        if (result.selectedModel) setSelectedModel(result.selectedModel);
        setDetectedConfig(result.detected ?? null);
        setVerifiedProbe({
          apiKey: trimmedKey,
          baseUrl: verifiedBaseUrl,
          apiFormat: verifiedApiFormat,
          stream: verifiedStream,
          models,
          selectedModel: result.selectedModel,
          detected: result.detected,
        });
        setStatus({ state: "connected", models });
        setStoreModels(effectiveServiceId, models);
        if (result.selectedModel) setSelectedModel(result.selectedModel);
      } else {
        setVerifiedProbe(null);
        setStatus({ state: "error", message: result.error ?? tr("连接失败", "Connection failed") });
        clearStoreModels(effectiveServiceId);
      }
    } catch (error) {
      setVerifiedProbe(null);
      setStatus({ state: "error", message: error instanceof Error ? error.message : tr("连接失败", "Connection failed") });
    }
  };

  if (loading) return <DetailSkeleton />;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <button
        onClick={nav.toServices}
        className="inline-flex items-center gap-2 rounded-lg border border-border/50 bg-card/60 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary/50"
      >
        <ArrowLeft size={14} />
        {tr("返回服务列表", "Back to providers")}
      </button>

      <section className="rounded-xl border border-border/50 bg-card/50 p-5 space-y-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-2xl">{tr("模型配置", "Model config")}</h1>
            {isConnected && (
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500">
                {tr("已连接", "Connected")}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground/70">{label}</p>
        </div>

        {isCustom && (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={tr("服务名称", "Service name")}>
              <input
                type="text"
                value={customName}
                onChange={(event) => setCustomName(event.target.value)}
                placeholder={tr("例如：本地 Ollama", "e.g. local Ollama")}
                className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Base URL">
              <input
                type="text"
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="https://api.example.com/v1"
                className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm font-mono"
              />
            </Field>
          </div>
        )}

        <Field label={tr("当前模型", "Current model")}>
          <select
            value={selectedModel}
            onChange={(event) => setSelectedModel(event.target.value)}
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
          >
            {models.length > 0 ? (
              models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name ?? model.id}
                </option>
              ))
            ) : (
              <option value={selectedModel || ""}>{selectedModel || tr("正在加载模型", "Loading models")}</option>
            )}
          </select>
          <p className="text-xs text-muted-foreground/60">
            {models.length > 0
              ? tr(`当前可选 ${models.length} 个模型`, `${models.length} models available`)
              : tr("连接后会自动加载可用模型", "Available models will load after connection")}
          </p>
        </Field>

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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 transition-colors hover:text-muted-foreground"
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </Field>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => void handleTest()}
            disabled={isBusy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3.5 py-2 text-xs transition-colors hover:bg-secondary/50 disabled:opacity-50"
          >
            {status.state === "testing" && <Loader2 size={12} className="animate-spin" />}
            {tr("测试连接", "Test connection")}
          </button>
          <button
            onClick={() => void persistConfig(true)}
            disabled={isBusy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {status.state === "saving" && <Loader2 size={12} className="animate-spin" />}
            {tr("保存", "Save")}
          </button>
          {status.state === "connected" && (
            <span className="text-xs text-emerald-500">
              {tr(`连接成功`, "Connected")}
              {selectedModelLabel ? ` · ${selectedModelLabel}` : ""}
              {detectedConfig
                ? ` · ${detectedConfig.apiFormat === "responses" ? "Responses" : "Chat"} / ${detectedConfig.stream ? tr("流式", "Streaming") : tr("非流式", "Non-streaming")}`
                : ""}
            </span>
          )}
          {status.state === "saved" && (
            <span className="text-xs text-emerald-500">{tr("已保存", "Saved")}</span>
          )}
          {status.state === "error" && (
            <span className="text-xs text-destructive">{status.message}</span>
          )}
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-muted-foreground/70">{label}</label>
      {children}
    </div>
  );
}
