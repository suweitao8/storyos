import type { Context } from "hono";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  DetectionConfigSchema,
  InputGovernanceModeSchema,
} from "@actalk/inkos-core";
import { ApiError } from "../errors.js";
import type { StudioRouteContext } from "./context.js";

export function registerProjectSettingsRoutes(context: StudioRouteContext): void {
  const { app, root, getProjectConfig } = context;

  app.get("/api/v1/project", async (c: Context) => {
    let currentConfig;
    let raw: Record<string, unknown>;
    try {
      currentConfig = await getProjectConfig({ requireApiKey: false });
      raw = JSON.parse(await readFile(join(root, "inkos.json"), "utf-8")) as Record<string, unknown>;
    } catch (error) {
      throw new ApiError(500, "PROJECT_CONFIG_INVALID", `Failed to load inkos.json: ${error instanceof Error ? error.message : String(error)}`);
    }
    return c.json({
      name: currentConfig.name,
      language: currentConfig.language,
      languageExplicit: "language" in raw && raw.language !== "",
      model: currentConfig.llm.model,
      provider: currentConfig.llm.provider,
      baseUrl: currentConfig.llm.baseUrl,
      stream: currentConfig.llm.stream,
      temperature: currentConfig.llm.temperature,
    });
  });

  app.put("/api/v1/project", async (c: Context) => {
    const updates = await c.req.json<Record<string, unknown>>();
    const configPath = join(root, "inkos.json");
    try {
      const existing = JSON.parse(await readFile(configPath, "utf-8")) as Record<string, any>;
      existing.llm ??= {};
      if (updates.temperature !== undefined) existing.llm.temperature = updates.temperature;
      if (updates.stream !== undefined) existing.llm.stream = updates.stream;
      if (updates.language === "zh" || updates.language === "en") existing.language = updates.language;
      await writeFile(configPath, JSON.stringify(existing, null, 2), "utf-8");
      return c.json({ ok: true });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  app.get("/api/v1/project/input-governance-mode", async (c: Context) => {
    const raw = JSON.parse(await readFile(join(root, "inkos.json"), "utf-8")) as Record<string, unknown>;
    return c.json({ mode: raw.inputGovernanceMode === "legacy" ? "legacy" : "v2" });
  });

  app.put("/api/v1/project/input-governance-mode", async (c: Context) => {
    const { mode } = await c.req.json<{ mode?: unknown }>();
    const parsed = InputGovernanceModeSchema.safeParse(mode);
    if (!parsed.success) return c.json({ error: "mode must be legacy or v2" }, 400);
    const configPath = join(root, "inkos.json");
    const raw = JSON.parse(await readFile(configPath, "utf-8")) as Record<string, unknown>;
    raw.inputGovernanceMode = parsed.data;
    await writeFile(configPath, JSON.stringify(raw, null, 2), "utf-8");
    return c.json({ ok: true, mode: parsed.data });
  });

  app.get("/api/v1/project/detection", async (c: Context) => {
    const raw = JSON.parse(await readFile(join(root, "inkos.json"), "utf-8")) as Record<string, unknown>;
    return c.json({ detection: raw.detection ?? null });
  });

  app.put("/api/v1/project/detection", async (c: Context) => {
    const { detection } = await c.req.json<{ detection?: unknown }>();
    const configPath = join(root, "inkos.json");
    const raw = JSON.parse(await readFile(configPath, "utf-8")) as Record<string, unknown>;
    if (detection === null) {
      delete raw.detection;
    } else {
      const parsed = DetectionConfigSchema.safeParse(detection);
      if (!parsed.success) return c.json({ error: parsed.error.issues.map((issue) => issue.message).join("; ") }, 400);
      raw.detection = parsed.data;
    }
    await writeFile(configPath, JSON.stringify(raw, null, 2), "utf-8");
    return c.json({ ok: true, detection: raw.detection ?? null });
  });
}
