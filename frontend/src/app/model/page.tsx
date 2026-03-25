"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchModelInfo, postPredict, postChat, ModelInfo, RFModelInfo } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useAeolusStore } from "@/store/useAeolusStore";
import { useState, useRef, useEffect } from "react";
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

  // Chat state
  const chatMessages = useAeolusStore((s) => s.chatMessages);
  const addChatMessage = useAeolusStore((s) => s.addChatMessage);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatDisabled, setChatDisabled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

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

  async function handleChatSend() {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput("");
    addChatMessage({ role: "user", content: msg });
    setChatLoading(true);
    try {
      const res = await postChat(msg, { model_algorithm: info?.isolation_forest?.algorithm, model_care_threshold: info?.isolation_forest?.threshold });
      if (res.error === "chat_not_configured") {
        setChatDisabled(true);
        addChatMessage({ role: "assistant", content: "Chat is not configured. Set OPENROUTER_API_KEY in the backend .env to enable AI responses." });
      } else if (res.response) {
        addChatMessage({ role: "assistant", content: res.response });
      }
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main content */}
      <section className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
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
                {/* Feature importance bar chart */}
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
      </section>

      {/* AI Chat panel */}
      <aside className="w-80 lg:w-96 border-l border-border-dark bg-panel-dark/50 flex flex-col shrink-0">
        <div className="p-4 border-b border-border-dark flex items-center gap-3">
          <div className="size-10 bg-primary/20 rounded-full flex items-center justify-center text-primary">
            <span className="material-symbols-outlined">smart_toy</span>
          </div>
          <div>
            <h4 className="font-bold text-sm">Aeolus AI Assistant</h4>
            <div className="flex items-center gap-1.5">
              <span className={`size-1.5 rounded-full ${chatDisabled ? "bg-slate-500" : "bg-green-500"}`} />
              <span className="text-[10px] text-slate-500 font-bold uppercase">
                {chatDisabled ? "Not configured" : "Online"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {chatMessages.length === 0 && (
            <div className="flex flex-col gap-1.5 max-w-[85%]">
              <div className="text-[10px] text-slate-500 font-bold ml-2 uppercase">Aeolus AI</div>
              <div className="bg-background-dark p-3 rounded-2xl rounded-tl-none border border-border-dark text-sm leading-relaxed text-slate-300">
                {chatDisabled
                  ? "Chat is not configured. Set OPENROUTER_API_KEY in the backend .env to enable AI responses."
                  : "Hi! I can answer questions about the Isolation Forest model, CARE metrics, or anomaly detection results. What would you like to know?"}
              </div>
            </div>
          )}
          {chatMessages.map((msg, i) => (
            <div key={i} className={`flex flex-col gap-1 max-w-[85%] ${msg.role === "user" ? "self-end" : ""}`}>
              <div className={`text-[10px] font-bold uppercase ${msg.role === "user" ? "text-right mr-2 text-slate-500" : "ml-2 text-slate-500"}`}>
                {msg.role === "user" ? "You" : "Aeolus AI"}
              </div>
              <div className={`p-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-white rounded-tr-none shadow-lg shadow-primary/20"
                  : "bg-background-dark border border-border-dark text-slate-300 rounded-tl-none"
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {chatLoading && (
            <div className="flex flex-col gap-1 max-w-[85%]">
              <div className="text-[10px] text-slate-500 font-bold ml-2 uppercase">Aeolus AI</div>
              <div className="bg-background-dark border border-border-dark p-3 rounded-2xl rounded-tl-none">
                <LoadingSpinner className="w-4 h-4" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-background-dark border-t border-border-dark">
          <div className="relative flex items-center">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleChatSend()}
              disabled={chatDisabled || chatLoading}
              className="w-full bg-panel-dark border border-border-dark rounded-xl pl-4 pr-12 py-3 text-sm focus:ring-1 focus:ring-primary outline-none transition-all text-slate-100 disabled:opacity-50 placeholder:text-slate-600"
              placeholder={chatDisabled ? "Chat not configured" : "Ask about the model or CARE scores..."}
            />
            <button
              onClick={handleChatSend}
              disabled={chatDisabled || chatLoading || !chatInput.trim()}
              className="absolute right-2 text-primary hover:text-primary/80 p-2 disabled:opacity-30"
            >
              <span className="material-symbols-outlined">send</span>
            </button>
          </div>
          <p className="text-[10px] text-center text-slate-600 mt-2">
            {chatDisabled ? "Set OPENROUTER_API_KEY to enable" : "Powered by OpenRouter"}
          </p>
        </div>
      </aside>
    </div>
  );
}
