import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { ApiError } from "../../errors.js";
import {
  attachmentDisposition,
  errorResponse,
  normalizeLanguage,
  normalizeRelativePath,
  storyAssetErrorMessage,
} from "../boundary.js";

describe("Studio API boundaries", () => {
  it("falls back to Chinese for unsupported languages", () => {
    expect(normalizeLanguage("en")).toBe("en");
    expect(normalizeLanguage("zh")).toBe("zh");
    expect(normalizeLanguage("fr")).toBe("zh");
    expect(normalizeLanguage(undefined)).toBe("zh");
  });

  it("removes CR/LF from Content-Disposition fallback names", () => {
    const header = attachmentDisposition("report\r\nX-Injected: yes.txt");

    expect(header).not.toMatch(/[\r\n]/u);
    expect(header).toContain('filename="report_X-Injected_yes.txt"');
    expect(header).toContain("filename*=UTF-8''report%0D%0AX-Injected%3A%20yes.txt");
  });

  it("normalizes separators and rejects relative path traversal", () => {
    expect(normalizeRelativePath("./nested\\file.txt")).toBe("nested/file.txt");
    expect(() => normalizeRelativePath("../secret.txt")).toThrow(ApiError);
    expect(() => normalizeRelativePath("nested/../../secret.txt")).toThrow(ApiError);
    expect(() => normalizeRelativePath("C:foo\\bar.txt")).toThrow(ApiError);
    expect(() => normalizeRelativePath("C:\\foo\\bar.txt")).toThrow(ApiError);
    expect(() => normalizeRelativePath("\\\\server\\share\\file.txt")).toThrow(ApiError);
  });

  it("rejects malformed URI-encoded paths", () => {
    expect(() => normalizeRelativePath("%E0%A4%A")).toThrow(ApiError);
  });

  it("keeps story asset error messages useful without object leakage", () => {
    expect(storyAssetErrorMessage(new Error("asset generation failed"))).toBe("asset generation failed");
    expect(storyAssetErrorMessage({})).toBe("Story asset request failed.");
  });

  it("preserves ApiError code and status in JSON responses", async () => {
    const app = new Hono();
    app.onError((error, c) => errorResponse(c, error));
    app.get("/", () => {
      throw new ApiError(422, "INVALID_BOUNDARY", "Boundary input is invalid.");
    });

    const response = await app.request("/");

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: { code: "INVALID_BOUNDARY", message: "Boundary input is invalid." },
    });
  });

  it("redacts ordinary exception details", async () => {
    const app = new Hono();
    app.onError((error, c) => errorResponse(c, error));
    app.get("/", () => {
      throw new Error("secret file path and provider token");
    });

    const response = await app.request("/");
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Unexpected server error." },
    });
    expect(JSON.stringify(body)).not.toContain("provider token");
  });
});
