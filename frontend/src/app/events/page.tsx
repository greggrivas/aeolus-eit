"use client";

import { useAeolusStore } from "@/store/useAeolusStore";
import { useEvents } from "@/hooks/useEvents";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export default function EventsPage() {
  const labelFilter = useAeolusStore((s) => s.labelFilter);
  const setLabelFilter = useAeolusStore((s) => s.setLabelFilter);
  const { data: events, isLoading } = useEvents(labelFilter);
  const router = useRouter();

  return (
    <div className="flex flex-1 h-full">
      {/* Left sidebar */}
      <aside className="w-60 border-r border-border-dark p-5 flex flex-col gap-6 bg-panel-dark/30 shrink-0">
        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Event Types</h3>
          <div className="flex flex-col gap-1">
            {(["all", "anomaly", "normal"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setLabelFilter(f)}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors capitalize",
                  labelFilter === f
                    ? "bg-primary text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                )}
              >
                <span className={clsx("material-symbols-outlined text-xl",
                  f === "anomaly" ? "text-amber-500" : f === "normal" ? "text-emerald-500" : ""
                )}>
                  {f === "all" ? "list" : f === "anomaly" ? "warning" : "check_circle"}
                </span>
                {f === "all" ? "All Events" : f === "anomaly" ? "Anomalies" : "Normal"}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-border-dark">
          <div className="rounded-xl bg-primary/10 p-3 border border-primary/20">
            <p className="text-xs font-semibold text-primary mb-1">API Endpoint</p>
            <code className="text-[10px] text-slate-500 break-all">/api/events?label_filter={labelFilter}</code>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-100">Wind Turbine Events</h2>
            <p className="text-sm text-slate-500 mt-0.5">Wind Farm A — CARE benchmark dataset</p>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border-dark bg-panel-dark overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-background-dark/50">
              <tr>
                <th className="px-5 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Event ID</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Label</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Description</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Asset</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Start</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pred Rows</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Coverage</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Detection</th>
                <th className="px-5 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-dark">
              {isLoading && (
                <tr>
                  <td colSpan={9} className="py-12 text-center">
                    <LoadingSpinner className="mx-auto" />
                  </td>
                </tr>
              )}
              {events?.map((ev) => (
                <tr
                  key={ev.event_id}
                  onClick={() => router.push(`/events/${ev.event_id}`)}
                  className="hover:bg-white/[0.03] transition-colors cursor-pointer"
                >
                  <td className="px-5 py-3.5 text-sm font-semibold text-primary">#{ev.event_id}</td>
                  <td className="px-5 py-3.5">
                    <span className={clsx(
                      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border",
                      ev.event_label === "anomaly"
                        ? "bg-amber-900/30 text-amber-400 border-amber-800/50"
                        : "bg-slate-800 text-slate-400 border-slate-700/50"
                    )}>
                      {ev.event_label}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-slate-400 max-w-[180px] truncate">
                    {ev.event_description || "—"}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-slate-400">#{ev.asset_id}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-500">{formatDate(ev.event_start)}</td>
                  <td className="px-5 py-3.5 text-sm tabular-nums text-slate-400">{ev.prediction_rows.toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-300">
                    {ev.coverage != null ? (ev.coverage * 100).toFixed(1) + "%" : "—"}
                  </td>
                  <td className="px-5 py-3.5">
                    {ev.has_detection ? (
                      <div className="flex items-center gap-1.5 text-emerald-500 text-xs font-medium">
                        <span className="material-symbols-outlined text-base">check_circle</span> Detected
                      </div>
                    ) : ev.event_label === "normal" ? (
                      <div className="flex items-center gap-1.5 text-slate-600 text-xs font-medium">
                        <span className="material-symbols-outlined text-base">do_not_disturb_on</span> N/A
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-amber-500 text-xs font-medium">
                        <span className="material-symbols-outlined text-base">warning</span> Missed
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button className="text-slate-500 hover:text-primary transition-colors">
                      <span className="material-symbols-outlined">visibility</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {events && (
          <p className="text-xs text-slate-600 mt-3">Showing {events.length} events</p>
        )}
      </main>
    </div>
  );
}
