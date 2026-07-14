import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { isAbsolute } from "node:path";
import { ApiError } from "../errors.js";

const CONTENTFUL_STATUS_CODES: ReadonlySet<number> = new Set([
  100, 102, 103,
  200, 201, 202, 203, 206, 207, 208, 226,
  300, 301, 302, 303, 305, 306, 307, 308,
  400, 401, 402, 403, 404, 405, 406, 407, 408, 409, 410, 411, 412, 413, 414, 415, 416, 417, 418,
  421, 422, 423, 424, 425, 426, 428, 429, 431, 451,
  500, 501, 502, 503, 504, 505, 506, 507, 508, 510, 511,
]);

function isContentfulStatusCode(value: number): value is ContentfulStatusCode {
  return CONTENTFUL_STATUS_CODES.has(value);
}

export function errorResponse(c: Context, error: unknown): Response {
  if (error instanceof ApiError) {
    const status = isContentfulStatusCode(error.status) ? error.status : 500;
    return c.json({ error: { code: error.code, message: error.message } }, status);
  }

  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("LLM API key not set") || message.includes("STORYOS_LLM_API_KEY not set")) {
    return c.json({ error: { code: "LLM_CONFIG_ERROR", message } }, 400);
  }

  return c.json(
    { error: { code: "INTERNAL_ERROR", message: "Unexpected server error." } },
    500,
  );
}

export function storyAssetErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  const message = String(error);
  return message && message !== "[object Object]" ? message : "Story asset request failed.";
}

export function normalizeLanguage(value: unknown): "zh" | "en" {
  return value === "en" ? "en" : "zh";
}

export function attachmentDisposition(fileName: string): string {
  const safeAscii = fileName.replace(/[^A-Za-z0-9._-]+/g, "_") || "download";
  return `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export function normalizeRelativePath(
  value: string,
  options: { readonly code?: string; readonly message?: string } = {},
): string {
  const invalidPath = () => new ApiError(400, options.code ?? "INVALID_RELATIVE_PATH", options.message ?? "Invalid relative path.");
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    throw invalidPath();
  }

  const normalized = decoded.replace(/\\/gu, "/").replace(/^\.\//u, "");
  if (
    !normalized
    || normalized.includes("\0")
    || normalized.startsWith("/")
    || /^[A-Za-z]:/u.test(normalized)
    || isAbsolute(normalized)
    || normalized.split("/").includes("..")
  ) {
    throw invalidPath();
  }

  return normalized;
}
