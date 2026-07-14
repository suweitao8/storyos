import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useToastStore, toast } from "./store";

describe("toast store", () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("pushToast adds a toast with auto-incrementing id", () => {
    const id1 = useToastStore.getState().pushToast({ title: "A", variant: "success", timeout: 0 });
    const id2 = useToastStore.getState().pushToast({ title: "B", variant: "info", timeout: 0 });
    expect(id1).toBeLessThan(id2);
    expect(useToastStore.getState().toasts).toHaveLength(2);
    expect(useToastStore.getState().toasts[0]!.title).toBe("A");
    expect(useToastStore.getState().toasts[1]!.title).toBe("B");
  });

  it("dismissToast removes the toast by id", () => {
    const id = useToastStore.getState().pushToast({ title: "X", variant: "error", timeout: 0 });
    useToastStore.getState().dismissToast(id);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("auto-dismisses after timeout", () => {
    useToastStore.getState().pushToast({ title: "T", variant: "info", timeout: 3000 });
    expect(useToastStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(2999);
    expect(useToastStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(2);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("timeout=0 keeps the toast until manually dismissed", () => {
    useToastStore.getState().pushToast({ title: "Persist", variant: "info", timeout: 0 });
    vi.advanceTimersByTime(60000);
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it("toast helper functions push correct variants", () => {
    toast.success("ok");
    toast.error("bad");
    toast.info("hey");
    const items = useToastStore.getState().toasts;
    expect(items).toHaveLength(3);
    expect(items[0]!.variant).toBe("success");
    expect(items[1]!.variant).toBe("error");
    expect(items[2]!.variant).toBe("info");
  });
});
