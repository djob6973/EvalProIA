import { Bell, Menu } from "lucide-react";
import { useLayout } from "@/components/AppShell";
import { useEffect, useRef, useState } from "react";

type NotifItem = { live: boolean; text: string; meta: string };

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  notifications?: NotifItem[];
};

export function PageHeader({ title, subtitle, actions, notifications = [] }: PageHeaderProps) {
  const { setMobileOpen } = useLayout();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [notifOpen]);

  return (
    <div className="mb-[24px] flex items-center justify-between gap-4">
      {/* Left: mobile menu + title + subtitle */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] transition hover:bg-[var(--sidebar-accent)] md:hidden"
          aria-label="Abrir menú"
        >
          <Menu className="size-[18px]" strokeWidth={1.5} />
        </button>
        <div>
          <h1
            className="font-display text-[32px] font-medium leading-[1.25] tracking-[-0.01em]"
            style={{ color: "var(--foreground)" }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="mt-[6px] text-[16px] font-normal" style={{ color: "var(--muted-foreground)" }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right: bell + actions */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Notification bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="relative grid h-9 w-9 place-items-center rounded-[12px] transition-colors hover:bg-[var(--sidebar-accent)]"
            style={{ color: "var(--muted-foreground)" }}
            title="Notificaciones"
          >
            <Bell className="size-[20px]" strokeWidth={1.5} />
            {notifications.length > 0 && (
              <span
                className="absolute bottom-[7px] right-[7px] h-[7px] w-[7px] rounded-full ring-2 ring-[var(--background)]"
                style={{ background: "var(--accent)" }}
              />
            )}
          </button>

          {notifOpen && (
            <div
              className="absolute right-0 top-11 z-50 w-[300px] overflow-hidden rounded-[16px]"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              }}
            >
              <div className="border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
                <span
                  className="font-mono text-[10px] font-bold uppercase tracking-[.16em]"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Actividad Reciente
                </span>
              </div>

              {notifications.length === 0 ? (
                <div
                  className="px-4 py-6 text-center text-[13px]"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Sin actividad reciente
                </div>
              ) : (
                <div className="flex flex-col">
                  {notifications.map((n, i) => (
                    <div
                      key={i}
                      className="flex gap-3 px-4 py-3"
                      style={{
                        borderBottom:
                          i < notifications.length - 1
                            ? "1px solid var(--border)"
                            : "none",
                      }}
                    >
                      <span
                        className="mt-[5px] h-2 w-2 shrink-0 rounded-full"
                        style={{
                          background: n.live ? "var(--accent)" : "var(--muted-foreground)",
                          opacity: n.live ? 1 : 0.35,
                          animation: n.live ? "pulse 1.6s ease infinite" : "none",
                        }}
                      />
                      <div>
                        <div className="text-[13px] font-medium" style={{ color: "var(--foreground)" }}>
                          {n.text}
                        </div>
                        <div className="mt-[2px] text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                          {n.meta}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {actions}
      </div>
    </div>
  );
}
