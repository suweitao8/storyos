import type { Context } from "hono";
import {
  COVER_PROVIDER_PRESETS,
  VOICE_PROVIDER_PRESETS,
  resolveCoverProviderPreset,
  resolveVoiceProviderPreset,
  type SecretsFile,
} from "@actalk/inkos-core";
import { coverSecretKey, voiceSecretKey } from "@actalk/inkos-core";
import type { StudioRouteContext } from "./context.js";

function normalizeCover(raw: unknown): { service: string; model: string } | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const record = raw as Record<string, unknown>;
  const service = typeof record.service === "string" ? record.service : "";
  const preset = resolveCoverProviderPreset(service);
  if (!preset) return undefined;
  const requestedModel = typeof record.model === "string" ? record.model.trim() : "";
  return {
    service: preset.service,
    model: requestedModel && preset.models.includes(requestedModel)
      ? requestedModel
      : preset.defaultModel,
  };
}

function serviceHasKey(secrets: SecretsFile, service: string, keyFor: (service: string) => string): boolean {
  return Boolean(secrets.services[keyFor(service)]?.apiKey);
}

export function registerProviderRoutes(context: StudioRouteContext): void {
  const {
    app,
    loadRawConfig,
    saveRawConfig,
    loadSecrets,
    saveSecrets,
    isHeaderSafeApiKey,
    testCoverProviderConnection,
    testVoiceProviderConnection,
  } = context;

  app.get("/api/v1/cover/config", async (c: Context) => {
    const config = await loadRawConfig();
    const llm = (config.llm as Record<string, unknown> | undefined) ?? {};
    const cover = normalizeCover(llm.cover);
    const secrets = await loadSecrets();
    const keyFor = (service: string): boolean => serviceHasKey(secrets, service, coverSecretKey);
    const envConfigured = Boolean(
      (process.env.STORYOS_COVER_BASE_URL || process.env.STORYOS_COVER_ENDPOINT)
      && (process.env.STORYOS_COVER_API_KEY || keyFor("kkaiapi")),
    );
    const configured = Boolean(cover?.service && keyFor(cover.service)) || envConfigured;
    return c.json({
      service: cover?.service ?? null,
      model: cover?.model ?? null,
      configured,
      providers: COVER_PROVIDER_PRESETS.map((provider) => ({
        service: provider.service,
        label: provider.label,
        baseUrl: provider.baseUrl,
        defaultModel: provider.defaultModel,
        models: provider.models,
        connected: keyFor(provider.service),
      })),
    });
  });

  app.put("/api/v1/cover/config", async (c: Context) => {
    const body = await c.req.json<{ service?: string; model?: string }>();
    const preset = resolveCoverProviderPreset(body.service);
    if (!preset) return c.json({ error: "Unsupported cover service" }, 400);
    const model = typeof body.model === "string" && preset.models.includes(body.model)
      ? body.model
      : preset.defaultModel;
    const config = await loadRawConfig();
    config.llm = config.llm ?? {};
    const llm = config.llm as Record<string, unknown>;
    llm.cover = { service: preset.service, model };
    await saveRawConfig(config);
    return c.json({ ok: true, service: preset.service, model });
  });

  app.get("/api/v1/cover/secret/:service", async (c: Context) => {
    const service = c.req.param("service") ?? "";
    if (!resolveCoverProviderPreset(service)) return c.json({ error: "Unsupported cover service" }, 400);
    const secrets = await loadSecrets();
    return c.json({ apiKey: secrets.services[coverSecretKey(service)]?.apiKey ?? "" });
  });

  app.put("/api/v1/cover/secret/:service", async (c: Context) => {
    const service = c.req.param("service") ?? "";
    if (!resolveCoverProviderPreset(service)) return c.json({ error: "Unsupported cover service" }, 400);
    const body = await c.req.json<{ apiKey?: string }>();
    const trimmedKey = body.apiKey?.trim() ?? "";
    if (trimmedKey && !isHeaderSafeApiKey(trimmedKey)) {
      return c.json({ error: "API key contains characters that cannot go into an HTTP Authorization header." }, 400);
    }
    const secrets = await loadSecrets();
    const key = coverSecretKey(service);
    if (trimmedKey) secrets.services[key] = { apiKey: trimmedKey };
    else delete secrets.services[key];
    await saveSecrets(secrets);
    return c.json({ ok: true, service });
  });

  app.post("/api/v1/cover/test", async (c: Context) => {
    const config = await loadRawConfig();
    const llm = (config.llm as Record<string, unknown> | undefined) ?? {};
    const cover = normalizeCover(llm.cover);
    const service = cover?.service ?? "grsai";
    const preset = resolveCoverProviderPreset(service);
    if (!preset) return c.json({ error: "Unsupported cover service" }, 400);
    const secrets = await loadSecrets();
    const apiKey = secrets.services[coverSecretKey(service)]?.apiKey ?? "";
    if (!apiKey) return c.json({ error: "Cover API key not configured" }, 400);
    try {
      return c.json(await testCoverProviderConnection({ baseUrl: preset.baseUrl, apiKey }));
    } catch (error) {
      return c.json({ success: false, message: error instanceof Error ? error.message : String(error) }, 500);
    }
  });

  app.get("/api/v1/voice/config", async (c: Context) => {
    const config = await loadRawConfig();
    const llm = (config.llm as Record<string, unknown> | undefined) ?? {};
    const voice = (llm.voice as { service?: string; model?: string } | undefined) ?? {};
    const secrets = await loadSecrets();
    const keyFor = (service: string): boolean => serviceHasKey(secrets, service, voiceSecretKey);
    return c.json({
      service: voice.service ?? null,
      model: voice.model ?? null,
      configured: Boolean(voice.service && keyFor(voice.service)),
      providers: VOICE_PROVIDER_PRESETS.map((provider) => ({
        service: provider.service,
        label: provider.label,
        baseUrl: provider.baseUrl,
        defaultModel: provider.defaultModel,
        models: provider.models,
        connected: keyFor(provider.service),
      })),
    });
  });

  app.put("/api/v1/voice/config", async (c: Context) => {
    const body = await c.req.json<{ service?: string; model?: string }>();
    const preset = resolveVoiceProviderPreset(body.service);
    if (!preset) return c.json({ error: "Unsupported voice service" }, 400);
    const model = typeof body.model === "string" && preset.models.includes(body.model)
      ? body.model
      : preset.defaultModel;
    const config = await loadRawConfig();
    config.llm = config.llm ?? {};
    const llm = config.llm as Record<string, unknown>;
    llm.voice = { service: preset.service, model };
    await saveRawConfig(config);
    return c.json({ ok: true, service: preset.service, model });
  });

  app.get("/api/v1/voice/secret/:service", async (c: Context) => {
    const service = c.req.param("service") ?? "";
    if (!resolveVoiceProviderPreset(service)) return c.json({ error: "Unsupported voice service" }, 400);
    const secrets = await loadSecrets();
    return c.json({ apiKey: secrets.services[voiceSecretKey(service)]?.apiKey ?? "" });
  });

  app.put("/api/v1/voice/secret/:service", async (c: Context) => {
    const service = c.req.param("service") ?? "";
    if (!resolveVoiceProviderPreset(service)) return c.json({ error: "Unsupported voice service" }, 400);
    const body = await c.req.json<{ apiKey?: string }>();
    const trimmedKey = body.apiKey?.trim() ?? "";
    if (trimmedKey && !isHeaderSafeApiKey(trimmedKey)) {
      return c.json({ error: "API key contains characters that cannot go into an HTTP Authorization header." }, 400);
    }
    const secrets = await loadSecrets();
    const key = voiceSecretKey(service);
    if (trimmedKey) secrets.services[key] = { apiKey: trimmedKey };
    else delete secrets.services[key];
    await saveSecrets(secrets);
    return c.json({ ok: true, service });
  });

  app.post("/api/v1/voice/test", async (c: Context) => {
    const config = await loadRawConfig();
    const llm = (config.llm as Record<string, unknown> | undefined) ?? {};
    const voice = (llm.voice as { service?: string } | undefined) ?? {};
    const service = voice.service ?? "bailian";
    if (!resolveVoiceProviderPreset(service)) return c.json({ error: "Unsupported voice service" }, 400);
    const secrets = await loadSecrets();
    const apiKey = secrets.services[voiceSecretKey(service)]?.apiKey ?? "";
    if (!apiKey) return c.json({ error: "Voice API key not configured" }, 400);
    try {
      return c.json(await testVoiceProviderConnection({ apiKey }));
    } catch (error) {
      return c.json({ success: false, message: error instanceof Error ? error.message : String(error) }, 500);
    }
  });
}
