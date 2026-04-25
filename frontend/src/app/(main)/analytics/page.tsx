"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import type { Layout, Data } from "plotly.js";
import { fetchSimulation, fetchFleetOverview, SimulationResult } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useFleetOverview } from "@/hooks/useFleet";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const MINS_PER_ROW = 10;

function toHours(rows: number) {
  return (rows * MINS_PER_ROW) / 60;
}

function fmtH(h: number) {
  if (h < 1) return `${Math.round(h * 60)}m`;
  return `${h.toFixed(1)}h`;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, color = "text-slate-100",
}: {
  label: string; value: string; sub: string; color?: string;
}) {
  return (
    <div className="bg-[#1a1f2e] border border-white/10 rounded-xl p-5 flex flex-col gap-1">
      <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-black tabular-nums ${color}`}>{value}</p>
      <p className="text-xs text-slate-500">{sub}</p>
    </div>
  );
}

// ── Simulation chart ──────────────────────────────────────────────────────────

function SimChart({ result }: { result: SimulationResult }) {
  const pts = result.points;
  const x = pts.map((p) => p.index);
  const y = pts.map((p) => p.anomaly_score);
  const flagged = pts.filter((p) => p.pred_anomaly === 1);
  const n = result.total_sampled;
  const fzStart = result.fault_zone_start_index;

  // Determine score direction: RF scores are 0-1 (higher = anomalous), IF scores are negative
  const isRF = y.some((v) => v > 0);
  const thresholdY = result.threshold;

  const traces: Partial<Data>[] = [
    {
      x, y,
      type: "scatter",
      mode: "lines",
      name: "Anomaly score",
      line: { color: "#3b82f6", width: 2 },
    },
    {
      x: flagged.map((p) => p.index),
      y: flagged.map((p) => p.anomaly_score),
      type: "scatter",
      mode: "markers",
      name: "Flagged",
      marker: { color: "#ef4444", size: 6, symbol: "circle" },
    },
    {
      x: [0, n - 1],
      y: [thresholdY, thresholdY],
      type: "scatter",
      mode: "lines",
      name: "Threshold",
      line: { color: "#ef4444", width: 1.5, dash: "dash" },
    },
  ];

  const shapes: Partial<Layout["shapes"][0]>[] = [];
  if (fzStart != null) {
    shapes.push({
      type: "rect",
      xref: "x", yref: "paper",
      x0: fzStart, x1: n - 1,
      y0: 0, y1: 1,
      fillcolor: "rgba(239,68,68,0.08)",
      line: { width: 0 },
    });
    shapes.push({
      type: "line",
      xref: "x", yref: "paper",
      x0: fzStart, x1: fzStart,
      y0: 0, y1: 1,
      line: { color: "#ef4444", width: 1.5, dash: "dot" },
    });
  }

  const annotations: Partial<Layout["annotations"][0]>[] = fzStart != null ? [{
    x: fzStart,
    y: 1,
    xref: "x",
    yref: "paper",
    text: "Fault zone",
    showarrow: false,
    font: { color: "#ef4444", size: 11 },
    xanchor: "left",
    yanchor: "top",
    xshift: 6,
  }] : [];

  const layout: Partial<Layout> = {
    paper_bgcolor: "#13182a",
    plot_bgcolor: "#13182a",
    font: { color: "#94a3b8", size: 11 },
    xaxis: {
      title: { text: "Row index (10-min samples)", font: { color: "#64748b", size: 11 } },
      gridcolor: "#1e293b",
      zerolinecolor: "#334155",
      tickfont: { color: "#64748b", size: 10 },
    },
    yaxis: {
      title: { text: "Anomaly score", font: { color: "#64748b", size: 11 } },
      gridcolor: "#1e293b",
      zerolinecolor: "#334155",
      tickfont: { color: "#64748b", size: 10 },
    },
    legend: {
      orientation: "h",
      y: 1.08,
      x: 0,
      font: { size: 11, color: "#94a3b8" },
      bgcolor: "transparent",
    },
    shapes: shapes as Layout["shapes"],
    annotations: annotations as Layout["annotations"],
    margin: { l: 55, r: 20, t: 20, b: 55 },
    height: 400,
  };

  return (
    <div className="bg-[#13182a] border border-white/10 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10">
        <p className="text-sm font-bold text-slate-100">Anomaly score over time — with fault event overlay</p>
      </div>
      <Plot
        data={traces as Data[]}
        layout={layout}
        config={{ responsive: true, displayModeBar: false }}
        style={{ width: "100%" }}
      />
    </div>
  );
}

// ── Live simulation tab ───────────────────────────────────────────────────────

function LiveSimulation() {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 100000));
  const [selectedEvent, setSelectedEvent] = useState<string | undefined>(undefined);
  const { data: fleet } = useFleetOverview();

  const { data: result, isLoading } = useQuery<SimulationResult>({
    queryKey: ["simulation", seed, selectedEvent],
    queryFn: ({ queryKey }) => {
      const [, keySeed, keyEvent] = queryKey as [string, number, string | undefined];
      const params = new URLSearchParams({ n: "400", seed: String(keySeed) });
      if (keyEvent) params.set("event_id", keyEvent);
      return fetch(`/api/simulate?${params}`).then((r) => r.json());
    },
    enabled: true,
  });

  const runAgain = useCallback(() => {
    setSeed(Math.floor(Math.random() * 100000));
  }, []);

  // Derived stats
  const firstAlert = result?.first_detection_index;
  const faultZone  = result?.fault_zone_start_index;
  const total      = result?.total_sampled ?? 400;
  const leadTimeHours = result?.lead_time_hours ?? null;
  const windowHours   = toHours(total);
  const firstAlertHours = firstAlert != null ? toHours(firstAlert) : null;
  const anomalyPct = result ? ((result.anomaly_count / result.total_sampled) * 100).toFixed(1) : null;

  // Anomaly event list for picker
  const anomalyEvents = fleet?.assets
    ? undefined  // use catalog from result
    : undefined;

  return (
    <div className="flex flex-col gap-5">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={runAgain}
          disabled={isLoading}
          className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-base">refresh</span>
          {isLoading ? "Running…" : result ? "Run Again" : "Run Simulation"}
        </button>
        <span className="text-xs text-slate-500">Replays a historical fault event through the model · 10-min SCADA samples</span>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner />
        </div>
      )}

      {result && !isLoading && (
        <>
          {/* Context subtitle */}
          <div className="text-sm text-slate-400">
            <span className="font-semibold text-slate-200">{result.event_description || `Event #${result.event_id}`}</span>
            {result.asset_id != null && <span className="text-slate-500"> · T-{result.asset_id}</span>}
            <span className="text-slate-500"> · {result.total_sampled} rows · 10-min samples = {windowHours.toFixed(1)} hours</span>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="CARE Lead Time"
              value={leadTimeHours != null ? `${Math.round(leadTimeHours)}h` : "—"}
              sub="advance warning before fault"
              color={leadTimeHours != null && leadTimeHours > 48 ? "text-emerald-400" : leadTimeHours != null && leadTimeHours > 0 ? "text-amber-400" : "text-slate-500"}
            />
            <StatCard
              label="First alert at"
              value={firstAlert != null ? `Row ${firstAlert}` : "Not detected"}
              sub={firstAlertHours != null ? `${firstAlertHours.toFixed(1)}h into window` : "no anomaly flagged"}
              color={firstAlert != null ? "text-amber-400" : "text-slate-500"}
            />
            <StatCard
              label="Anomalies flagged"
              value={result.anomaly_count > 0 ? String(result.anomaly_count) : "0"}
              sub={`${anomalyPct}% of window`}
              color={result.anomaly_count > 0 ? "text-red-400" : "text-slate-500"}
            />
            <StatCard
              label="Window length"
              value={`${windowHours.toFixed(0)}h`}
              sub={`${total} rows · 10-min samples`}
              color="text-slate-200"
            />
          </div>

          {/* Chart */}
          <SimChart result={result} />

          {/* Interpretation */}
          {leadTimeHours != null && (
            <div className={`rounded-xl border p-4 text-sm flex gap-3 ${leadTimeHours > 48 ? "bg-emerald-900/10 border-emerald-700/30" : "bg-amber-900/10 border-amber-700/30"}`}>
              <span className={`material-symbols-outlined shrink-0 ${leadTimeHours > 48 ? "text-emerald-400" : "text-amber-400"}`}>alarm</span>
              <p className="text-slate-300 leading-relaxed">
                The model provided <span className={`font-bold ${leadTimeHours > 48 ? "text-emerald-400" : "text-amber-400"}`}>{Math.round(leadTimeHours)} hours ({(leadTimeHours / 24).toFixed(1)} days) of advance warning</span> before
                this fault was confirmed — enough time to schedule preventive maintenance and avoid unplanned downtime.
                {firstAlert != null && <> First anomaly flag appeared at row {firstAlert} in this prediction window.</>}
              </p>
            </div>
          )}
          {firstAlert == null && (
            <div className="bg-red-900/10 border border-red-700/30 rounded-xl p-4 text-sm flex gap-3">
              <span className="material-symbols-outlined text-red-400 shrink-0">error</span>
              <p className="text-slate-300">Model did not flag any anomalies in this window. This could indicate the sampled window was taken before the fault escalated, or this event has weak sensor deviation.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Retrospective tab ─────────────────────────────────────────────────────────

function Retrospective() {
  const { data: fleet } = useFleetOverview();

  // Get lead time data from fleet assets
  const assets = fleet?.assets ?? [];
  const withLeadTime = assets
    .filter((a) => a.avg_lead_time_hours != null)
    .sort((a, b) => (b.avg_lead_time_hours ?? 0) - (a.avg_lead_time_hours ?? 0));

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-slate-400">
        For each turbine with detected fault events, the average lead time the model provided before fault confirmation.
        Higher = earlier warning.
      </p>

      {!fleet && <LoadingSpinner />}

      {fleet && (
        <>
          {/* Bar chart of lead times per asset */}
          <div className="bg-[#13182a] border border-white/10 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <p className="text-sm font-bold text-slate-100">Avg Lead Time by Turbine</p>
              <p className="text-xs text-slate-500 mt-0.5">Hours of advance warning before fault confirmation (per detected anomaly event)</p>
            </div>
            <Plot
              data={[{
                type: "bar",
                orientation: "h",
                x: withLeadTime.map((a) => a.avg_lead_time_hours),
                y: withLeadTime.map((a) => `T-${String(a.asset_id).padStart(2, "0")}`),
                marker: {
                  color: withLeadTime.map((a) =>
                    (a.avg_lead_time_hours ?? 0) > 100 ? "#22c55e"
                    : (a.avg_lead_time_hours ?? 0) > 24 ? "#f59e0b"
                    : "#ef4444"
                  ),
                },
                text: withLeadTime.map((a) => `${a.avg_lead_time_hours?.toFixed(0)}h`),
                textposition: "outside" as const,
                textfont: { color: "#94a3b8", size: 11 },
              }]}
              layout={{
                paper_bgcolor: "#13182a",
                plot_bgcolor: "#13182a",
                font: { color: "#94a3b8", size: 11 },
                xaxis: {
                  title: { text: "Avg lead time (hours)", font: { color: "#64748b", size: 11 } },
                  gridcolor: "#1e293b",
                  tickfont: { color: "#64748b", size: 10 },
                },
                yaxis: { tickfont: { color: "#94a3b8", size: 11 }, automargin: true },
                margin: { l: 10, r: 60, t: 10, b: 40 },
                height: Math.max(200, withLeadTime.length * 36 + 60),
              } as Partial<Layout>}
              config={{ responsive: true, displayModeBar: false }}
              style={{ width: "100%" }}
            />
          </div>

          {/* Summary table */}
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <div className="px-5 py-3 border-b border-white/10 bg-[#13182a]">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Per-Asset Detection Summary</p>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-[#13182a]/60">
                <tr>
                  {["Turbine", "Fault Events", "Detected", "Missed", "Avg Lead Time", "MTBF"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {assets.filter((a) => a.fault_events > 0).sort((a, b) => b.fault_events - a.fault_events).map((a) => (
                  <tr key={a.asset_id} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3 font-bold text-slate-200">T-{String(a.asset_id).padStart(2, "0")}</td>
                    <td className="px-5 py-3 tabular-nums text-slate-400">{a.fault_events}</td>
                    <td className="px-5 py-3 tabular-nums text-emerald-400">{a.detected}</td>
                    <td className="px-5 py-3 tabular-nums">
                      <span className={a.missed > 0 ? "text-red-400 font-bold" : "text-slate-500"}>{a.missed}</span>
                    </td>
                    <td className="px-5 py-3 tabular-nums text-amber-400">
                      {a.avg_lead_time_hours != null ? `${a.avg_lead_time_hours.toFixed(0)}h` : "—"}
                    </td>
                    <td className="px-5 py-3 tabular-nums text-violet-400">
                      {a.mtbf_days != null ? `${a.mtbf_days.toFixed(1)}d` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = "simulation" | "retrospective";

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>("simulation");

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-primary font-semibold text-sm mb-1">
          <span className="material-symbols-outlined text-sm">troubleshoot</span>
          DETECTION VALIDATION
        </div>
        <h2 className="text-2xl font-bold text-slate-100">Anomaly detection — simulation & validation</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Replay historical fault events through the model to validate detection sensitivity and lead time
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-border-dark">
        {([
          { id: "simulation" as Tab, label: "Live Simulation", icon: "play_circle" },
          { id: "retrospective" as Tab, label: "Retrospective", icon: "history" },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            <span className="material-symbols-outlined text-base">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "simulation" && <LiveSimulation />}
      {tab === "retrospective" && <Retrospective />}
    </div>
  );
}
