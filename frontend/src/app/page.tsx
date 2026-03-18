"use client";

import { useCareScores } from "@/hooks/useCareScores";
import { useEvents } from "@/hooks/useEvents";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EventBadge } from "@/components/events/EventBadge";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useState, useEffect, useRef, useMemo } from "react";
import type { Layout, Data } from "plotly.js";
import { fetchSimulation, SimulationResult, EventSummary } from "@/lib/api";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

function fmt(v: number | null | undefined) {
  if (v == null) return "—";
  return (v * 100).toFixed(1) + "%";
}

function KpiCard({
  label, value, sub, icon, color, trend,
}: {
  label: string; value: string; sub: string; icon: string; color: string; trend?: "up" | "down" | "neutral";
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl p-5 bg-panel-dark border border-border-dark">
      <div className="flex justify-between items-start">
        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">{label}</p>
        <span className={`material-symbols-outlined ${color}`}>{icon}</span>
      </div>
      <p className="text-slate-100 text-3xl font-black">{value}</p>
      <p className="text-slate-500 text-xs flex items-center gap-1">
        {trend === "up" && <span className="material-symbols-outlined text-emerald-400 text-sm">trending_up</span>}
        {trend === "down" && <span className="material-symbols-outlined text-red-400 text-sm">trending_down</span>}
        {sub}
      </p>
    </div>
  );
}

// ── Asset priority computation ─────────────────────────────────────────────────
interface AssetPriority {
  assetId: number;
  healthScore: number;
  urgency: "critical" | "warning" | "ok";
  faultEvents: number;
  detected: number;
  missed: number;
  avgCoverage: number | null;
  avgLeadTime: number | null;
  recommendation: string;
}

function computeAssetPriorities(events: EventSummary[]): AssetPriority[] {
  const assetMap: Record<number, EventSummary[]> = {};
  for (const ev of events) {
    if (!assetMap[ev.asset_id]) assetMap[ev.asset_id] = [];
    assetMap[ev.asset_id].push(ev);
  }

  const priorities: AssetPriority[] = [];
  for (const [assetIdStr, assetEvents] of Object.entries(assetMap)) {
    const assetId = Number(assetIdStr);
    const faults = assetEvents.filter((e: EventSummary) => e.event_label === "anomaly");
    if (faults.length === 0) {
      priorities.push({
        assetId, healthScore: 100, urgency: "ok",
        faultEvents: 0, detected: 0, missed: 0,
        avgCoverage: null, avgLeadTime: null,
        recommendation: "No fault history — routine monitoring",
      });
      continue;
    }
    const detected = faults.filter((e: EventSummary) => e.has_detection).length;
    const missed = faults.length - detected;
    const covVals = faults.map((e: EventSummary) => e.coverage).filter((v): v is number => v != null);
    const avgCoverage = covVals.length > 0 ? covVals.reduce((a: number, b: number) => a + b, 0) / covVals.length : null;
    const ltVals = faults.map((e: EventSummary) => e.lead_time_hours).filter((v): v is number => v != null);
    const avgLeadTime = ltVals.length > 0 ? ltVals.reduce((a: number, b: number) => a + b, 0) / ltVals.length : null;

    // Health score: start at 100, deduct for missed faults and low coverage
    let healthScore = 100;
    healthScore -= (missed / faults.length) * 50;
    if (avgCoverage != null) healthScore -= (1 - avgCoverage) * 30;
    healthScore = Math.max(0, Math.round(healthScore));

    let urgency: AssetPriority["urgency"];
    let recommendation: string;
    if (missed > 0) {
      urgency = "critical";
      recommendation = `${missed} fault(s) not detected — immediate inspection recommended`;
    } else if (avgCoverage != null && avgCoverage < 0.3) {
      urgency = "warning";
      recommendation = "Low detection coverage — schedule maintenance soon";
    } else {
      urgency = "ok";
      recommendation = "All faults detected — schedule routine maintenance";
    }

    priorities.push({ assetId, healthScore, urgency, faultEvents: faults.length, detected, missed, avgCoverage, avgLeadTime, recommendation });
  }

  priorities.sort((a, b) => {
    const urgencyOrder = { critical: 0, warning: 1, ok: 2 };
    if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    return b.missed - a.missed;
  });

  return priorities;
}

