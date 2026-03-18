"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "dashboard", exact: true },
  { href: "/events", label: "Events", icon: "warning", exact: false },
  { href: "/benchmark", label: "Benchmark", icon: "query_stats", exact: false },
  { href: "/model", label: "Predictive Analytics", icon: "memory", exact: false },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 flex-shrink-0 bg-panel-dark border-r border-border-dark flex flex-col">
      {/* Logo */}
      <div className="h-14 flex items-center gap-3 px-4 border-b border-border-dark">
        <div className="size-8 bg-primary/20 rounded-lg flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-lg">wind_power</span>
        </div>
        <div>
          <p className="font-bold text-sm text-slate-100 leading-tight">Aeolus</p>
          <p className="text-[10px] text-slate-500 leading-tight">Wind Farm A</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon, exact }) => {
          const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
              )}
            >
              <span className="material-symbols-outlined text-xl">{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border-dark text-[10px] text-slate-600">
        CARE Benchmark v1.0
      </div>
    </aside>
  );
}
