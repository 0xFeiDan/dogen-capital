"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Brain, LayoutDashboard, TrendingUp, Wallet, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    label: "\u4eea\u8868\u76d8",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "\u4ea4\u6613\u65e5\u5fd7",
    href: "/journal",
    icon: BookOpen,
  },
  {
    label: "\u5b9a\u6295",
    href: "/dca",
    icon: Wallet,
  },
  {
    label: "\u601d\u8003\u7b14\u8bb0",
    href: "/thoughts",
    icon: Brain,
  },
] as const;

const NAV_LABEL = "\u5bfc\u822a";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-full w-56 flex-col border-r border-border bg-surface-1 transition-transform duration-200 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:static lg:z-auto lg:translate-x-0"
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <Link href="/dashboard" className="group flex items-center gap-2.5" onClick={onClose}>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-accent/20 bg-accent/10">
              <TrendingUp className="h-4 w-4 text-accent" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-none tracking-tight text-text-primary">
                Dogen
              </p>
              <p className="text-2xs uppercase tracking-widest text-text-muted">Capital</p>
            </div>
          </Link>

          <button
            onClick={onClose}
            className="rounded-md p-1 text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary lg:hidden"
            aria-label="\u5173\u95ed\u83dc\u5355"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-2 text-2xs font-semibold uppercase tracking-widest text-text-muted">
            {NAV_LABEL}
          </p>
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);

            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150",
                  active
                    ? "bg-surface-3 text-text-primary"
                    : "text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-accent" />
                )}
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    active ? "text-accent" : "text-text-muted group-hover:text-text-secondary"
                  )}
                />
                <span className="font-medium">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-border px-4 py-4">
          <p className="text-2xs text-text-muted">
            &copy; {new Date().getFullYear()} Dogen Capital
          </p>
        </div>
      </aside>
    </>
  );
}
