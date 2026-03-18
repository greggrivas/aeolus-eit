"use client";

import { useParams } from "next/navigation";
import { useEventDetail, useSensorData, useEventFeatures, useEventAttribution } from "@/hooks/useEvents";
import { useAeolusStore } from "@/store/useAeolusStore";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { Layout, Shape, Data } from "plotly.js";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

function formatDate(s: string) {
  try {
    return new Date(s).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return s;
  }
}

function fmt(v: number | null | undefined) {
  if (v == null) return "—";
  return (v * 100).toFixed(1) + "%";
}

export default function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const selectedFeature = useAeolusStore((s) => s.selectedFeature);
  const setSelectedFeature = useAeolusStore((s) => s.setSelectedFeature);

  const { data: event, isLoading: eventLoading } = useEventDetail(eventId);
  const { data: timeseries, isLoading: tsLoading } = useSensorData(eventId, selectedFeature, 500);
  const { data: features } = useEventFeatures(eventId);
  const { data: attribution } = useEventAttribution(eventId);

  // Build chart data from timeseries
  const chartData = useMemo(() => {
    if (!timeseries?.points) return null;
    const pts = timeseries.points;
    const timestamps = pts.map((p) => p.time_stamp);
    const featureVals = pts.map((p) => p.feature_value);
    const anomalyScores = pts.map((p) => p.anomaly_score);
    const anomalyMask = pts.map((p) => p.pred_anomaly === 1);

    // Build anomaly region shapes
    const shapes: Partial<Shape>[] = [];
    let start: string | null = null;
    for (let i = 0; i < anomalyMask.length; i++) {
      if (anomalyMask[i] && start === null) start = timestamps[i];
      else if (!anomalyMask[i] && start !== null) {
        shapes.push({ type: "rect", xref: "x", yref: "paper", x0: start, x1: timestamps[i], y0: 0, y1: 1, fillcolor: "rgba(239,68,68,0.1)", line: { width: 0 } });
        start = null;
      }
    }
    if (start && timestamps.length > 0) {
      shapes.push({ type: "rect", xref: "x", yref: "paper", x0: start, x1: timestamps[timestamps.length - 1], y0: 0, y1: 1, fillcolor: "rgba(239,68,68,0.1)", line: { width: 0 } });
    }
    const firstDetectIdx = anomalyMask.indexOf(true);
    if (firstDetectIdx >= 0) {
      shapes.push({ type: "line", xref: "x", yref: "paper", x0: timestamps[firstDetectIdx], x1: timestamps[firstDetectIdx], y0: 0, y1: 1, line: { color: "#ef4444", width: 1.5, dash: "dot" } });
    }

    const traces: Data[] = [
      { x: timestamps, y: featureVals, type: "scatter", mode: "lines", name: selectedFeature, line: { color: "#1152d4", width: 1.5 }, yaxis: "y" },
      { x: timestamps, y: anomalyScores, type: "scatter", mode: "lines", name: "Anomaly score", line: { color: "#ef4444", width: 1, dash: "dot" }, fill: "tozeroy" as const, fillcolor: "rgba(239,68,68,0.05)", yaxis: "y2" },
    ];

    return { traces, shapes, firstDetectTs: firstDetectIdx >= 0 ? timestamps[firstDetectIdx] : null, anomalyCount: anomalyMask.filter(Boolean).length };
  }, [timeseries, selectedFeature]);

  if (eventLoading) return <div className="flex justify-center py-20"><LoadingSpinner /></div>;
  if (!event) return <div className="p-6 text-red-400">Event not found.</div>;

  const isAnomaly = event.event_label === "anomaly";

  return (
    <div className="flex flex-col p-5 gap-5">
      {/* Breadcrumb + header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
          <Link href="/events" className="hover:text-primary transition-colors">Events</Link>
          <span className="material-symbols-outlined text-xs">chevron_right</span>
          <span className="text-slate-200 font-medium">Event #{eventId}</span>
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`p-3 ${isAnomaly ? "bg-red-900/30 text-red-400" : "bg-emerald-900/30 text-emerald-400"} rounded-xl`}>
              <span className="material-symbols-outlined text-3xl">{isAnomaly ? "warning" : "check_circle"}</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-100">
                {event.event_description || `Event #${event.event_id}`}
                <span className="text-slate-500 font-normal ml-2 text-lg">#{event.event_id}</span>
              </h1>
              <p className="text-slate-500 text-sm mt-1 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">location_on</span> Asset #{event.asset_id}
                <span className="mx-1">·</span>
                <span className="material-symbols-outlined text-sm">schedule</span> {formatDate(event.event_start)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-panel-dark border border-border-dark p-4 rounded-xl">
          <p className="text-slate-500 text-xs font-medium mb-1">Total Rows</p>
          <p className="text-2xl font-bold">{event.row_count.toLocaleString()}</p>
        </div>
        <div className="bg-panel-dark border border-border-dark p-4 rounded-xl">
          <p className="text-slate-500 text-xs font-medium mb-1">Prediction Rows</p>
          <p className="text-2xl font-bold text-primary">{event.prediction_rows.toLocaleString()}</p>
        </div>
        <div className="bg-panel-dark border border-border-dark p-4 rounded-xl">
          <p className="text-slate-500 text-xs font-medium mb-1">Coverage (F2)</p>
          <p className={`text-2xl font-bold ${event.coverage != null ? "text-amber-400" : "text-slate-500"}`}>{fmt(event.coverage)}</p>
        </div>
        <div className={`bg-panel-dark border p-4 rounded-xl ${event.has_detection ? "border-l-4 border-l-emerald-500 border-border-dark" : "border-border-dark"}`}>
          <p className="text-slate-500 text-xs font-medium mb-1">Detection</p>
          <p className={`text-2xl font-bold ${event.has_detection ? "text-emerald-400" : "text-slate-500"}`}>
            {event.has_detection ? "YES" : "NO"}
          </p>
        </div>
      </div>

      {/* Main chart + features sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Chart */}
        <div className="lg:col-span-8 bg-panel-dark border border-border-dark rounded-xl p-5 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h4 className="text-base font-bold">Timeseries Analysis</h4>
              <p className="text-sm text-slate-500">Sensor value vs anomaly score</p>
            </div>
            <select
              value={selectedFeature}
              onChange={(e) => setSelectedFeature(e.target.value)}
              className="bg-background-dark border border-border-dark text-slate-200 text-sm rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-primary"
            >
              {features?.map((f) => (
                <option key={f.column_name} value={f.column_name}>
                  {f.column_name}
                </option>
              )) ?? <option value="power_30_avg">power_30_avg</option>}
            </select>
          </div>

          {tsLoading && <div className="flex-1 flex items-center justify-center min-h-[300px]"><LoadingSpinner /></div>}
          {chartData && !tsLoading && (
            <Plot
              data={chartData.traces}
              layout={{
                paper_bgcolor: "#1a2233",
                plot_bgcolor: "#1a2233",
                font: { color: "#94a3b8", size: 11 },
                xaxis: { gridcolor: "#2d3a54", linecolor: "#2d3a54", tickfont: { color: "#64748b", size: 9 } },
                yaxis: { gridcolor: "#2d3a54", linecolor: "#2d3a54", tickfont: { color: "#64748b", size: 9 }, title: { text: selectedFeature, font: { color: "#94a3b8", size: 10 } } },
                yaxis2: { gridcolor: "transparent", overlaying: "y", side: "right", tickfont: { color: "#64748b", size: 9 }, title: { text: "Score", font: { color: "#94a3b8", size: 10 } } },
                shapes: chartData.shapes,
                height: 340,
                autosize: true,
                margin: { l: 50, r: 50, t: 15, b: 35 },
                legend: { bgcolor: "#1a2233", bordercolor: "#2d3a54", font: { color: "#94a3b8", size: 10 } },
              } as Partial<Layout>}
              config={{ responsive: true, displayModeBar: false }}
              style={{ width: "100%" }}
            />
          )}

          {/* Legend */}
          <div className="mt-3 flex flex-wrap gap-5 items-center border-t border-border-dark pt-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-xs font-medium text-slate-400">{selectedFeature}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full border-2 border-dashed border-red-500" />
              <span className="text-xs font-medium text-slate-400">Anomaly Score</span>
            </div>
            {chartData?.anomalyCount && chartData.anomalyCount > 0 && (
              <div className="ml-auto flex items-center gap-1.5 px-2 py-1 rounded bg-red-900/20 text-red-400 text-[10px] font-bold border border-red-800/30">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                {chartData.anomalyCount} ANOMALY ROWS DETECTED
              </div>
            )}
          </div>
        </div>

        {/* Features sidebar */}
        <div className="lg:col-span-4 bg-panel-dark border border-border-dark rounded-xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border-dark flex items-center justify-between">
            <div>
              <h4 className="text-base font-bold">Event Features</h4>
              <p className="text-xs text-slate-500">Available sensor columns</p>
            </div>
            <span className="material-symbols-outlined text-slate-500">filter_list</span>
          </div>
          <div className="overflow-y-auto max-h-[420px]">
            <table className="w-full text-left text-sm">
              <thead className="bg-background-dark/50 sticky top-0">
                <tr>
                  <th className="px-4 py-2.5 font-semibold text-slate-500 text-[10px] uppercase tracking-wider">Sensor</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-500 text-[10px] uppercase tracking-wider text-right">Select</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-dark">
                {features?.slice(0, 20).map((f) => (
                  <tr
                    key={f.column_name}
                    onClick={() => setSelectedFeature(f.column_name)}
                    className={`hover:bg-white/[0.03] cursor-pointer transition-colors ${selectedFeature === f.column_name ? "bg-primary/10" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className={`font-medium text-xs ${selectedFeature === f.column_name ? "text-primary" : "text-slate-300"}`}>
                          {f.column_name}
                        </span>
                        <span className="text-[10px] text-slate-600 truncate max-w-[140px]">{f.description}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {selectedFeature === f.column_name && (
                        <span className="material-symbols-outlined text-primary text-base">radio_button_checked</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-border-dark bg-background-dark/30">
            <p className="text-[10px] text-slate-600 text-center">{features?.length ?? 0} features available</p>
          </div>
        </div>
      </div>

      {/* Fault Attribution */}
      {attribution && attribution.anomaly_point_count > 0 && (
        <div className="bg-panel-dark border border-border-dark rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border-dark flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">crisis_alert</span>
              <div>
                <h4 className="text-sm font-bold">Fault Attribution</h4>
                <p className="text-xs text-slate-500">Top contributing sensors during anomaly detections</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap justify-end">
              {attribution.lead_time_hours != null && (
                <div className="flex items-center gap-1.5 bg-amber-900/20 border border-amber-700/30 text-amber-400 px-3 py-1.5 rounded-lg">
                  <span className="material-symbols-outlined text-base">alarm</span>
                  <span className="text-xs font-bold">{attribution.lead_time_hours.toFixed(0)}h lead time</span>
                </div>
              )}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold ${
                attribution.score_trend === "escalating"
                  ? "bg-red-900/20 border-red-700/30 text-red-400"
                  : attribution.score_trend === "improving"
                  ? "bg-emerald-900/20 border-emerald-700/30 text-emerald-400"
                  : "bg-slate-800/50 border-border-dark text-slate-400"
              }`}>
                <span className="material-symbols-outlined text-base">
                  {attribution.score_trend === "escalating" ? "trending_up" : attribution.score_trend === "improving" ? "trending_down" : "trending_flat"}
                </span>
                {attribution.score_trend.toUpperCase()}
              </div>
              <div className="text-xs text-slate-500">
                {attribution.anomaly_point_count} / {attribution.total_prediction_rows} rows flagged
              </div>
            </div>
          </div>

          <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Z-score bar chart */}
            <Plot
              data={[{
                type: "bar",
                orientation: "h",
                x: [...attribution.top_features].reverse().map((f) => f.z_score),
                y: [...attribution.top_features].reverse().map((f) => f.description.length > 35 ? f.description.slice(0, 35) + "…" : f.description),
                marker: {
                  color: [...attribution.top_features].reverse().map((f) =>
                    f.z_score >= 3 ? "#ef4444" : f.z_score >= 2 ? "#f59e0b" : "#3b82f6"
                  ),
                },
                text: [...attribution.top_features].reverse().map((f) => `${f.z_score.toFixed(2)}σ`),
                textposition: "outside" as const,
                textfont: { color: "#94a3b8", size: 10 },
              }]}
              layout={{
                paper_bgcolor: "#1a2233",
                plot_bgcolor: "#1a2233",
                xaxis: { title: { text: "Z-score (σ from training mean)", font: { color: "#64748b", size: 10 } }, gridcolor: "#2d3a54", tickfont: { color: "#64748b", size: 9 }, zeroline: false },
                yaxis: { tickfont: { color: "#94a3b8", size: 10 }, automargin: true },
                margin: { l: 8, r: 60, t: 10, b: 40 },
                height: 300,
                shapes: [{ type: "line", x0: 2, x1: 2, y0: -0.5, y1: attribution.top_features.length - 0.5, yref: "y", xref: "x", line: { color: "#f59e0b", width: 1, dash: "dot" } }],
              } as Partial<Layout>}
              config={{ responsive: true, displayModeBar: false }}
              style={{ width: "100%" }}
            />

            {/* Attribution table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border-dark text-slate-500 uppercase tracking-wider">
                    <th className="text-left pb-2">Sensor</th>
                    <th className="text-right pb-2">Observed</th>
                    <th className="text-right pb-2">Normal mean</th>
                    <th className="text-right pb-2">Z-score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-dark/50">
                  {attribution.top_features.map((f) => (
                    <tr key={f.feature} className="hover:bg-white/[0.02]">
                      <td className="py-2 pr-3">
                        <div className="font-medium text-slate-300 truncate max-w-[160px]" title={f.description}>{f.description}</div>
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
            </div>
          </div>
        </div>
      )}

      {/* CARE scores + log section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* CARE breakdown */}
        <div className="bg-panel-dark border border-border-dark rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border-dark">
            <h4 className="text-sm font-bold">CARE Sub-scores</h4>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            {[
              { label: "Coverage (F2)", value: fmt(event.coverage), applicable: event.event_label === "anomaly" },
              { label: "Earliness (WS)", value: fmt(event.earliness_weight), applicable: event.event_label === "anomaly" },
              { label: "Reliability Alarm", value: event.reliability_alarm == null ? "N/A" : event.reliability_alarm ? "YES" : "NO", applicable: true },
              { label: "Has Detection", value: event.has_detection ? "YES" : "NO", applicable: true },
            ].map((item) => (
              <div key={item.label} className="p-3 bg-background-dark rounded-lg border border-border-dark">
                <p className="text-xs text-slate-500 mb-1">{item.label}</p>
                <p className={`text-lg font-bold ${!item.applicable ? "text-slate-600" : item.value === "N/A" ? "text-slate-600" : "text-slate-100"}`}>
                  {item.applicable ? item.value : "N/A"}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Detection log */}
        <div className="bg-panel-dark border border-border-dark rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border-dark flex items-center gap-3">
            <h4 className="text-sm font-bold">Detection Log</h4>
            {event.has_detection && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-900/30 text-red-400 uppercase">Active</span>
            )}
          </div>
          <div className="p-4 space-y-2 font-mono text-xs">
            <div className="flex gap-3 text-slate-500">
              <span className="shrink-0 text-slate-600">[INFO]</span>
              <span>Event #{event.event_id} — {event.event_label} — {event.event_description || "no description"}</span>
            </div>
            <div className="flex gap-3 text-slate-500">
              <span className="shrink-0 text-slate-600">[INFO]</span>
              <span>Prediction window: {event.prediction_rows.toLocaleString()} rows</span>
            </div>
            {chartData?.firstDetectTs && (
              <div className="flex gap-3 text-slate-500">
                <span className="shrink-0 text-amber-500">[WARN]</span>
                <span>First anomaly detection at {chartData.firstDetectTs}</span>
              </div>
            )}
            {chartData?.anomalyCount != null && chartData.anomalyCount > 0 && (
              <div className="flex gap-3 text-slate-500">
                <span className="shrink-0 text-red-500">[ALERT]</span>
                <span>Model flagged {chartData.anomalyCount} rows as anomalous ({((chartData.anomalyCount / event.prediction_rows) * 100).toFixed(1)}% of window)</span>
              </div>
            )}
            {!event.has_detection && event.event_label === "anomaly" && (
              <div className="flex gap-3 text-slate-500">
                <span className="shrink-0 text-slate-500">[MISS]</span>
                <span>No anomalies detected in prediction window — missed fault</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
