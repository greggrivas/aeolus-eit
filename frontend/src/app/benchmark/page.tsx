"use client";

import { useCareScores, useEventCareScores } from "@/hooks/useCareScores";
import { MetricCard } from "@/components/ui/MetricCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EventBadge } from "@/components/events/EventBadge";
import dynamic from "next/dynamic";
import type { Layout, Data } from "plotly.js";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

function scoreVariant(v: number | null): "good" | "warn" | "bad" | "default" {
  if (v === null) return "default";
  if (v >= 0.7) return "good";
  if (v >= 0.4) return "warn";
  return "bad";
}

function fmt(v: number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return (v * 100).toFixed(1) + "%";
}

export default function BenchmarkPage() {
  const { data: care, isLoading } = useCareScores();
  const { data: eventScores } = useEventCareScores();

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  const radarData: Data[] = care
    ? [{
        type: "scatterpolar" as const,
        r: [care.coverage, care.accuracy, care.reliability, care.earliness, care.coverage],
        theta: ["Coverage", "Accuracy", "Reliability", "Earliness", "Coverage"],
        fill: "toself" as const,
        fillcolor: "rgba(59,130,246,0.2)",
        line: { color: "#3b82f6", width: 2 },
        name: "CARE scores",
      }]
    : [];

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-1">
        <div className="flex items-center gap-2 text-primary font-semibold text-sm">
          <span className="material-symbols-outlined text-sm">leaderboard</span>
          CARE BENCHMARK
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Wind Farm A — Isolation Forest</h2>
      </div>

      {/* Metric cards */}
      {care && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <MetricCard
            label="CARE"
            value={fmt(care.care)}
            subtitle="Weighted overall"
            variant={scoreVariant(care.care)}
          />
          <MetricCard
            label="Coverage"
            value={fmt(care.coverage)}
            subtitle="F2, anomaly events"
            variant={scoreVariant(care.coverage)}
          />
          <MetricCard
            label="Accuracy"
            value={fmt(care.accuracy)}
            subtitle="TN rate, normal events"
            variant={scoreVariant(care.accuracy)}
          />
          <MetricCard
            label="Reliability"
            value={fmt(care.reliability)}
            subtitle="ER-F2 alarm quality"
            variant={scoreVariant(care.reliability)}
          />
          <MetricCard
            label="Earliness"
            value={fmt(care.earliness)}
            subtitle="Detection timing"
            variant={scoreVariant(care.earliness)}
          />
        </div>
      )}

      {care?.care_zero_reason && (
        <div className="mb-4 bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-3 text-yellow-400 text-sm">
          CARE score is 0 — reason: {care.care_zero_reason}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Radar */}
        {care && (
          <div className="bg-panel-dark border border-border-dark rounded-xl p-4">
            <h2 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">Score Balance</h2>
            <Plot
              data={radarData}
              layout={{
                paper_bgcolor: "#1a2233",
                plot_bgcolor: "#1a2233",
                polar: {
                  bgcolor: "#1a2233",
                  radialaxis: { range: [0, 1], gridcolor: "#2d3a54", tickfont: { color: "#64748b", size: 9 } },
                  angularaxis: { gridcolor: "#2d3a54", tickfont: { color: "#94a3b8", size: 11 } },
                },
                showlegend: false,
                margin: { l: 40, r: 40, t: 20, b: 20 },
                height: 300,
              } as Partial<Layout>}
              config={{ responsive: true, displayModeBar: false }}
              style={{ width: "100%" }}
            />
          </div>
        )}

        {/* Earliness bars */}
        {eventScores && (
          <div className="bg-panel-dark border border-border-dark rounded-xl p-4">
            <h2 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">Earliness by Event</h2>
            <Plot
              data={[{
                type: "bar",
                orientation: "h",
                x: eventScores
                  .filter((e) => e.event_label === "anomaly" && e.earliness_weight !== null)
                  .map((e) => e.earliness_weight),
                y: eventScores
                  .filter((e) => e.event_label === "anomaly" && e.earliness_weight !== null)
                  .map((e) => `Event ${e.event_id}`),
                marker: {
                  color: eventScores
                    .filter((e) => e.event_label === "anomaly" && e.earliness_weight !== null)
                    .map((e) => (e.earliness_weight ?? 0) > 0.5 ? "#22c55e" : "#ef4444"),
                },
              }]}
              layout={{
                paper_bgcolor: "#1a2233",
                plot_bgcolor: "#1a2233",
                xaxis: { range: [0, 1], gridcolor: "#2d3a54", tickfont: { color: "#64748b", size: 9 } },
                yaxis: { tickfont: { color: "#94a3b8", size: 10 }, automargin: true },
                margin: { l: 80, r: 20, t: 10, b: 30 },
                height: 300,
              } as Partial<Layout>}
              config={{ responsive: true, displayModeBar: false }}
              style={{ width: "100%" }}
            />
          </div>
        )}
      </div>

      {/* Per-event table */}
      {eventScores && (
        <div className="bg-panel-dark border border-border-dark rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border-dark">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Per-Event Scores</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-dark text-slate-500 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Event</th>
                  <th className="text-left px-4 py-3">Label</th>
                  <th className="text-right px-4 py-3">Coverage</th>
                  <th className="text-right px-4 py-3">Rel. Alarm</th>
                  <th className="text-right px-4 py-3">Earliness</th>
                  <th className="text-right px-4 py-3">Detected</th>
                </tr>
              </thead>
              <tbody>
                {eventScores.map((e) => (
                  <tr key={e.event_id} className="border-b border-border-dark/50">
                    <td className="px-4 py-2.5 font-mono text-slate-300">{e.event_id}</td>
                    <td className="px-4 py-2.5"><EventBadge label={e.event_label} /></td>
                    <td className="px-4 py-2.5 text-right">{fmt(e.coverage)}</td>
                    <td className="px-4 py-2.5 text-right">
                      {e.reliability_alarm === null ? "—" : e.reliability_alarm ? (
                        <span className="text-green-400">YES</span>
                      ) : (
                        <span className="text-yellow-500">NO</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">{fmt(e.earliness_weight)}</td>
                    <td className="px-4 py-2.5 text-right">
                      {e.has_detection ? (
                        <span className="text-green-400">✓</span>
                      ) : (
                        <span className="text-red-500">✗</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
