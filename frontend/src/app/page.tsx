"use client";

import { useCareScores } from "@/hooks/useCareScores";
import { useEvents } from "@/hooks/useEvents";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EventBadge } from "@/components/events/EventBadge";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { Layout, Data } from "plotly.js";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

function fmt(v: number | null | undefined) {
  if (v == null) return "—";
  return (v * 100).toFixed(1) + "%";
}

interface KpiCardProps {
  label: string;
  value: string;
  icon: string;
  progress: number;
}

function KpiCard({ label, value, icon, progress }: KpiCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl p-6 bg-panel-dark border border-border-dark">
      <div className="flex justify-between items-start">
        <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider">{label}</p>
        <span className="material-symbols-outlined text-primary">{icon}</span>
      </div>
      <p className="text-slate-100 text-3xl font-bold">{value}</p>
      <div className="w-full bg-border-dark h-1.5 rounded-full overflow-hidden">
        <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${Math.min(100, progress * 100)}%` }} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: care, isLoading: careLoading } = useCareScores();
  const { data: events, isLoading: eventsLoading } = useEvents("all");

  const anomalyEvents = events?.filter((e) => e.event_label === "anomaly") ?? [];
  const detectedEvents = anomalyEvents.filter((e) => e.has_detection);

  const radarData: Data[] = care
    ? [
        {
          type: "scatterpolar" as const,
          r: [care.coverage, care.accuracy, care.reliability, care.earliness, care.coverage],
          theta: ["Coverage", "Accuracy", "Reliability", "Earliness", "Coverage"],
          fill: "toself" as const,
          fillcolor: "rgba(17,82,212,0.25)",
          line: { color: "#1152d4", width: 2 },
          name: "CARE scores",
        },
      ]
    : [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-100">Fleet CARE Overview</h1>
          <p className="text-slate-400 text-sm mt-1">Wind Farm A — Isolation Forest anomaly detection results</p>
        </div>
        <Link
          href="/benchmark"
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-bold text-sm transition-all"
        >
          <span className="material-symbols-outlined text-sm">bar_chart</span>
          Full Benchmark
        </Link>
      </div>

      {/* KPI Cards */}
      {careLoading ? (
        <div className="flex justify-center py-10"><LoadingSpinner /></div>
      ) : care ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KpiCard label="Coverage" value={fmt(care.coverage)} icon="analytics" progress={care.coverage} />
          <KpiCard label="Accuracy" value={fmt(care.accuracy)} icon="target" progress={care.accuracy} />
          <KpiCard label="Reliability" value={fmt(care.reliability)} icon="verified" progress={care.reliability} />
          <KpiCard label="Earliness" value={fmt(care.earliness)} icon="schedule" progress={care.earliness} />
        </div>
      ) : null}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Radar */}
        <div className="lg:col-span-1 rounded-xl bg-panel-dark border border-border-dark p-6 flex flex-col items-center">
          <h2 className="text-slate-100 text-lg font-bold self-start mb-4">CARE Balance</h2>
          {care && (
            <Plot
              data={radarData}
              layout={{
                paper_bgcolor: "#1a2233",
                polar: {
                  bgcolor: "#1a2233",
                  radialaxis: { range: [0, 1], gridcolor: "#2d3a54", tickfont: { color: "#64748b", size: 8 } },
                  angularaxis: { gridcolor: "#2d3a54", tickfont: { color: "#94a3b8", size: 10 } },
                },
                showlegend: false,
                margin: { l: 40, r: 40, t: 20, b: 20 },
                height: 260,
              } as Partial<Layout>}
              config={{ responsive: true, displayModeBar: false }}
              style={{ width: "100%" }}
            />
          )}
          <div className="text-center mt-2">
            <p className="text-slate-500 text-xs font-medium uppercase tracking-widest">CARE Score</p>
            <p className="text-slate-100 text-4xl font-black mt-1">{care ? (care.care * 100).toFixed(1) : "—"}</p>
          </div>
        </div>

        {/* Anomaly events summary */}
        <div className="lg:col-span-2 rounded-xl bg-panel-dark border border-border-dark p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-slate-100 text-lg font-bold">Detection Summary</h2>
            <div className="flex gap-4 text-sm">
              <span className="text-slate-400">{detectedEvents.length} detected</span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-400">{anomalyEvents.length} total anomaly events</span>
            </div>
          </div>

          {/* Detection bar */}
          {care && (
            <div className="mb-6">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Detection rate</span>
                <span>{detectedEvents.length}/{anomalyEvents.length}</span>
              </div>
              <div className="w-full bg-border-dark h-2 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full"
                  style={{ width: `${anomalyEvents.length > 0 ? (detectedEvents.length / anomalyEvents.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Metric breakdown */}
          {care && (
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-background-dark rounded-lg border border-border-dark">
                <p className="text-xs text-slate-500 mb-1">Normal event TN rows</p>
                <p className="text-lg font-bold text-slate-100">{care.total_tn.toLocaleString()}</p>
                <p className="text-xs text-slate-600">of {care.total_normal_prediction_rows.toLocaleString()} pred rows</p>
              </div>
              <div className="p-3 bg-background-dark rounded-lg border border-border-dark">
                <p className="text-xs text-slate-500 mb-1">Anomaly events detected</p>
                <p className="text-lg font-bold text-slate-100">{care.anomaly_events_with_detection}</p>
                <p className="text-xs text-slate-600">of {care.anomaly_event_count} anomaly events</p>
              </div>
            </div>
          )}

          {care?.care_zero_reason && (
            <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-800/40 rounded-lg text-yellow-400 text-xs">
              CARE forced to 0: {care.care_zero_reason}
            </div>
          )}
        </div>
      </div>

      {/* Anomaly events table */}
      <div className="rounded-xl bg-panel-dark border border-border-dark overflow-hidden">
        <div className="p-5 border-b border-border-dark flex justify-between items-center">
          <div>
            <h2 className="text-slate-100 text-lg font-bold">Anomaly Events with Detection</h2>
            <p className="text-slate-500 text-sm">Events where model flagged at least one prediction row</p>
          </div>
          <Link href="/events" className="text-xs font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
            View all <span className="material-symbols-outlined text-sm">chevron_right</span>
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-background-dark/50">
              <tr>
                <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Event ID</th>
                <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Description</th>
                <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Asset</th>
                <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Coverage</th>
                <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Earliness</th>
                <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-dark">
              {eventsLoading && (
                <tr><td colSpan={6} className="px-5 py-8 text-center"><LoadingSpinner className="mx-auto" /></td></tr>
              )}
              {detectedEvents.map((ev) => (
                <tr key={ev.event_id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="px-5 py-3">
                    <span className="text-sm font-bold text-primary">#{ev.event_id}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm text-slate-300">{ev.event_description || "—"}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm text-slate-400">Asset #{ev.asset_id}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm text-slate-300">{ev.coverage != null ? (ev.coverage * 100).toFixed(1) + "%" : "—"}</span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-border-dark h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-primary h-full"
                          style={{ width: `${(ev.earliness_weight ?? 0) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400">{ev.earliness_weight != null ? (ev.earliness_weight * 100).toFixed(0) + "%" : "—"}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/events/${ev.event_id}`} className="text-primary hover:text-primary/70 transition-colors">
                      <span className="material-symbols-outlined">visibility</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
