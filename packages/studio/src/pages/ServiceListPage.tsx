import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { tr } from "../lib/app-language";
import { fetchJson } from "../hooks/use-api";
import { useServiceStore } from "../store/service";
import type { ServiceInfo } from "../store/service";
import { ServiceQuickLinks, getServiceQuickLinks } from "../components/ServiceQuickLinks";
import { ServiceConfigCard } from "../components/ServiceConfigCard";
import { buildSecretSnapshot, resolveSingleModel } from "./service-config-card-state";

interface Nav {
  toDashboard: () => void;
  toServiceDetail: (id: string) => void;
}

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-border/30 p-5 animate-pulse">
      <div className="mb-3 flex items-center justify-between">
        <div className="h-4 w-24 rounded bg-muted" />
        <div className="h-2 w-2 rounded-full bg-muted" />
      </div>
      <div className="h-3 w-16 rounded bg-muted/60" />
    </div>
  );
}

function ServiceCard({ svc, onClick }: { svc: ServiceInfo; onClick: () => void }) {
  const quickLinks = getServiceQuickLinks(svc.service);
  return (
    <div
      className={[
        "flex min-h-[92px] flex-col gap-2 rounded-lg border p-5 text-left transition-all hover:shadow-sm",
        svc.connected
          ? "border-emerald-500/30 bg-emerald-500/[0.03]"
          : "border-dashed border-border/40",
      ].join(" ")}
    >
      <button onClick={onClick} className="flex flex-1 flex-col gap-2 text-left">
        <div className="flex items-center justify-between gap-3">
          <span className="truncate text-sm font-medium">{svc.label}</span>
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${svc.connected ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
        </div>
        <span className="text-xs text-muted-foreground/60">
          {svc.connected ? tr("已连接", "Connected") : tr("未配置", "Not configured")}
        </span>
      </button>
      {quickLinks.length > 0 && (
        <ServiceQuickLinks serviceId={svc.service} variant="card" className="pt-1" />
      )}
    </div>
  );
}

interface ProviderInfo {
  readonly service: string;
  readonly label: string;
  readonly baseUrl: string;
  readonly defaultModel: string;
  readonly models: readonly string[];
  readonly connected: boolean;
}

interface ConfigPayload {
  readonly service: string | null;
  readonly model: string | null;
  readonly providers: readonly ProviderInfo[];
}

type AutosaveStatus = "idle" | "saving" | "saved" | "testing" | "error";

interface ServiceConfigSectionProps {
  readonly title: string;
  readonly description: string;
  readonly configPath: "/cover/config" | "/voice/config";
  readonly secretPath: (service: string) => string;
  readonly fallbackModel: string;
  readonly saveMessage: string;
  readonly autoSaveMessage: string;
  readonly saveErrorMessage: string;
  readonly testSuccessMessage: string;
  readonly testErrorMessage: string;
  readonly testConnection: (args: {
    readonly service: string;
    readonly apiKey: string;
    readonly model: string;
  }) => Promise<{ readonly ok: boolean; readonly message?: string }>;
}

function ServiceConfigSection(props: ServiceConfigSectionProps) {
  const [providers, setProviders] = useState<readonly ProviderInfo[]>([]);
  const [service, setService] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [message, setMessage] = useState("");
  const [configLoaded, setConfigLoaded] = useState(false);
  const [secretLoaded, setSecretLoaded] = useState(false);
  const saveTimerRef = useRef<number | null>(null);
  const savedSnapshotRef = useRef("");

  const selectedProvider = providers.find((provider) => provider.service === service);
  const resolvedModel = resolveSingleModel(selectedProvider, model, props.fallbackModel);
  const currentSnapshot = buildSecretSnapshot({
    service,
    model: resolvedModel,
    apiKey,
  });

  useEffect(() => {
    let cancelled = false;
    void fetchJson<ConfigPayload>(props.configPath)
      .then((payload) => {
        if (cancelled) return;
        setProviders(payload.providers ?? []);
        const nextService = payload.service ?? payload.providers?.[0]?.service ?? "";
        const nextProvider = payload.providers?.find((provider) => provider.service === nextService) ?? payload.providers?.[0];
        setService(nextService);
        setModel(resolveSingleModel(nextProvider, payload.model ?? "", props.fallbackModel));
        setStatus("idle");
        setMessage("");
        setConfigLoaded(true);
      })
      .catch((error) => {
        if (cancelled) return;
        setStatus("error");
        setMessage(error instanceof Error ? error.message : props.saveErrorMessage);
        setConfigLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [props.configPath, props.fallbackModel, props.saveErrorMessage]);

  useEffect(() => {
    if (!service) return;
    let cancelled = false;
    setSecretLoaded(false);
    void fetchJson<{ apiKey?: string }>(props.secretPath(service))
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
  }, [props.secretPath, service]);

  const persistConfig = useCallback(async (reason: "auto" | "manual") => {
    const provider = selectedProvider;
    if (!provider) return false;

    const trimmedApiKey = apiKey.trim();
    const nextSnapshot = buildSecretSnapshot({
      service: provider.service,
      model: resolvedModel,
      apiKey: trimmedApiKey,
    });

    setStatus("saving");
    setMessage("");

    try {
      await fetchJson(props.secretPath(provider.service), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: trimmedApiKey }),
      });
      await fetchJson(props.configPath, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: provider.service,
          model: resolvedModel,
        }),
      });
      savedSnapshotRef.current = nextSnapshot;
      setStatus("saved");
      setMessage(reason === "auto" ? props.autoSaveMessage : props.saveMessage);
      return true;
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : props.saveErrorMessage);
      return false;
    }
  }, [
    apiKey,
    props.autoSaveMessage,
    props.configPath,
    props.saveErrorMessage,
    props.saveMessage,
    props.secretPath,
    resolvedModel,
    selectedProvider,
  ]);

  useEffect(() => {
    if (!configLoaded || !secretLoaded) return;
    if (!savedSnapshotRef.current) {
      savedSnapshotRef.current = currentSnapshot;
      return;
    }
    if (status === "saving" || status === "testing" || status === "error") return;
    if (currentSnapshot === savedSnapshotRef.current) return;
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void persistConfig("auto");
    }, 700);
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [configLoaded, currentSnapshot, persistConfig, secretLoaded, status]);

  const handleServiceChange = (nextService: string) => {
    const provider = providers.find((item) => item.service === nextService);
    setService(nextService);
    setModel(resolveSingleModel(provider, "", props.fallbackModel));
    setMessage("");
    setStatus("idle");
  };

  const handleTest = async () => {
    const provider = selectedProvider;
    if (!provider) return;
    if (currentSnapshot !== savedSnapshotRef.current) {
      const saved = await persistConfig("auto");
      if (!saved) return;
    }

    setStatus("testing");
    setMessage("");
    try {
      const result = await props.testConnection({
        service: provider.service,
        apiKey: apiKey.trim(),
        model: resolvedModel,
      });
      if (result.ok) {
        setStatus("saved");
        setMessage(result.message ?? props.testSuccessMessage);
      } else {
        setStatus("error");
        setMessage(result.message ?? props.testErrorMessage);
      }
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : props.testErrorMessage);
    }
  };

  if (providers.length === 0 && status !== "error") return null;

  return (
    <section className="space-y-3 rounded-xl border border-border/50 bg-card/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-foreground">{props.title}</h2>
          <p className="mt-1 text-xs text-muted-foreground/70">{props.description}</p>
        </div>
        {selectedProvider?.connected && (
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500">
            {tr("已有密钥", "Key saved")}
          </span>
        )}
      </div>

      <label className="space-y-1.5">
        <span className="block text-xs font-medium text-muted-foreground/70">{tr("服务", "Service")}</span>
        <select
          value={service}
          onChange={(event) => handleServiceChange(event.target.value)}
          className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
        >
          {providers.map((provider) => (
            <option key={provider.service} value={provider.service}>
              {provider.label}
            </option>
          ))}
        </select>
      </label>

      <ServiceConfigCard
        model={resolvedModel}
        apiKey={apiKey}
        showKey={showKey}
        editing={editing}
        autosaveStatus={status}
        onEditToggle={() => setEditing((value) => !value)}
        onApiKeyChange={setApiKey}
        onToggleShowKey={() => setShowKey((value) => !value)}
        onTestConnection={() => { void handleTest(); }}
      />

      {message && (
        <p className={`text-xs ${status === "error" ? "text-destructive" : "text-emerald-500"}`}>
          {message}
        </p>
      )}
    </section>
  );
}

