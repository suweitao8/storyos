import { create } from "zustand";

export type ToastVariant = "info" | "success" | "error";

export interface ToastItem {
  readonly id: number;
  readonly title: string;
  readonly description?: string;
  readonly variant: ToastVariant;
  /** Auto-dismiss timeout in ms; 0 means manual close only. */
  readonly timeout: number;
}

interface ToastStore {
  readonly toasts: ReadonlyArray<ToastItem>;
  readonly pushToast: (toast: Omit<ToastItem, "id">) => number;
  readonly dismissToast: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  pushToast: (toast) => {
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    const { timeout } = toast;
    if (timeout > 0) {
      setTimeout(() => get().dismissToast(id), timeout);
    }
    return id;
  },
  dismissToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));

/** Convenience helpers — callable from anywhere (hooks, SSE handlers, plain functions). */
export const toast = {
  success: (title: string, description?: string) =>
    useToastStore.getState().pushToast({ title, description, variant: "success", timeout: 5000 }),
  error: (title: string, description?: string) =>
    useToastStore.getState().pushToast({ title, description, variant: "error", timeout: 8000 }),
  info: (title: string, description?: string) =>
    useToastStore.getState().pushToast({ title, description, variant: "info", timeout: 5000 }),
};