// ── Simulation Panel ───────────────────────────────────────────────────────────
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
        type: "scatter", mode: "lines", name: "Anomaly score",
        line: { color: "#1152d4", width: 1.5 },
        fill: "tozeroy", fillcolor: "rgba(17,82,212,0.05)",
      },
      {
        x: visible.filter((p) => p.pred_anomaly === 1).map((p) => p.index),
        y: visible.filter((p) => p.pred_anomaly === 1).map((p) => p.anomaly_score),
        type: "scatter", mode: "markers", name: "Anomaly detected",
        marker: { color: "#ef4444", size: 5 },
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
          <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-background-dark rounded-lg border border-border-dark">
            <EventBadge label={result.event_label} />
            <span className="text-sm font-semibold text-slate-300">{result.event_description || `Event #${result.event_id}`}</span>
            <span className="text-slate-600">·</span>
            <span className="text-xs text-slate-500">Window at {(result.sample_start_pct * 100).toFixed(0)}% of prediction period</span>
            <span className="text-slate-600">·</span>
            <span className="text-xs text-slate-500">{result.total_sampled} rows sampled</span>
          </div>
          <Plot
            data={plotData}
            layout={{
              paper_bgcolor: "#1a2233", plot_bgcolor: "#1a2233",
              font: { color: "#94a3b8", size: 11 },
              xaxis: { title: { text: "Row index (time steps)", font: { color: "#64748b", size: 10 } }, gridcolor: "#2d3a54", tickfont: { color: "#64748b", size: 9 } },
              yaxis: { title: { text: "Anomaly score", font: { color: "#64748b", size: 10 } }, gridcolor: "#2d3a54", tickfont: { color: "#64748b", size: 9 } },
              shapes: [{ type: "line", x0: 0, x1: result.total_sampled, y0: result.threshold, y1: result.threshold, line: { color: "#ef4444", width: 1.5, dash: "dash" } }],
              annotations: [{ x: result.total_sampled * 0.02, y: result.threshold, text: "Threshold", showarrow: false, font: { color: "#ef4444", size: 10 }, yshift: 8 }],
              showlegend: true, legend: { bgcolor: "#1a2233", bordercolor: "#2d3a54", font: { color: "#94a3b8", size: 10 }, x: 0.01, y: 0.99 },
              height: 260, margin: { l: 55, r: 20, t: 15, b: 45 },
            } as Partial<Layout>}
            config={{ responsive: true, displayModeBar: false }}
            style={{ width: "100%" }}
          />
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
                <p className="text-xl font-bold text-slate-100">{result.total_sampled > 0 ? ((result.anomaly_count / result.total_sampled) * 100).toFixed(1) : "0"}%</p>
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
  const { data: care, isLoading: careLoading, isError: careError } = useCareScores();
  const { data: events, isLoading: eventsLoading, isError: eventsError } = useEvents("all");

  const anomalyEvents = events?.filter((e) => e.event_label === "anomaly") ?? [];
  const normalEvents = events?.filter((e) => e.event_label === "normal") ?? [];
  const detectedEvents = anomalyEvents.filter((e) => e.has_detection);

  const avgLeadTime = useMemo(() => {
    const vals = anomalyEvents.map((e) => e.lead_time_hours).filter((v): v is number => v != null);
    if (!vals.length) return null;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }, [anomalyEvents]);

  const priorities = useMemo(() => computeAssetPriorities(events ?? []), [events]);
  const criticalCount = priorities.filter((p) => p.urgency === "critical").length;
  const warningCount = priorities.filter((p) => p.urgency === "warning").length;

  const radarData: Data[] = care ? [{
    type: "scatterpolar" as const,
    r: [care.coverage, care.accuracy, care.reliability, care.earliness, care.coverage],
    theta: ["Coverage", "Accuracy", "Reliability", "Earliness", "Coverage"],
    fill: "toself" as const,
    fillcolor: "rgba(17,82,212,0.25)",
    line: { color: "#1152d4", width: 2 },
    name: "CARE scores",
  }] : [];

  const loading = careLoading || eventsLoading;
  const hasError = careError || eventsError;

  return (
    <div className="p-6 flex flex-col gap-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-semibold text-sm mb-1">
            <span className="material-symbols-outlined text-sm">wind_power</span>
            WIND FARM A — FLEET HEALTH
          </div>
          <h1 className="text-3xl font-black text-slate-100">Operations Overview</h1>
          <p className="text-slate-400 text-sm mt-1">Isolation Forest · CARE benchmark · {events?.length ?? "—"} events · {priorities.length} assets</p>
        </div>
        <Link href="/events" className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-bold text-sm transition-all shrink-0">
          <span className="material-symbols-outlined text-sm">list_alt</span>
          All Events
        </Link>
      </div>

      {/* KPI Cards */}
      {hasError ? (
        <div className="flex items-center gap-3 p-4 bg-red-900/20 border border-red-700/30 rounded-xl text-red-400 text-sm">
          <span className="material-symbols-outlined">error</span>
          Backend not reachable — make sure <code className="font-mono text-xs bg-red-900/30 px-1 py-0.5 rounded">uvicorn backend.main:app --reload</code> is running, then hard-refresh (Ctrl+Shift+R).
        </div>
      ) : loading ? (
        <div className="flex justify-center py-6"><LoadingSpinner /></div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Fleet Assets"
            value={String(priorities.length)}
            sub={`${criticalCount} critical · ${warningCount} warning`}
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
            trend={detectedEvents.length / Math.max(anomalyEvents.length, 1) > 0.5 ? "up" : "down"}
          />
          <KpiCard
            label="Avg Lead Time"
            value={avgLeadTime != null ? `${avgLeadTime}h` : "—"}
            sub="avg hours of advance warning"
            icon="alarm"
            color="text-amber-400"
          />
        </div>
      )}

      {/* Maintenance Priority + Asset Health */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Maintenance Priority Table (wider) */}
        <div className="lg:col-span-3 bg-panel-dark border border-border-dark rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border-dark flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-400 text-base">priority_high</span>
            <h2 className="font-bold text-sm">Maintenance Priority</h2>
            <span className="ml-auto text-xs text-slate-500">ranked by urgency</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background-dark/50">
                <tr className="text-[10px] text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-2.5 text-left">Asset</th>
                  <th className="px-4 py-2.5 text-center">Health</th>
                  <th className="px-4 py-2.5 text-center">Faults</th>
                  <th className="px-4 py-2.5 text-center">Missed</th>
                  <th className="px-4 py-2.5 text-left">Recommendation</th>
                  <th className="px-4 py-2.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-dark/50">
                {loading && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center"><LoadingSpinner className="mx-auto" /></td></tr>
                )}
                {priorities.map((p, i) => {
                  const urgencyColors = {
                    critical: { dot: "bg-red-500", badge: "bg-red-900/30 text-red-400 border-red-700/30", text: "text-red-400" },
                    warning: { dot: "bg-amber-400", badge: "bg-amber-900/30 text-amber-400 border-amber-700/30", text: "text-amber-400" },
                    ok: { dot: "bg-emerald-400", badge: "bg-emerald-900/20 text-emerald-400 border-emerald-700/20", text: "text-emerald-400" },
                  };
                  const uc = urgencyColors[p.urgency];
                  return (
                    <tr key={p.assetId} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-600 font-mono">#{i + 1}</span>
                          <div className={`size-2 rounded-full shrink-0 ${uc.dot}`} />
                          <span className="font-semibold text-slate-200">Asset #{p.assetId}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-lg font-black ${p.healthScore >= 80 ? "text-emerald-400" : p.healthScore >= 50 ? "text-amber-400" : "text-red-400"}`}>
                          {p.healthScore}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-slate-300 font-semibold">{p.faultEvents}</span>
                        {p.faultEvents > 0 && (
                          <span className="text-slate-600 text-xs ml-1">({p.detected} det.)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {p.missed > 0
                          ? <span className={`font-bold text-sm px-2 py-0.5 rounded border ${uc.badge}`}>{p.missed}</span>
                          : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 max-w-[200px]">{p.recommendation}</td>
                      <td className="px-4 py-3 text-center">
                        {p.faultEvents > 0 && (
                          <Link
                            href={`/events?asset=${p.assetId}`}
                            className="text-xs text-primary hover:text-primary/80 font-bold"
                          >
                            View
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Asset Health Grid (narrower) */}
        <div className="lg:col-span-2 bg-panel-dark border border-border-dark rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border-dark flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-base">device_hub</span>
            <h2 className="font-bold text-sm">Asset Health</h2>
            <span className="ml-auto text-xs text-slate-500">{priorities.length} turbines</span>
          </div>
          <div className="divide-y divide-border-dark overflow-y-auto max-h-[380px]">
            {priorities.map((p) => {
              const barColor = p.healthScore >= 80 ? "bg-emerald-500" : p.healthScore >= 50 ? "bg-amber-400" : "bg-red-500";
              const dotColor = p.urgency === "critical" ? "bg-red-500" : p.urgency === "warning" ? "bg-amber-400" : "bg-emerald-400";
              return (
                <div key={p.assetId} className="px-4 py-3 hover:bg-white/[0.02]">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`size-2.5 rounded-full shrink-0 ${dotColor}`} />
                    <span className="text-sm font-semibold text-slate-200 flex-1">Asset #{p.assetId}</span>
                    <span className={`text-sm font-black ${p.healthScore >= 80 ? "text-emerald-400" : p.healthScore >= 50 ? "text-amber-400" : "text-red-400"}`}>
                      {p.healthScore}/100
                    </span>
                  </div>
                  {/* Health bar */}
                  <div className="h-1.5 bg-background-dark rounded-full overflow-hidden mb-1.5">
                    <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${p.healthScore}%` }} />
                  </div>
                  <p className="text-[10px] text-slate-600">
                    {p.faultEvents === 0
                      ? "No fault events"
                      : `${p.faultEvents} fault${p.faultEvents > 1 ? "s" : ""} · ${p.detected} detected${p.avgLeadTime != null ? ` · ${p.avgLeadTime.toFixed(0)}h avg lead` : ""}`}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="p-3 border-t border-border-dark bg-background-dark/30 flex gap-4 text-[10px] text-slate-500">
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-red-500 inline-block" /> Critical</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-amber-400 inline-block" /> Warning</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-400 inline-block" /> OK</span>
          </div>
        </div>
      </div>

      {/* Fault Event History */}
      <div className="bg-panel-dark border border-border-dark rounded-xl overflow-hidden">
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
                <th className="px-4 py-2.5 text-left">Description</th>
                <th className="px-4 py-2.5 text-left">Asset</th>
                <th className="px-4 py-2.5 text-right">Coverage</th>
                <th className="px-4 py-2.5 text-right">Lead Time</th>
                <th className="px-4 py-2.5 text-center">Detected</th>
                <th className="px-4 py-2.5 text-center">Early</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-dark/50">
              {loading && (
                <tr><td colSpan={7} className="px-4 py-6 text-center"><LoadingSpinner className="mx-auto" /></td></tr>
              )}
              {anomalyEvents.map((ev) => (
                <tr key={ev.event_id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-2.5">
                    <Link href={`/events/${ev.event_id}`} className="text-primary font-bold hover:underline">#{ev.event_id}</Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-400 text-xs max-w-[200px] truncate" title={ev.event_description}>
                    {ev.event_description || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">#{ev.asset_id}</td>
                  <td className="px-4 py-2.5 text-right text-xs text-slate-400">{fmt(ev.coverage)}</td>
                  <td className="px-4 py-2.5 text-right text-xs text-slate-400">
                    {ev.lead_time_hours != null ? `${ev.lead_time_hours.toFixed(0)}h` : "—"}
                  </td>
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

      {/* Live Simulation */}
      <SimulationPanel />

      {/* CARE Benchmark */}
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
