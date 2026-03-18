"use client";

import { useParams } from "next/navigation";
import { useEventDetail, useSensorData, useEventFeatures, useEventAttribution, useSubsystemSignals } from "@/hooks/useEvents";
import { useAeolusStore } from "@/store/useAeolusStore";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo, useEffect } from "react";
import type { Layout, Shape, Data } from "plotly.js";
import type { EventSummary, EventAttribution, SubsystemSignalsResponse } from "@/lib/api";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

function formatDate(s: string) {
  try { return new Date(s).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }); }
  catch { return s; }
}

function fmt(v: number | null | undefined) {
  if (v == null) return "—";
  return (v * 100).toFixed(1) + "%";
}

// ── Plain English summary ──────────────────────────────────────────────────────
function FaultSummary({ event, attribution, anomalyCount }: {
  event: EventSummary;
  attribution: EventAttribution | undefined;
  anomalyCount: number;
}) {
  const isAnomaly = event.event_label === "anomaly";

  // Normal event
  if (!isAnomaly) {
    const tnRate = event.accuracy != null ? (event.accuracy * 100).toFixed(1) : null;
    return (
      <div className="bg-emerald-900/10 border border-emerald-700/30 rounded-xl p-4 flex gap-3">
        <span className="material-symbols-outlined text-emerald-400 shrink-0">check_circle</span>
        <p className="text-sm text-slate-300 leading-relaxed">
          This is a <span className="text-emerald-400 font-semibold">normal operation</span> baseline event used to measure false alarm rate.
          {tnRate != null
            ? <> The model correctly classified <span className="text-slate-100 font-semibold">{tnRate}%</span> of rows as normal — no false alarms triggered.</>
            : <> No anomalies were expected and the model was evaluated for false alarms.</>}
        </p>
      </div>
    );
  }

  // Missed fault
  if (!event.has_detection) {
    const reason = event.coverage === null
      ? "All rows in the prediction window had maintenance or curtailment status and were excluded from scoring — the model had no data to evaluate."
      : "The sensor readings during this fault window were statistically indistinguishable from normal operation. The model scored the rows but did not flag any as anomalous.";
    return (
      <div className="bg-red-900/10 border border-red-700/30 rounded-xl p-4 flex gap-3">
        <span className="material-symbols-outlined text-red-400 shrink-0">cancel</span>
        <div>
          <p className="text-sm font-semibold text-red-400 mb-1">Fault not detected</p>
          <p className="text-sm text-slate-400 leading-relaxed">{reason}</p>
        </div>
      </div>
    );
  }

  // Detected fault — build narrative
  const top = attribution?.top_features?.[0];
  const second = attribution?.top_features?.[1];
  const lead = attribution?.lead_time_hours;
  const trend = attribution?.score_trend;

  const leadText = lead != null
    ? <> The first alert fired <span className="text-amber-400 font-semibold">{lead.toFixed(0)} hours</span> before the end of the fault window</>
    : <> Anomalies were detected across <span className="text-amber-400 font-semibold">{anomalyCount} rows</span> in the prediction window</>;

  const sensorText = top
    ? <> Primary driver: <span className="text-red-300 font-semibold">{top.description}</span> was <span className="text-red-300 font-semibold">{top.z_score.toFixed(1)}σ</span> above its normal mean ({top.anomaly_mean_value.toFixed(1)} vs {top.mean.toFixed(1)} typical){second ? <>, followed by <span className="text-amber-300 font-semibold">{second.description}</span> ({second.z_score.toFixed(1)}σ)</> : null}.</>
    : null;

  const trendText = trend === "escalating"
    ? " The anomaly score was escalating — conditions were worsening over time."
    : trend === "improving"
    ? " The anomaly score was improving toward the end of the window."
    : " The anomaly score was stable throughout the detection period.";

  return (
    <div className="bg-amber-900/10 border border-amber-700/30 rounded-xl p-4 flex gap-3">
      <span className="material-symbols-outlined text-amber-400 shrink-0">crisis_alert</span>
      <p className="text-sm text-slate-300 leading-relaxed">
        {leadText}. {sensorText}{trendText}
        {event.coverage != null && <> Coverage (F2): <span className="text-slate-100 font-semibold">{fmt(event.coverage)}</span> of fault rows were caught.</>}
      </p>
    </div>
  );
}