function CoverConfigCard() {
  return (
    <ServiceConfigSection
      title={tr("封面生成", "Cover generation")}
      description={tr(
        "只保留当前可用的封面服务、单个模型和 API Key；封面尺寸由正文封面提示词和内部默认值处理。",
        "Only the current cover service, the single available model, and the API key remain editable.",
      )}
      configPath="/cover/config"
      secretPath={(service) => `/cover/secret/${encodeURIComponent(service)}`}
      fallbackModel="gpt-image-2"
      saveMessage={tr("封面配置已保存", "Cover config saved")}
      autoSaveMessage={tr("封面配置已自动保存", "Cover config auto-saved")}
      saveErrorMessage={tr("保存封面配置失败", "Failed to save cover config")}
      testSuccessMessage={tr("连接成功", "Connection successful")}
      testErrorMessage={tr("连接失败", "Connection failed")}
      testConnection={async ({ service, apiKey }) => {
        try {
          const result = await fetchJson<{ ok?: boolean; error?: string; message?: string }>(
            `/services/${encodeURIComponent(service)}/test`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                apiKey,
                apiFormat: "chat",
                stream: true,
              }),
            },
          );
          return {
            ok: result.ok !== false,
            message: result.message ?? result.error,
          };
        } catch (error) {
          return {
            ok: false,
            message: error instanceof Error ? error.message : tr("连接失败", "Connection failed"),
          };
        }
      }}
    />
  );
}

