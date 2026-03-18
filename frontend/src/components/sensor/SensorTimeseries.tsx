"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import type { Layout, Shape, Data } from "plotly.js";
import type { TimeseriesResponse } from "@/lib/api";

// Dynamic import to avoid SSR issues with Plotly
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface Props {
  data: TimeseriesResponse;
}

const DARK_LAYOUT = {
  paper_bgcolor: "#111827",
  plot_bgcolor: "#111827",
  font: { color: "#94a3b8", size: 11 },
  xaxis: {
    gridcolor: "#1f2937",
    linecolor: "#374151",
    tickfont: { color: "#64748b", size: 10 },
  },
  yaxis: {
    gridcolor: "#1f2937",
    linecolor: "#374151",
    tickfont: { color: "#64748b", size: 10 },
    title: { text: "Sensor value", font: { color: "#94a3b8" } },
  },
  yaxis2: {
    gridcolor: "transparent",
    linecolor: "#374151",
    tickfont: { color: "#64748b", size: 10 },
    title: { text: "Anomaly score", font: { color: "#94a3b8" } },
    overlaying: "y",
    side: "right",
  },
  legend: {
    bgcolor: "#111827",
    bordercolor: "#374151",
    font: { color: "#94a3b8", size: 10 },
  },
  margin: { l: 50, r: 60, t: 20, b: 40 },
};

export function SensorTimeseries({ data }: Props) {
  const { timestamps, featureValues, anomalyScores, anomalyMask, statusIds } = useMemo(() => {
    const timestamps = data.points.map((p) => p.time_stamp);
    const featureValues = data.points.map((p) => p.feature_value);
    const anomalyScores = data.points.map((p) => p.anomaly_score);
    const anomalyMask = data.points.map((p) => p.pred_anomaly === 1);
    const statusIds = data.points.map((p) => p.status_type_id);
    return { timestamps, featureValues, anomalyScores, anomalyMask, statusIds };
  }, [data]);

  // Build anomaly region shapes
  const shapes: Partial<Shape>[] = useMemo(() => {
    const result: Partial<Shape>[] = [];
    let start: string | null = null;

    for (let i = 0; i < anomalyMask.length; i++) {
      if (anomalyMask[i] && start === null) {
        start = timestamps[i];
      } else if (!anomalyMask[i] && start !== null) {
        result.push({
          type: "rect",
          xref: "x",
          yref: "paper",
          x0: start,
          x1: timestamps[i],
          y0: 0,
          y1: 1,
          fillcolor: "rgba(239,68,68,0.1)",
          line: { width: 0 },
        });
        start = null;
      }
    }
    if (start !== null && timestamps.length > 0) {
      result.push({
        type: "rect",
        xref: "x",
        yref: "paper",
        x0: start,
        x1: timestamps[timestamps.length - 1],
        y0: 0,
        y1: 1,
        fillcolor: "rgba(239,68,68,0.1)",
        line: { width: 0 },
      });
    }

    // First detection marker
    const firstDetect = timestamps[anomalyMask.indexOf(true)];
    if (firstDetect) {
      result.push({
        type: "line",
        xref: "x",
        yref: "paper",
        x0: firstDetect,
        x1: firstDetect,
        y0: 0,
        y1: 1,
        line: { color: "#ef4444", width: 1.5, dash: "dot" },
      });
    }

    return result;
  }, [anomalyMask, timestamps]);

  const traces: Data[] = [
    {
      x: timestamps,
      y: featureValues,
      type: "scatter",
      mode: "lines",
      name: data.feature,
      line: { color: "#3b82f6", width: 1.5 },
      yaxis: "y",
    },
    {
      x: timestamps,
      y: anomalyScores,
      type: "scatter",
      mode: "lines",
      name: "Anomaly score",
      line: { color: "#f97316", width: 1, dash: "dot" },
      fill: "tozeroy",
      fillcolor: "rgba(249,115,22,0.05)",
      yaxis: "y2",
    },
  ];

  return (
    <Plot
      data={traces}
      layout={{
        ...DARK_LAYOUT,
        shapes,
        height: 380,
        autosize: true,
        title: {
          text: `${data.feature}${data.feature_description ? " — " + data.feature_description : ""}`,
          font: { color: "#cbd5e1", size: 12 },
          x: 0.01,
        },
      } as Partial<Layout>}
      config={{ responsive: true, displayModeBar: false }}
      style={{ width: "100%" }}
    />
  );
}