// ── Subsystem Anomaly Signals ──────────────────────────────────────────────────
function SubsystemSignals({ data }: { data: SubsystemSignalsResponse }) {
  if (!data.has_anomaly_rows) {
    return (
      <div className="bg-panel-dark border border-border-dark rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border-dark flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-base">radar</span>
          <div>
            <h4 className="text-sm font-bold">Subsystem Anomaly Signals</h4>
            <p className="text-xs text-slate-500">Z-score based deviation signal per component group — higher = more anomalous during fault rows</p>
          </div>
        </div>
        <div className="p-5">
          <p className="text-sm text-slate-500 italic">No anomaly rows detected — subsystem signals require at least one flagged row</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-panel-dark border border-border-dark rounded-xl overflow-hidden">
      <div className="p-4 border-b border-border-dark flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-base">radar</span>
        <div>
          <h4 className="text-sm font-bold">Subsystem Anomaly Signals</h4>
          <p className="text-xs text-slate-500">Z-score based deviation signal per component group — higher = more anomalous during fault rows</p>
        </div>
      </div>
      <div className="p-5 flex flex-col gap-4">
        {data.subsystems.map((sub) => {
          const zBadgeClass =
            sub.mean_z_score >= 3
              ? "bg-red-900/40 text-red-400"
              : sub.mean_z_score >= 1.5
              ? "bg-amber-900/40 text-amber-400"
              : "bg-slate-800/50 text-slate-500";

          return (
            <div key={sub.key}>
              <div className="flex items-center gap-3 mb-1.5">
                {/* Icon + label */}
                <span className="material-symbols-outlined text-base shrink-0" style={{ color: sub.color }}>
                  {sub.icon}
                </span>
                <span className="text-sm font-semibold text-slate-200 w-36 shrink-0">{sub.label}</span>

                {/* Progress bar */}
                <div className="flex-1 bg-slate-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${(sub.signal * 100).toFixed(1)}%`, backgroundColor: sub.color }}
                  />
                </div>

                {/* Signal % */}
                <span className="text-xs font-bold text-slate-300 w-10 text-right shrink-0">
                  {sub.signal === 0 && !data.has_anomaly_rows
                    ? <span className="text-slate-600">No anomaly rows</span>
                    : `${(sub.signal * 100).toFixed(0)}%`}
                </span>

                {/* Z-score badge */}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${zBadgeClass}`}>
                  {sub.mean_z_score.toFixed(1)}σ
                </span>
              </div>

              {/* Description + top sensor */}
              <div className="ml-[calc(1rem+0.75rem+9rem)] text-[11px] text-slate-600 leading-relaxed">
                {sub.description}
                {sub.top_sensor_description && (
                  <span className="text-slate-500"> · top: <span className="text-slate-400">{sub.top_sensor_description}</span>
                    {sub.top_z_score != null && <span className={sub.top_z_score >= 3 ? " text-red-400" : sub.top_z_score >= 1.5 ? " text-amber-400" : ""}> ({sub.top_z_score.toFixed(1)}σ)</span>}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const selectedFeature = useAeolusStore((s) => s.selectedFeature);
  const setSelectedFeature = useAeolusStore((s) => s.setSelectedFeature);

  const { data: event, isLoading: eventLoading } = useEventDetail(eventId);
  const { data: timeseries, isLoading: tsLoading } = useSensorData(eventId, selectedFeature, 500);
  const { data: features } = useEventFeatures(eventId);
  const { data: attribution } = useEventAttribution(eventId);
  const { data: subsystemData } = useSubsystemSignals(eventId);

  // Auto-select top attributed sensor when attribution loads
  useEffect(() => {
    if (attribution?.top_features?.length && selectedFeature === "power_30_avg") {
      const topFeature = attribution.top_features[0].feature;
      if (topFeature) setSelectedFeature(topFeature);
    }
  }, [attribution]);

  // Build chart data
  const chartData = useMemo(() => {
    if (!timeseries?.points) return null;
    const pts = timeseries.points;
    const timestamps = pts.map((p) => p.time_stamp);
    const featureVals = pts.map((p) => p.feature_value);
    const anomalyScores = pts.map((p) => p.anomaly_score);
    const anomalyMask = pts.map((p) => p.pred_anomaly === 1);

    const shapes: Partial<Shape>[] = [];
    let start: string | null = null;
    for (let i = 0; i < anomalyMask.length; i++) {
      if (anomalyMask[i] && start === null) start = timestamps[i];
      else if (!anomalyMask[i] && start !== null) {
        shapes.push({ type: "rect", xref: "x", yref: "paper", x0: start, x1: timestamps[i], y0: 0, y1: 1, fillcolor: "rgba(239,68,68,0.1)", line: { width: 0 } });
        start = null;
      }
    }
    if (start && timestamps.length > 0)
      shapes.push({ type: "rect", xref: "x", yref: "paper", x0: start, x1: timestamps[timestamps.length - 1], y0: 0, y1: 1, fillcolor: "rgba(239,68,68,0.1)", line: { width: 0 } });

    const firstDetectIdx = anomalyMask.indexOf(true);
    if (firstDetectIdx >= 0)
      shapes.push({ type: "line", xref: "x", yref: "paper", x0: timestamps[firstDetectIdx], x1: timestamps[firstDetectIdx], y0: 0, y1: 1, line: { color: "#ef4444", width: 1.5, dash: "dot" } });

    const traces: Data[] = [
      { x: timestamps, y: featureVals, type: "scatter", mode: "lines", name: selectedFeature, line: { color: "#1152d4", width: 1.5 }, yaxis: "y" },
      { x: timestamps, y: anomalyScores, type: "scatter", mode: "lines", name: "Anomaly score (right axis)", line: { color: "#ef4444", width: 1, dash: "dot" }, fill: "tozeroy" as const, fillcolor: "rgba(239,68,68,0.05)", yaxis: "y2" },
    ];

    return { traces, shapes, firstDetectTs: firstDetectIdx >= 0 ? timestamps[firstDetectIdx] : null, anomalyCount: anomalyMask.filter(Boolean).length };
  }, [timeseries, selectedFeature]);

  // Build smart sensor list: attributed sensors pinned first
  const sensorList = useMemo((): { attributed: typeof features; rest: typeof features } => {
    if (!features) return { attributed: [], rest: [] };
    const attributedFeatures = new Set(attribution?.top_features?.map((f) => f.feature) ?? []);
    return {
      attributed: features.filter((f) => attributedFeatures.has(f.column_name)),
      rest: features.filter((f) => !attributedFeatures.has(f.column_name)),
    };
  }, [features, attribution]);

  if (eventLoading) return <div className="flex justify-center py-20"><LoadingSpinner /></div>;
  if (!event) return <div className="p-6 text-red-400">Event not found.</div>;

  const isAnomaly = event.event_label === "anomaly";

  return (
    <div className="flex flex-col p-5 gap-5 max-w-screen-xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/events" className="hover:text-primary transition-colors">Events</Link>
        <span className="material-symbols-outlined text-xs">chevron_right</span>
        <span className="text-slate-200 font-medium">Event #{eventId}</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-xl shrink-0 ${isAnomaly ? "bg-red-900/30 text-red-400" : "bg-emerald-900/30 text-emerald-400"}`}>
          <span className="material-symbols-outlined text-3xl">{isAnomaly ? "warning" : "check_circle"}</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-100">
            {event.event_description || `Event #${event.event_id}`}
            <span className="text-slate-500 font-normal ml-2 text-lg">#{event.event_id}</span>
          </h1>
          <p className="text-slate-500 text-sm mt-1 flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">location_on</span> Asset #{event.asset_id}</span>
            <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">schedule</span> {formatDate(event.event_start)}</span>
            <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">data_table</span> {event.prediction_rows.toLocaleString()} prediction rows</span>
          </p>
        </div>
      </div>

      {/* Plain English summary */}
      <FaultSummary
        event={event}
        attribution={attribution}
        anomalyCount={chartData?.anomalyCount ?? 0}
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-panel-dark border border-border-dark p-4 rounded-xl">
          <p className="text-slate-500 text-xs font-medium mb-1">Total Rows</p>
          <p className="text-2xl font-bold">{event.row_count.toLocaleString()}</p>
          <p className="text-xs text-slate-600 mt-1">full event window</p>
        </div>
        <div className="bg-panel-dark border border-border-dark p-4 rounded-xl">
          <p className="text-slate-500 text-xs font-medium mb-1">Prediction Rows</p>
          <p className="text-2xl font-bold text-primary">{event.prediction_rows.toLocaleString()}</p>
          <p className="text-xs text-slate-600 mt-1">scored by model</p>
        </div>
        <div className="bg-panel-dark border border-border-dark p-4 rounded-xl">
          <p className="text-slate-500 text-xs font-medium mb-1">Coverage (F2)</p>
          <p className={`text-2xl font-bold ${event.coverage != null && event.coverage > 0 ? "text-amber-400" : "text-slate-500"}`}>
            {fmt(event.coverage)}
          </p>
          <p className="text-xs text-slate-600 mt-1">{isAnomaly ? "of fault rows flagged" : "n/a for normal events"}</p>
        </div>
        <div className={`bg-panel-dark border p-4 rounded-xl ${event.has_detection ? "border-l-4 border-l-emerald-500 border-border-dark" : isAnomaly ? "border-l-4 border-l-red-500 border-border-dark" : "border-border-dark"}`}>
          <p className="text-slate-500 text-xs font-medium mb-1">Detection</p>
          <p className={`text-2xl font-bold ${event.has_detection ? "text-emerald-400" : isAnomaly ? "text-red-400" : "text-slate-500"}`}>
            {event.has_detection ? "CAUGHT" : isAnomaly ? "MISSED" : "N/A"}
          </p>
          <p className="text-xs text-slate-600 mt-1">
            {event.earliness_weight != null ? `${fmt(event.earliness_weight)} earliness` : ""}
          </p>
        </div>
      </div>

      {/* Timeseries chart + sensor picker */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Chart */}
        <div className="lg:col-span-8 bg-panel-dark border border-border-dark rounded-xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
            <div>
              <h4 className="text-base font-bold">Sensor Timeseries</h4>
              <p className="text-xs text-slate-500 mt-0.5 max-w-sm">
                Blue line = sensor value · Red dashed = anomaly score (right axis) · Red shading = flagged windows · Dashed vertical = first alert
              </p>
            </div>
            <select
              value={selectedFeature}
              onChange={(e) => setSelectedFeature(e.target.value)}
              className="bg-background-dark border border-border-dark text-slate-200 text-sm rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-primary shrink-0"
            >
              {features?.map((f) => (
                <option key={f.column_name} value={f.column_name}>{f.description || f.column_name}</option>
              )) ?? <option value="power_30_avg">power_30_avg</option>}
            </select>
          </div>

          {tsLoading && <div className="flex items-center justify-center min-h-[300px]"><LoadingSpinner /></div>}
          {chartData && !tsLoading && (
            <Plot
              data={chartData.traces}
              layout={{
                paper_bgcolor: "#1a2233", plot_bgcolor: "#1a2233",
                font: { color: "#94a3b8", size: 11 },
                xaxis: { gridcolor: "#2d3a54", linecolor: "#2d3a54", tickfont: { color: "#64748b", size: 9 } },
                yaxis: { gridcolor: "#2d3a54", linecolor: "#2d3a54", tickfont: { color: "#64748b", size: 9 }, title: { text: features?.find(f => f.column_name === selectedFeature)?.description || selectedFeature, font: { color: "#94a3b8", size: 10 } } },
                yaxis2: { gridcolor: "transparent", overlaying: "y", side: "right", tickfont: { color: "#64748b", size: 9 }, title: { text: "Anomaly score", font: { color: "#94a3b8", size: 10 } } },
                shapes: chartData.shapes,
                height: 340, autosize: true,
                margin: { l: 55, r: 55, t: 15, b: 35 },
                legend: { bgcolor: "#1a2233", bordercolor: "#2d3a54", font: { color: "#94a3b8", size: 10 } },
              } as Partial<Layout>}
              config={{ responsive: true, displayModeBar: false }}
              style={{ width: "100%" }}
            />
          )}
          {chartData?.anomalyCount != null && chartData.anomalyCount > 0 && (
            <div className="mt-3 pt-3 border-t border-border-dark flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-xs text-slate-400">
                <span className="font-bold text-red-400">{chartData.anomalyCount} rows</span> flagged as anomalous
                ({((chartData.anomalyCount / event.prediction_rows) * 100).toFixed(1)}% of prediction window)
                {chartData.firstDetectTs && <> · first alert at <span className="font-mono text-slate-300">{chartData.firstDetectTs}</span></>}
              </span>
            </div>
          )}
        </div>

        {/* Smart sensor picker */}
        <div className="lg:col-span-4 bg-panel-dark border border-border-dark rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border-dark">
            <h4 className="text-sm font-bold">Select Sensor</h4>
            <p className="text-xs text-slate-500 mt-0.5">Top sensors from fault attribution are pinned first</p>
          </div>
          <div className="overflow-y-auto max-h-[380px]">
            {/* Attributed sensors pinned at top */}
            {(sensorList.attributed?.length ?? 0) > 0 && (
              <>
                <div className="px-3 py-1.5 bg-red-900/10 border-b border-border-dark">
                  <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Most anomalous during fault</span>
                </div>
                {(sensorList.attributed ?? []).map((f) => {
                  const attrInfo = attribution?.top_features?.find((a) => a.feature === f.column_name);
                  return (
                    <div
                      key={f.column_name}
                      onClick={() => setSelectedFeature(f.column_name)}
                      className={`px-4 py-2.5 cursor-pointer border-b border-border-dark/50 hover:bg-white/[0.03] transition-colors ${selectedFeature === f.column_name ? "bg-primary/10" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className={`text-xs font-semibold truncate ${selectedFeature === f.column_name ? "text-primary" : "text-slate-200"}`}>
                            {f.description || f.column_name}
                          </p>
                          <p className="text-[10px] text-slate-600 font-mono">{f.column_name}</p>
                        </div>
                        {attrInfo && (
                          <span className={`text-[10px] font-bold shrink-0 px-1.5 py-0.5 rounded ${attrInfo.z_score >= 3 ? "bg-red-900/40 text-red-400" : "bg-amber-900/40 text-amber-400"}`}>
                            {attrInfo.z_score.toFixed(1)}σ
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div className="px-3 py-1.5 bg-background-dark/30 border-b border-border-dark">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">All sensors</span>
                </div>
              </>
            )}
            {(sensorList.rest ?? []).map((f) => (
              <div
                key={f.column_name}
                onClick={() => setSelectedFeature(f.column_name)}
                className={`px-4 py-2.5 cursor-pointer border-b border-border-dark/50 hover:bg-white/[0.03] transition-colors ${selectedFeature === f.column_name ? "bg-primary/10" : ""}`}
              >
                <p className={`text-xs font-semibold truncate ${selectedFeature === f.column_name ? "text-primary" : "text-slate-300"}`}>
                  {f.description || f.column_name}
                </p>
                <p className="text-[10px] text-slate-600 font-mono">{f.column_name}</p>
              </div>
            ))}
          </div>
          <div className="p-2 border-t border-border-dark bg-background-dark/30 text-center">
            <p className="text-[10px] text-slate-600">{features?.length ?? 0} sensors available</p>
          </div>
        </div>
      </div>

      {/* Fault Attribution */}
      {attribution && attribution.anomaly_point_count > 0 && (
        <div className="bg-panel-dark border border-border-dark rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border-dark flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">crisis_alert</span>
              <div>
                <h4 className="text-sm font-bold">Fault Attribution</h4>
                <p className="text-xs text-slate-500">Which sensors deviated most from normal during anomaly rows</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {attribution.lead_time_hours != null && (
                <div className="flex items-center gap-1.5 bg-amber-900/20 border border-amber-700/30 text-amber-400 px-3 py-1.5 rounded-lg">
                  <span className="material-symbols-outlined text-base">alarm</span>
                  <span className="text-xs font-bold">{attribution.lead_time_hours.toFixed(0)}h lead time</span>
                </div>
              )}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold ${
                attribution.score_trend === "escalating" ? "bg-red-900/20 border-red-700/30 text-red-400"
                : attribution.score_trend === "improving" ? "bg-emerald-900/20 border-emerald-700/30 text-emerald-400"
                : "bg-slate-800/50 border-border-dark text-slate-400"
              }`}>
                <span className="material-symbols-outlined text-base">
                  {attribution.score_trend === "escalating" ? "trending_up" : attribution.score_trend === "improving" ? "trending_down" : "trending_flat"}
                </span>
                {attribution.score_trend.toUpperCase()}
              </div>
              <span className="text-xs text-slate-500">{attribution.anomaly_point_count}/{attribution.total_prediction_rows} rows flagged</span>
            </div>
          </div>
          <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Plot
              data={[{
                type: "bar", orientation: "h",
                x: [...attribution.top_features].reverse().map((f) => f.z_score),
                y: [...attribution.top_features].reverse().map((f) => f.description.length > 35 ? f.description.slice(0, 35) + "…" : f.description),
                marker: { color: [...attribution.top_features].reverse().map((f) => f.z_score >= 3 ? "#ef4444" : f.z_score >= 2 ? "#f59e0b" : "#3b82f6") },
                text: [...attribution.top_features].reverse().map((f) => `${f.z_score.toFixed(2)}σ`),
                textposition: "outside" as const,
                textfont: { color: "#94a3b8", size: 10 },
              }]}
              layout={{
                paper_bgcolor: "#1a2233", plot_bgcolor: "#1a2233",
                xaxis: { title: { text: "Z-score (σ from training mean)", font: { color: "#64748b", size: 10 } }, gridcolor: "#2d3a54", tickfont: { color: "#64748b", size: 9 }, zeroline: false },
                yaxis: { tickfont: { color: "#94a3b8", size: 10 }, automargin: true },
                margin: { l: 8, r: 60, t: 10, b: 40 },
                height: 300,
                shapes: [{ type: "line", x0: 2, x1: 2, y0: -0.5, y1: attribution.top_features.length - 0.5, yref: "y", xref: "x", line: { color: "#f59e0b", width: 1, dash: "dot" } }],
              } as Partial<Layout>}
              config={{ responsive: true, displayModeBar: false }}
              style={{ width: "100%" }}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border-dark text-slate-500 uppercase tracking-wider">
                    <th className="text-left pb-2">Sensor</th>
                    <th className="text-right pb-2">During fault</th>
                    <th className="text-right pb-2">Normal avg</th>
                    <th className="text-right pb-2">Deviation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-dark/50">
                  {attribution.top_features.map((f) => (
                    <tr
                      key={f.feature}
                      onClick={() => setSelectedFeature(f.feature)}
                      className="hover:bg-white/[0.02] cursor-pointer"
                      title="Click to view this sensor in the chart"
                    >
                      <td className="py-2 pr-3">
                        <div className="font-medium text-slate-300 truncate max-w-[160px]">{f.description}</div>
                        <div className="text-slate-600 font-mono">{f.feature}</div>
                      </td>
                      <td className="py-2 text-right font-mono text-slate-200">{f.anomaly_mean_value.toFixed(2)}</td>
                      <td className="py-2 text-right font-mono text-slate-500">{f.mean.toFixed(2)}</td>
                      <td className={`py-2 text-right font-bold ${f.z_score >= 3 ? "text-red-400" : f.z_score >= 2 ? "text-amber-400" : "text-slate-400"}`}>
                        {f.z_score.toFixed(2)}σ
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[10px] text-slate-600 mt-3">Click a row to view that sensor in the chart above</p>
            </div>
          </div>
        </div>
      )}

      {/* Subsystem Anomaly Signals */}
      {subsystemData && <SubsystemSignals data={subsystemData} />}

      {/* CARE sub-scores */}
      <div className="bg-panel-dark border border-border-dark rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border-dark flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-base">leaderboard</span>
          <h4 className="text-sm font-bold">CARE Sub-scores for this Event</h4>
        </div>
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Coverage (F2)", value: fmt(event.coverage), note: "fraction of fault rows flagged", show: isAnomaly },
            { label: "Earliness", value: fmt(event.earliness_weight), note: "detection in first half = 100%", show: isAnomaly },
            { label: "Reliability Alarm", value: event.reliability_alarm == null ? "N/A" : event.reliability_alarm ? "Triggered" : "No alarm", note: "criticality counter ≥ 72", show: true },
            { label: "Detection", value: event.has_detection ? "Yes" : "No", note: isAnomaly ? "at least one row flagged" : "false alarms = none expected", show: true },
          ].map((item) => (
            <div key={item.label} className="p-3 bg-background-dark rounded-lg border border-border-dark">
              <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">{item.label}</p>
              <p className={`text-lg font-bold ${!item.show ? "text-slate-600" : "text-slate-100"}`}>
                {item.show ? item.value : "N/A"}
              </p>
              <p className="text-[10px] text-slate-600 mt-1">{item.note}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
