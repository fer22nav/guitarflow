import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";
export function Panel({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const node = ref.current;
    node?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
      }
      if (e.key === "Tab" && node) {
        const items = [
          ...node.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not([type=hidden]),select,textarea,[tabindex="0"]',
          ),
        ].filter((n) => n.getClientRects().length > 0);
        const first = items[0];
        const last = items.at(-1);
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === node)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last || document.activeElement === node)
        ) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    window.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", key);
      before?.focus();
    };
  }, []);
  return (
    <div
      className="panel-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`utility-panel ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
      >
        <header className="panel-title">
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="Cerrar panel"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </header>
        <div className="panel-body">{children}</div>
      </div>
    </div>
  );
}
