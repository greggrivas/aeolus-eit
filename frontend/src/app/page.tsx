"use client";

import { useCareScores } from "@/hooks/useCareScores";
import { useEvents } from "@/hooks/useEvents";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EventBadge } from "@/components/events/EventBadge";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useState, useEffect, useRef, useMemo } from "react";
import type { Layout, Data } from "plotly.js";
import { fetchSimulation, SimulationResult } from "@/lib/api";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

function fmt(v: number | null | undefined) {
  if (v == null) return "—";
  return (v * 100).toFixed(1) + "%";
}

function KpiCard({ label, value, sub, icon, color }: { label: string; value: string; sub: string; icon: string; color: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl p-5 bg-panel-dark border border-border-dark">
      <div className="flex justify-between items-start">
        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">{label}</p>
        <span className={`material-symbols-outlined ${color}`}>{icon}</span>
      </div>
      <p className="text-slate-100 text-3xl font-black">{value}</p>
      <p className="text-slate-500 text-xs">{sub}</p>
    </div>
  );
}

// ── Live Simulation Panel ──────────────────────────────────────────────────────
function SimulationPanel() {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(0);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function runSim() {
    if (loading) return;
    setResult(null);
    setVisibleCount(0);
    setLoading(true);
    try {
      const data = await fetchSimulation(150);
      setResult(data);
    } finally {
      setLoading(false);
    }
  }

  // Animate points appearing one by one
  useEffect(() => {
    if (!result) return;
    setVisibleCount(0);
    let i = 0;
    animRef.current = setInterval(() => {
      i += 3;
      setVisibleCount(i);
      if (i >= result.points.length) {
        clearInterval(animRef.current!);
        setVisibleCount(result.points.length);
      }
    }, 30);
    return () => { if (animRef.current) clearInterval(animRef.current); };
  }, [result]);

  const visible = result ? result.points.slice(0, visibleCount) : [];
  const done = result && visibleCount >= result.points.length;

  const plotData: Data[] = useMemo(() => {
    if (!visible.length || !result) return [];
    return [
      {
        x: visible.map((p) => p.index),
        y: visible.map((p) => p.anomaly_score),
        type: "scatter",
        mode: "lines",
        name: "Anomaly score",
        line: { color: "#1152d4", width: 1.5 },
        fill: "tozeroy",
        fillcolor: "rgba(17,82,212,0.05)",
      },
      {
        x: visible.filter((p) => p.pred_anomaly === 1).map((p) => p.index),
        y: visible.filter((p) => p.pred_anomaly === 1).map((p) => p.anomaly_score),
        type: "scatter",
        mode: "markers",
        name: "Anomaly detected",
        marker: { color: "#ef4444", size: 5, symbol: "circle" },
      },
    ];
  }, [visible, result]);

  return (
    <div className="bg-panel-dark border border-border-dark rounded-xl overflow-hidden">
      <div className="p-5 border-b border-border-dark flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary">stream</span>
          <div>
            <h2 className="text-base font-bold">Live Stream Simulation</h2>
            <p className="text-xs text-slate-500">
              Randomly samples 150 consecutive rows from a historical fault event and runs them through the model — simulating an incoming SCADA data stream
            </p>
          </div>
        </div>
        <button
          onClick={runSim}
          disabled={loading}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shrink-0"
        >
          <span className="material-symbols-outlined text-base">{loading ? "hourglass_empty" : "play_arrow"}</span>
          {loading ? "Loading..." : result ? "Run Again" : "Run Simulation"}
        </button>
      </div>

      {!result && !loading && (
        <div className="p-10 text-center text-slate-600 text-sm">
          <span className="material-symbols-outlined text-4xl block mb-2">sensors</span>
          Click "Run Simulation" to sample a window of historical SCADA readings and watch the model score them in real time
        </div>
      )}

      {loading && <div className="p-10 flex justify-center"><LoadingSpinner /></div>}

      {result && (
        <div className="p-5">
          {/* Event context banner */}
          <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-background-dark rounded-lg border border-border-dark">
            <EventBadge label={result.event_label} />
            <span className="text-sm font-semibold text-slate-300">{result.event_description || `Event #${result.event_id}`}</span>
            <span className="text-slate-600">·</span>
            <span className="text-xs text-slate-500">Event #{result.event_id}</span>
            <span className="text-slate-600">·</span>
            <span className="text-xs text-slate-500">Window starting at {(result.sample_start_pct * 100).toFixed(0)}% of prediction period</span>
            <span className="text-slate-600">·</span>
            <span className="text-xs text-slate-500">{result.total_sampled} rows sampled</span>
          </div>

          {/* Chart */}
          <Plot
            data={plotData}
            layout={{
              paper_bgcolor: "#1a2233",
              plot_bgcolor: "#1a2233",
              font: { color: "#94a3b8", size: 11 },
              xaxis: {
                title: { text: "Row index (time steps)", font: { color: "#64748b", size: 10 } },
                gridcolor: "#2d3a54", tickfont: { color: "#64748b", size: 9 },
              },
              yaxis: {
                title: { text: "Anomaly score", font: { color: "#64748b", size: 10 } },
                gridcolor: "#2d3a54", tickfont: { color: "#64748b", size: 9 },
              },
              shapes: [{
                type: "line", x0: 0, x1: result.total_sampled,
                y0: result.threshold, y1: result.threshold,
                line: { color: "#ef4444", width: 1.5, dash: "dash" },
              }],
              annotations: [{
                x: result.total_sampled * 0.02, y: result.threshold,
                text: "Threshold", showarrow: false,
                font: { color: "#ef4444", size: 10 }, yshift: 8,
              }],
              showlegend: true,
              legend: { bgcolor: "#1a2233", bordercolor: "#2d3a54", font: { color: "#94a3b8", size: 10 }, x: 0.01, y: 0.99 },
              height: 280,
              margin: { l: 55, r: 20, t: 15, b: 45 },
            } as Partial<Layout>}
            config={{ responsive: true, displayModeBar: false }}
            style={{ width: "100%" }}
          />

          {/* Result summary */}
          {done && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-background-dark rounded-lg border border-border-dark text-center">
                <p className="text-xs text-slate-500 mb-1">Rows Scanned</p>
                <p className="text-xl font-bold text-slate-100">{result.total_sampled}</p>
              </div>
              <div className={`p-3 rounded-lg border text-center ${result.anomaly_count > 0 ? "bg-red-900/20 border-red-700/30" : "bg-emerald-900/20 border-emerald-700/30"}`}>
                <p className="text-xs text-slate-500 mb-1">Anomalies Flagged</p>
                <p className={`text-xl font-bold ${result.anomaly_count > 0 ? "text-red-400" : "text-emerald-400"}`}>{result.anomaly_count}</p>
              </div>
              <div className="p-3 bg-background-dark rounded-lg border border-border-dark text-center">
                <p className="text-xs text-slate-500 mb-1">Detection Rate</p>
                <p className="text-xl font-bold text-slate-100">
                  {result.total_sampled > 0 ? ((result.anomaly_count / result.total_sampled) * 100).toFixed(1) : "0"}%
                </p>
              </div>
              <div className={`p-3 rounded-lg border text-center ${result.first_detection_index != null ? "bg-amber-900/20 border-amber-700/30" : "bg-background-dark border-border-dark"}`}>
                <p className="text-xs text-slate-500 mb-1">First Alert At</p>
                <p className={`text-xl font-bold ${result.first_detection_index != null ? "text-amber-400" : "text-slate-500"}`}>
                  {result.first_detection_index != null ? `Row ${result.first_detection_index}` : "None"}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data: care, isLoading: careLoading } = useCareScores();
  const { data: events, isLoading: eventsLoading } = useEvents("all");

  const anomalyEvents = events?.filter((e) => e.event_label === "anomaly") ?? [];
  const normalEvents = events?.filter((e) => e.event_label === "normal") ?? [];
  const detectedEvents = anomalyEvents.filter((e) => e.has_detection);

  // Asset health: group events by asset_id
  const assetMap = useMemo(() => {
    const m = new Map<number, typeof anomalyEvents>();
    for (const ev of (events ?? [])) {
      if (!m.has(ev.asset_id)) m.set(ev.asset_id, []);
      m.get(ev.asset_id)!.push(ev);
    }
    return m;
  }, [events]);

  // Avg lead time across detected anomaly events (from earliness proxy: earliness=1 means early detection)
  const avgLeadTime = useMemo(() => {
    const detected = anomalyEvents.filter((e) => e.has_detection && e.earliness_weight != null);
    if (!detected.length) return null;
    // earliness_weight is a 0-1 score, not hours — use it as proxy label
    return detected.filter((e) => (e.earliness_weight ?? 0) >= 0.5).length;
  }, [anomalyEvents]);

  const radarData: Data[] = care ? [{
    type: "scatterpolar" as const,
    r: [care.coverage, care.accuracy, care.reliability, care.earliness, care.coverage],
    theta: ["Coverage", "Accuracy", "Reliability", "Earliness", "Coverage"],
    fill: "toself" as const,
    fillcolor: "rgba(17,82,212,0.25)",
    line: { color: "#1152d4", width: 2 },
    name: "CARE scores",
  }] : [];

  return (
    <div className="p-6 flex flex-col gap-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-semibold text-sm mb-1">
            <span className="material-symbols-outlined text-sm">wind_power</span>
            WIND FARM A — FLEET HEALTH
          </div>
          <h1 className="text-3xl font-black text-slate-100">Predictive Maintenance Overview</h1>
          <p className="text-slate-400 text-sm mt-1">Historical fault detection · Isolation Forest · CARE benchmark</p>
        </div>
        <Link
          href="/events"
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-bold text-sm transition-all shrink-0"
        >
          <span className="material-symbols-outlined text-sm">list_alt</span>
          All Events
        </Link>
      </div>

      {/* KPI Cards */}
      {careLoading || eventsLoading ? (
        <div className="flex justify-center py-6"><LoadingSpinner /></div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Assets Monitored"
            value={String(assetMap.size)}
            sub={`${events?.length ?? 0} total events in history`}
            icon="wind_power"
            color="text-primary"
          />
          <KpiCard
            label="Fault Events"
            value={String(anomalyEvents.length)}
            sub={`${normalEvents.length} normal baseline events`}
            icon="warning"
            color="text-red-400"
          />
          <KpiCard
            label="Detection Rate"
            value={anomalyEvents.length > 0 ? `${((detectedEvents.length / anomalyEvents.length) * 100).toFixed(0)}%` : "—"}
            sub={`${detectedEvents.length} of ${anomalyEvents.length} faults caught`}
            icon="radar"
            color="text-emerald-400"
          />
          <KpiCard
            label="Early Detections"
            value={avgLeadTime != null ? String(avgLeadTime) : "—"}
            sub="faults detected in first half of window"
            icon="alarm"
            color="text-amber-400"
          />
        </div>
      )}

      {/* Asset Health + Fault History */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Asset Health Grid */}
        <div className="lg:col-span-2 bg-panel-dark border border-border-dark rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border-dark flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-base">device_hub</span>
            <h2 className="font-bold text-sm">Asset Health</h2>
            <span className="ml-auto text-xs text-slate-500">{assetMap.size} assets</span>
          </div>
          <div className="divide-y divide-border-dark overflow-y-auto max-h-[340px]">
            {Array.from(assetMap.entries()).sort((a, b) => a[0] - b[0]).map(([assetId, assetEvents]) => {
              const faults = assetEvents.filter((e) => e.event_label === "anomaly");
              const detected = faults.filter((e) => e.has_detection);
              const hasFault = faults.length > 0;
              const allCaught = hasFault && detected.length === faults.length;
              const someMissed = hasFault && detected.length < faults.length;
              return (
                <div key={assetId} className="px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02]">
                  <div className={`size-2.5 rounded-full shrink-0 ${allCaught ? "bg-emerald-400" : someMissed ? "bg-amber-400" : "bg-slate-600"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-200">Asset #{assetId}</p>
                    <p className="text-xs text-slate-500">
                      {faults.length > 0 ? `${faults.length} fault${faults.length > 1 ? "s" : ""} · ${detected.length} detected` : "No fault events"}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {faults.map((e) => (
                      <Link key={e.event_id} href={`/events/${e.event_id}`} title={`Event #${e.event_id}`}>
                        <span className={`size-2 rounded-sm block ${e.has_detection ? "bg-emerald-400" : "bg-red-500"}`} />
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="p-3 border-t border-border-dark bg-background-dark/30 flex gap-4 text-[10px] text-slate-500">
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-400 inline-block" /> All detected</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-amber-400 inline-block" /> Partial</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-emerald-400 inline-block" /> Fault caught</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-red-500 inline-block" /> Missed</span>
          </div>
        </div>

        {/* Fault Event History */}
        <div className="lg:col-span-3 bg-panel-dark border border-border-dark rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border-dark flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-base">history</span>
            <h2 className="font-bold text-sm">Fault Event History</h2>
            <span className="ml-auto text-xs text-slate-500">{anomalyEvents.length} fault events</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background-dark/50">
                <tr className="text-[10px] text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-2.5 text-left">Event</th>
                  <th className="px-4 py-2.5 text-left">Fault Type</th>
                  <th className="px-4 py-2.5 text-left">Asset</th>
                  <th className="px-4 py-2.5 text-right">Coverage</th>
                  <th className="px-4 py-2.5 text-center">Detected</th>
                  <th className="px-4 py-2.5 text-center">Early</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-dark/50">
                {eventsLoading && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center"><LoadingSpinner className="mx-auto" /></td></tr>
                )}
                {anomalyEvents.map((ev) => (
                  <tr key={ev.event_id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-2.5">
                      <Link href={`/events/${ev.event_id}`} className="text-primary font-bold hover:underline">#{ev.event_id}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs max-w-[160px] truncate" title={ev.event_description}>
                      {ev.event_description || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs">#{ev.asset_id}</td>
                    <td className="px-4 py-2.5 text-right text-xs text-slate-400">{fmt(ev.coverage)}</td>
                    <td className="px-4 py-2.5 text-center">
                      {ev.has_detection
                        ? <span className="material-symbols-outlined text-emerald-400 text-base">check_circle</span>
                        : <span className="material-symbols-outlined text-red-500 text-base">cancel</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {ev.earliness_weight != null
                        ? <span className={`text-xs font-bold ${(ev.earliness_weight ?? 0) >= 0.5 ? "text-emerald-400" : "text-amber-400"}`}>
                            {(ev.earliness_weight * 100).toFixed(0)}%
                          </span>
                        : <span className="text-slate-600">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Live Simulation */}
      <SimulationPanel />

      {/* Model Performance — CARE section */}
      <div className="bg-panel-dark border border-border-dark rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border-dark flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-base">leaderboard</span>
          <h2 className="font-bold text-sm">Model Performance — CARE Benchmark</h2>
          <Link href="/benchmark" className="ml-auto text-xs text-primary hover:text-primary/80 font-bold flex items-center gap-1">
            Full report <span className="material-symbols-outlined text-sm">chevron_right</span>
          </Link>
        </div>
        {careLoading ? (
          <div className="p-8 flex justify-center"><LoadingSpinner /></div>
        ) : care ? (
          <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Radar + CARE score */}
            <div className="flex flex-col items-center">
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
                  height: 240,
                } as Partial<Layout>}
                config={{ responsive: true, displayModeBar: false }}
                style={{ width: "100%" }}
              />
              <div className="text-center mt-1">
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">CARE Score</p>
                <p className="text-slate-100 text-4xl font-black mt-1">{(care.care * 100).toFixed(1)}</p>
              </div>
            </div>
            {/* CARE metric cards */}
            <div className="grid grid-cols-2 gap-3 content-center">
              {[
                { label: "Coverage", value: fmt(care.coverage), sub: "F2 on anomaly events", icon: "search" },
                { label: "Accuracy", value: fmt(care.accuracy), sub: "TN rate, normal events", icon: "check_circle" },
                { label: "Reliability", value: fmt(care.reliability), sub: "ER-F2 alarm quality", icon: "verified" },
                { label: "Earliness", value: fmt(care.earliness), sub: "Detection timing", icon: "alarm" },
              ].map((m) => (
                <div key={m.label} className="p-4 bg-background-dark rounded-xl border border-border-dark">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-primary text-base">{m.icon}</span>
                    <p className="text-xs text-slate-500 font-bold uppercase">{m.label}</p>
                  </div>
                  <p className="text-2xl font-black text-slate-100">{m.value}</p>
                  <p className="text-xs text-slate-600 mt-1">{m.sub}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