function VoiceConfigCard() {
  return (
    <ServiceConfigSection
      title={tr("语音合成", "Voice synthesis")}
      description={tr(
        "只保留当前可用的语音服务、单个模型和 API Key；语音测试直接使用已保存的配置。",
        "Only the current voice service, the single available model, and the API key remain editable.",
      )}
      configPath="/voice/config"
      secretPath={(service) => `/voice/secret/${encodeURIComponent(service)}`}
      fallbackModel=""
      saveMessage={tr("语音配置已保存", "Voice config saved")}
      autoSaveMessage={tr("语音配置已自动保存", "Voice config auto-saved")}
      saveErrorMessage={tr("保存语音配置失败", "Failed to save voice config")}
      testSuccessMessage={tr("连接成功", "Connection successful")}
      testErrorMessage={tr("连接失败", "Connection failed")}
      testConnection={async () => {
        try {
          const result = await fetchJson<{ success?: boolean; message?: string }>("/voice/test", {
            method: "POST",
          });
          return {
            ok: result.success !== false,
            message: result.message,
          };
        } catch (error) {
          return {
            ok: false,
            message: error instanceof Error ? error.message : tr("连接失败", "Connection failed"),
          };
        }
      }}
    />
  );
}

export function ServiceListPage({ nav }: { nav: Nav }) {
  const services = useServiceStore((s) => s.services);
  const loading = useServiceStore((s) => s.servicesLoading);
  const fetchServices = useServiceStore((s) => s.fetchServices);

  useEffect(() => {
    void fetchServices();
  }, [fetchServices]);

  const bankServices = useMemo(
    () => services.filter((svc) => svc.service === "astronCodingPlan"),
    [services],
  );
  const customServices = useMemo(
    () => services.filter((s) => s.service.startsWith("custom")),
    [services],
  );

  const filteredCustom = useMemo(() => customServices, [customServices]);
  const canCreateCustom = true;
  const showCustomSection = !loading && (filteredCustom.length > 0 || canCreateCustom);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          {tr("文本大模型", "Text Models")}
        </h2>

        {loading && (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }, (_, index) => <SkeletonCard key={index} />)}
          </div>
        )}

        {!loading && bankServices.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {bankServices.map((svc) => (
              <ServiceCard
                key={svc.service}
                svc={svc}
                onClick={() => nav.toServiceDetail(svc.service)}
              />
            ))}
          </div>
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

      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          {tr("图片大模型", "Image Models")}
        </h2>
        <CoverConfigCard />
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          {tr("语音大模型", "Voice Models")}
        </h2>
        <VoiceConfigCard />
      </section>
    </div>
  );
}
