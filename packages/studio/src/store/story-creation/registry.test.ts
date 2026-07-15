import { describe, it, expect, vi } from "vitest";
import {
  PENDING_CREATION_TIMEOUT_MS,
  registerPendingCreation,
  unregisterPendingCreation,
  getPendingCreation,
  completePendingCreation,
  failPendingCreation,
  onCreationCompleted,
  onCreationFailed,
} from "./registry";

const makeEntry = (sessionId: string, kind: "book" | "short" = "book") => ({
  sessionId,
  kind,
  title: "Test",
  createdAt: Date.now(),
});

describe("pending creation registry", () => {
  it("register and lookup", () => {
    registerPendingCreation(makeEntry("s1"));
    expect(getPendingCreation("s1")?.title).toBe("Test");
    expect(getPendingCreation("nonexistent")).toBeUndefined();
    unregisterPendingCreation("s1");
  });

  it("unregister removes entry", () => {
    registerPendingCreation(makeEntry("s2"));
    unregisterPendingCreation("s2");
    expect(getPendingCreation("s2")).toBeUndefined();
  });

  it("keeps long-running background creation registered until it completes", () => {
    registerPendingCreation({
      ...makeEntry("long-running-short", "short"),
      createdAt: Date.now() - 30 * 60 * 1000,
    });

    expect(getPendingCreation("long-running-short")).toEqual(
      expect.objectContaining({ kind: "short" }),
    );
    unregisterPendingCreation("long-running-short");
  });

  it("removes entries after the configured background creation window", () => {
    registerPendingCreation({
      ...makeEntry("stale-creation"),
      createdAt: Date.now() - PENDING_CREATION_TIMEOUT_MS - 1,
    });

    expect(getPendingCreation("stale-creation")).toBeUndefined();
  });

  it("completePendingCreation fires handler and removes entry", () => {
    registerPendingCreation(makeEntry("s3", "short"));
    const handler = vi.fn();
    const unsub = onCreationCompleted(handler);
    completePendingCreation("s3", "short-001");
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: "s3", kind: "short" }),
      { storyId: "short-001" },
    );
    expect(getPendingCreation("s3")).toBeUndefined();
    unsub();
  });

  it("failPendingCreation fires handler and removes entry", () => {
    registerPendingCreation(makeEntry("s4"));
    const handler = vi.fn();
    const unsub = onCreationFailed(handler);
    failPendingCreation("s4", "boom");
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: "s4" }),
      "boom",
    );
    expect(getPendingCreation("s4")).toBeUndefined();
    unsub();
  });

  it("complete on unregistered session is a no-op", () => {
    const handler = vi.fn();
    const unsub = onCreationCompleted(handler);
    completePendingCreation("never-registered", "x");
    expect(handler).not.toHaveBeenCalled();
    unsub();
  });

  it("onCreationCompleted unsubscribe stops future calls", () => {
    registerPendingCreation(makeEntry("s5"));
    const handler = vi.fn();
    const unsub = onCreationCompleted(handler);
    unsub();
    completePendingCreation("s5", "x");
    expect(handler).not.toHaveBeenCalled();
  });
});
