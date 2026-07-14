import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { useToastStore, type ToastVariant } from "../store/toast/store";

const variantConfig: Record<
  ToastVariant,
  { icon: typeof CheckCircle2; ring: string; iconColor: string }
> = {
  success: { icon: CheckCircle2, ring: "border-emerald-500/30", iconColor: "text-emerald-500" },
  error: { icon: AlertCircle, ring: "border-destructive/30", iconColor: "text-destructive" },
  info: { icon: Info, ring: "border-primary/30", iconColor: "text-primary" },
};

function ToastCard({
  toast,
  onDismiss,
}: {
  readonly toast: { readonly id: number; readonly title: string; readonly description?: string; readonly variant: ToastVariant };
  readonly onDismiss: () => void;
}) {
  const cfg = variantConfig[toast.variant];
  const Icon = cfg.icon;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border ${cfg.ring} bg-card/95 backdrop-blur-md shadow-lg shadow-black/10 px-4 py-3 min-w-[280px] max-w-[420px] transition-all duration-300 ${
        visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"
      }`}
    >
      <Icon size={18} className={`mt-0.5 shrink-0 ${cfg.iconColor}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-5">{toast.title}</p>
        {toast.description ? (
          <p className="mt-0.5 text-xs text-muted-foreground leading-4 break-words">{toast.description}</p>
        ) : null}
      </div>
      <button
        onClick={onDismiss}
        className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismissToast);
  const containerRef = useRef<HTMLDivElement>(null);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={containerRef}
      className="fixed bottom-4 right-4 z-[200] flex flex-col-reverse gap-2 pointer-events-none"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastCard toast={t} onDismiss={() => dismiss(t.id)} />
        </div>
      ))}
    </div>,
    document.body,
  );
}
