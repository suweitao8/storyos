import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { fetchJson } from "../hooks/use-api";
import { useServiceStore } from "../store/service";
import { ServiceQuickLinks } from "../components/ServiceQuickLinks";
import { ServiceConfigCard } from "../components/ServiceConfigCard";
import { tr } from "../lib/app-language";
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
    <div className="mx-auto max-w-xl animate-pulse space-y-6">
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

  useEffect(() => {
    void fetchServices();
  }, [fetchServices]);

  const svc = services.find((s) => s.service === serviceId);
  const isCustom = serviceId === "custom" || serviceId.startsWith("custom:");
  const persistedCustomName = serviceId.startsWith("custom:") ? decodeURIComponent(serviceId.slice("custom:".length)) : "";

  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [editing, setEditing] = useState(false);
  const [customName, setCustomName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [temperature, setTemperature] = useState("0.7");
  const [apiFormat, setApiFormat] = useState<"chat" | "responses">("chat");
  const [stream, setStream] = useState(true);
  const [detectedModel, setDetectedModel] = useState("");
  const [detectedConfig, setDetectedConfig] = useState<DetectedConfig | null>(null);
  const [verifiedProbe, setVerifiedProbe] = useState<VerifiedProbe | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [secretLoaded, setSecretLoaded] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>({ state: "idle" });
  const saveTimerRef = useRef<number | null>(null);
  const savedSnapshotRef = useRef("");

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
        if (typeof data.defaultModel === "string") {
          setDetectedModel(data.defaultModel);
        }
        setConfigLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setConfigLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isCustom, persistedCustomName, serviceId]);

  const resolvedCustomName = persistedCustomName || customName.trim() || "Custom";
  const effectiveServiceId = isCustom ? `custom:${resolvedCustomName}` : serviceId;
  const label = isCustom ? (customName || persistedCustomName || tr("自定义服务", "Custom service")) : (svc?.label ?? serviceId);
  const storeModels = useServiceStore((s) => s.modelsByService[effectiveServiceId]);
  const currentModel = detectedModel || storeModels?.[0]?.id || "";

  useEffect(() => {
    let cancelled = false;
    setSecretLoaded(false);
    void rehydrateServiceConnectionStatus({
      effectiveServiceId,
    })
      .then((result) => {
        if (cancelled) return;
        setApiKey(result.apiKey);
        if (result.detectedModel) setDetectedModel(result.detectedModel);
        setDetectedConfig(result.detectedConfig);
        setStatus(result.status);
        if (result.status.state === "connected") {
          setStoreModels(effectiveServiceId, result.status.models);
        }
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
    effectiveServiceId,
    setStoreModels,
  ]);

  const currentSnapshot = JSON.stringify({
    apiKey: apiKey.trim(),
    customName: customName.trim(),
    baseUrl: baseUrl.trim(),
    temperature: temperature.trim(),
    apiFormat,
    stream,
    detectedModel,
  });

  const persistConfig = useCallback(async () => {
    const trimmedKey = apiKey.trim();
    const trimmedBaseUrl = baseUrl.trim();
    setApiKey(trimmedKey);
    if (isCustom && !trimmedBaseUrl) {
      setStatus({ state: "error", message: tr("请先填写 Base URL", "Enter a base URL first") });
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
        detectedModel: currentModel,
        verifiedProbe,
      });
      if (result.status.state === "connected") {
        const nextApiFormat = result.detectedConfig?.apiFormat ?? apiFormat;
        const nextStream = typeof result.detectedConfig?.stream === "boolean" ? result.detectedConfig.stream : stream;
        const nextBaseUrl = isCustom ? (result.detectedConfig?.baseUrl ?? baseUrl.trim()) : "";
        if (result.detectedConfig?.apiFormat) setApiFormat(result.detectedConfig.apiFormat);
        if (typeof result.detectedConfig?.stream === "boolean") setStream(result.detectedConfig.stream);
        if (isCustom && result.detectedConfig?.baseUrl) setBaseUrl(result.detectedConfig.baseUrl);
        setDetectedModel(result.detectedModel);
        setDetectedConfig(result.detectedConfig);
        setStoreModels(effectiveServiceId, result.status.models);
        setStatus(result.status);
        savedSnapshotRef.current = JSON.stringify({
          apiKey: trimmedKey,
          customName: customName.trim(),
          baseUrl: nextBaseUrl,
          temperature: temperature.trim(),
          apiFormat: nextApiFormat,
          stream: nextStream,
          detectedModel: result.detectedModel || currentModel,
        });
      } else {
        setStatus(result.status);
      }
      await refreshServices();
    } catch (error) {
      setStatus({ state: "error", message: error instanceof Error ? error.message : tr("保存失败", "Save failed") });
    }
  }, [
    apiFormat,
    apiKey,
    baseUrl,
    currentModel,
    customName,
    effectiveServiceId,
    isCustom,
    refreshServices,
    resolvedCustomName,
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
      void persistConfig();
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
        setDetectedModel(result.selectedModel ?? currentModel);
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

  const cardStatus =
    status.state === "saving"
      ? "saving"
      : status.state === "testing"
        ? "testing"
        : status.state === "connected" || status.state === "saved"
          ? "saved"
          : status.state === "error"
            ? "error"
            : "idle";

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <button
        onClick={nav.toServices}
        className="inline-flex items-center gap-2 rounded-lg border border-border/50 bg-card/60 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary/50"
      >
        <ArrowLeft size={14} />
        {tr("返回服务商", "Back to providers")}
      </button>

      <div className="flex items-center gap-3">
        <h1 className="font-serif text-2xl">{label}</h1>
        {status.state === "connected" && (
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500">
            {tr("已连接", "Connected")}
          </span>
        )}
      </div>
      <ServiceQuickLinks serviceId={serviceId} />

      {isCustom && (
        <div className="grid grid-cols-2 gap-4">
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

      <ServiceConfigCard
        model={currentModel}
        apiKey={apiKey}
        showKey={showKey}
        editing={editing}
        autosaveStatus={cardStatus}
        onEditToggle={() => setEditing((value) => !value)}
        onApiKeyChange={setApiKey}
        onToggleShowKey={() => setShowKey((value) => !value)}
        onTestConnection={() => { void handleTest(); }}
      />

      {status.state === "error" && (
        <p className="text-xs text-destructive">{status.message}</p>
      )}
      {status.state === "saved" && (
        <p className="text-xs text-emerald-500">{tr("已保存", "Saved")}</p>
      )}
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
