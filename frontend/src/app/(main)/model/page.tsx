"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchModelInfo, postPredict, ModelInfo } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useState } from "react";
import dynamic from "next/dynamic";
import type { Layout } from "plotly.js";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const TOP_FEATURES = [
  { key: "wind_speed_3_avg", label: "Wind Speed (m/s)" },
  { key: "power_30_avg", label: "Grid Power (normalized)" },
  { key: "sensor_11_avg", label: "Gearbox bearing HS temp (°C)" },
  { key: "sensor_12_avg", label: "Gearbox oil temp (°C)" },
  { key: "sensor_13_avg", label: "Generator bearing DE temp (°C)" },
];

export default function ModelPage() {
  const { data: info, isLoading } = useQuery<ModelInfo>({
    queryKey: ["model-info"],
    queryFn: fetchModelInfo,
  });

  const [featureVals, setFeatureVals] = useState<Record<string, string>>({});
  const [predResult, setPredResult] = useState<{ anomaly_score: number; is_anomaly: boolean; threshold: number } | null>(null);
  const [predLoading, setPredLoading] = useState(false);

  async function handlePredict(e: React.FormEvent) {
    e.preventDefault();
    const parsed: Record<string, number> = {};
    for (const [k, v] of Object.entries(featureVals)) {
      const n = parseFloat(v);
      if (!isNaN(n)) parsed[k] = n;
    }
    setPredLoading(true);
    try {
      const res = await postPredict(parsed);
      setPredResult(res);
    } finally {
      setPredLoading(false);
    }
  }

  return (
    <div className="p-6 flex flex-col gap-6 max-w-5xl mx-auto">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-primary font-semibold text-sm">
          <span className="material-symbols-outlined text-sm">science</span>
          MODEL INFO & VALIDATION
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Predictive Models</h2>
      </div>

      {isLoading && <LoadingSpinner />}

      {info && (
        <>
          {/* Isolation Forest */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-bold uppercase text-slate-400 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-amber-400">forest</span>
              Isolation Forest <span className="text-slate-600 font-normal normal-case text-xs">(unsupervised baseline)</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-border-dark bg-panel-dark">
                <p className="text-slate-500 text-xs font-bold uppercase mb-1">Architecture</p>
                <p className="text-lg font-semibold">{info.isolation_forest.algorithm}</p>
                <div className="mt-2 text-xs py-1 px-2 bg-primary/10 text-primary rounded inline-block">{info.isolation_forest.n_estimators} estimators</div>
              </div>
              <div className="p-4 rounded-xl border border-border-dark bg-panel-dark">
                <p className="text-slate-500 text-xs font-bold uppercase mb-1">Val FP Rate</p>
                <p className="text-2xl font-bold">{(info.isolation_forest.val_fp_rate * 100).toFixed(1)}%</p>
                <p className="text-xs text-slate-500 mt-1">5th percentile threshold</p>
              </div>
              <div className="p-4 rounded-xl border border-border-dark bg-panel-dark">
                <p className="text-slate-500 text-xs font-bold uppercase mb-1">Features</p>
                <p className="text-2xl font-bold">{info.isolation_forest.feature_count}</p>
                <p className="text-xs text-slate-500 mt-1">{info.isolation_forest.train_rows.toLocaleString()} train rows</p>
              </div>
            </div>
            <div className="p-4 bg-panel-dark border border-border-dark rounded-xl text-xs text-slate-500">
              <p><span className="text-slate-400">Score meaning:</span> {info.isolation_forest.score_meaning}</p>
              <p className="mt-1"><span className="text-slate-400">Trained:</span> {new Date(info.isolation_forest.train_date).toLocaleString()}</p>
              <p className="mt-1"><span className="text-slate-400">Contamination:</span> {info.isolation_forest.contamination} · <span className="text-slate-400">Random state:</span> {info.isolation_forest.random_state}</p>
            </div>
          </div>

          {/* Random Forest */}
          {info.random_forest && (
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-bold uppercase text-slate-400 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-emerald-400">account_tree</span>
                Random Forest <span className="text-slate-600 font-normal normal-case text-xs">(supervised · active model)</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl border border-border-dark bg-panel-dark">
                  <p className="text-slate-500 text-xs font-bold uppercase mb-1">Train AUC</p>
                  <p className="text-2xl font-bold text-emerald-400">{info.random_forest.train_auc.toFixed(4)}</p>
                  <p className="text-xs text-slate-500 mt-1">in-sample</p>
                </div>
                <div className="p-4 rounded-xl border border-border-dark bg-panel-dark">
                  <p className="text-slate-500 text-xs font-bold uppercase mb-1">CV AUC</p>
                  <p className="text-2xl font-bold text-amber-400">{info.random_forest.cv_auc.toFixed(4)}</p>
                  <p className="text-xs text-slate-500 mt-1">LOEO cross-val</p>
                </div>
                <div className="p-4 rounded-xl border border-border-dark bg-panel-dark">
                  <p className="text-slate-500 text-xs font-bold uppercase mb-1">Train Rows</p>
                  <p className="text-2xl font-bold">{info.random_forest.train_rows.toLocaleString()}</p>
                  <p className="text-xs text-slate-500 mt-1">{info.random_forest.anomaly_rows.toLocaleString()} anomaly</p>
                </div>
                <div className="p-4 rounded-xl border border-border-dark bg-panel-dark">
                  <p className="text-slate-500 text-xs font-bold uppercase mb-1">Config</p>
                  <p className="text-base font-semibold">{info.random_forest.n_estimators} trees</p>
                  <p className="text-xs text-slate-500 mt-1">depth {info.random_forest.max_depth} · balanced</p>
                </div>
              </div>
              <div className="bg-panel-dark border border-border-dark rounded-xl overflow-hidden">
                <div className="border-b border-border-dark px-5 py-3">
                  <h4 className="font-bold text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-sm">bar_chart</span>
                    Top Feature Importances
                  </h4>
                </div>
                <div className="p-4 flex flex-col gap-2">
                  {info.random_forest.top_features.slice(0, 15).map((f) => (
                    <div key={f.feature} className="flex items-center gap-3 text-xs">
                      <span className="w-44 text-slate-400 truncate font-mono">{f.feature}</span>
                      <div className="flex-1 bg-background-dark rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${(f.importance / info.random_forest!.top_features[0].importance) * 100}%` }}
                        />
                      </div>
                      <span className="w-14 text-right text-slate-500">{(f.importance * 100).toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Live Prediction */}
          <div className="bg-panel-dark border border-border-dark rounded-xl overflow-hidden">
            <div className="border-b border-border-dark px-5 py-4 flex items-center justify-between bg-background-dark/20">
              <h3 className="font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">terminal</span>
                Live Prediction
              </h3>
              <span className="text-xs font-mono text-slate-500">POST /api/predict</span>
            </div>
            <div className="p-5">
              <form onSubmit={handlePredict} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {TOP_FEATURES.map((f) => (
                  <div key={f.key} className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-300">{f.label}</label>
                    <input
                      type="number"
                      step="any"
                      value={featureVals[f.key] ?? ""}
                      onChange={(e) => setFeatureVals((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      className="w-full bg-background-dark border border-border-dark rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all text-slate-100"
                      placeholder="0.0"
                    />
                  </div>
                ))}
                <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setFeatureVals({}); setPredResult(null); }}
                    className="px-5 py-2.5 rounded-lg border border-border-dark text-sm font-semibold hover:bg-white/5 transition-colors text-slate-400"
                  >
                    Clear
                  </button>
                  <button
                    type="submit"
                    disabled={predLoading}
                    className="px-7 py-2.5 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-all"
                  >
                    {predLoading ? "Running..." : "Execute Prediction"}
                  </button>
                </div>
              </form>
            </div>

            {predResult && (
              <div className="border-t border-border-dark p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500 uppercase">Live Output</span>
                  <div className="flex items-center gap-2">
                    <div className="size-2 bg-green-500 rounded-full" />
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">200 OK</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="p-3 bg-background-dark rounded-lg border border-border-dark">
                    <p className="text-xs text-slate-500 mb-1">Score</p>
                    <p className={`text-lg font-bold ${predResult.is_anomaly ? "text-red-400" : "text-emerald-400"}`}>
                      {predResult.anomaly_score.toFixed(4)}
                    </p>
                  </div>
                  <div className="p-3 bg-background-dark rounded-lg border border-border-dark">
                    <p className="text-xs text-slate-500 mb-1">Classification</p>
                    <p className={`text-lg font-bold ${predResult.is_anomaly ? "text-red-400" : "text-emerald-400"}`}>
                      {predResult.is_anomaly ? "ANOMALY" : "NORMAL"}
                    </p>
                  </div>
                  <div className="p-3 bg-background-dark rounded-lg border border-border-dark">
                    <p className="text-xs text-slate-500 mb-1">Threshold</p>
                    <p className="text-lg font-bold text-slate-300">{predResult.threshold.toFixed(4)}</p>
                  </div>
                </div>
                <Plot
                  data={[{
                    type: "indicator",
                    mode: "gauge+number",
                    value: predResult.anomaly_score,
                    gauge: {
                      axis: { range: [-1, 0], tickfont: { color: "#64748b", size: 8 } },
                      bar: { color: predResult.is_anomaly ? "#ef4444" : "#22c55e" },
                      bgcolor: "#101622",
                      bordercolor: "#2d3a54",
                      steps: [
                        { range: [-1, predResult.threshold], color: "#450a0a" },
                        { range: [predResult.threshold, 0], color: "#052e16" },
                      ],
                      threshold: { line: { color: "#f59e0b", width: 2 }, thickness: 0.75, value: predResult.threshold },
                    },
                    number: { font: { color: "#f1f5f9", size: 18 } },
                  }]}
                  layout={{
                    paper_bgcolor: "#101622",
                    font: { color: "#94a3b8" },
                    height: 180,
                    margin: { l: 20, r: 20, t: 20, b: 10 },
                  } as Partial<Layout>}
                  config={{ responsive: true, displayModeBar: false }}
                  style={{ width: "100%" }}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
