"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Brain, LayoutDashboard, TrendingUp, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    label: "仪表盘",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "交易日志",
    href: "/journal",
    icon: BookOpen,
  },
  {
    label: "思考笔记",
    href: "/thoughts",
    icon: Brain,
  },
] as const;

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
          "fixed left-0 top-0 z-40 h-full w-56 flex flex-col",
          "bg-surface-1 border-r border-border",
          "transition-transform duration-200 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0 lg:static lg:z-auto"
        )}
      >
        <div className="flex items-center justify-between h-14 px-4 border-b border-border shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2.5 group" onClick={onClose}>
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-accent/10 border border-accent/20">
              <TrendingUp className="w-4 h-4 text-accent" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary tracking-tight leading-none">
                Dogen
              </p>
              <p className="text-2xs text-text-muted tracking-widest uppercase">
                Capital
              </p>
            </div>
          </Link>

          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          <p className="px-2 mb-2 text-2xs font-semibold uppercase tracking-widest text-text-muted">
            导航
          </p>
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");

            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-150",
                  "group relative",
                  active
                    ? "bg-surface-3 text-text-primary"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-2"
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-accent rounded-r-full" />
                )}
                <Icon
                  className={cn(
                    "w-4 h-4 shrink-0 transition-colors",
                    active ? "text-accent" : "text-text-muted group-hover:text-text-secondary"
                  )}
                />
                <span className="font-medium">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-border shrink-0">
          <p className="text-2xs text-text-muted">
            &copy; {new Date().getFullYear()} Dogen Capital
          </p>
        </div>
      </aside>
    </>
  );
}
