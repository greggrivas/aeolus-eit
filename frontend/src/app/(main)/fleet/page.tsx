"use client";

import Link from "next/link";
import { useState } from "react";
import { clsx } from "clsx";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useFleetOverview } from "@/hooks/useFleet";
import type { AssetOverview, FleetKpis } from "@/lib/api";

type FilterState = "all" | "critical" | "warning" | "healthy";
type SortState = "urgency" | "score";

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATE_COLORS = {
  critical: {
    border: "border-red-500/50",
    bg: "bg-red-950/25",
    score: "text-red-400",
    badge: "bg-red-900/40 text-red-400 border-red-800/50",
    bar: "bg-red-500",
  },
  warning: {
    border: "border-amber-400/50",
    bg: "bg-amber-950/20",
    score: "text-amber-400",
    badge: "bg-amber-900/40 text-amber-400 border-amber-800/50",
    bar: "bg-amber-400",
  },
  healthy: {
    border: "border-emerald-500/30",
    bg: "bg-emerald-950/10",
    score: "text-emerald-400",
    badge: "bg-emerald-900/40 text-emerald-400 border-emerald-800/50",
    bar: "bg-emerald-500",
  },
};

const FAULT_TYPE_COLORS: Record<string, string> = {
  hydraulic: "text-sky-400",
  gearbox: "text-amber-400",
  generator: "text-emerald-400",
  transformer: "text-violet-400",
};

// slope is normalised: positive = degrading, negative = improving, null = healthy (suppressed)
function trendIcon(slope: number | null) {
  if (slope == null) return null;
  if (slope > 0.000005)  return { icon: "trending_up",   color: "text-red-400",    label: "degrading" };
  if (slope < -0.000005) return { icon: "trending_down",  color: "text-emerald-400",label: "improving" };
  return                        { icon: "trending_flat",  color: "text-slate-500",  label: "stable" };
}

function fmt(val: number | null, suffix: string, decimals = 1) {
  return val != null ? val.toFixed(decimals) + suffix : "—";
}

// ── KPI Bar ───────────────────────────────────────────────────────────────────

function KpiBar({ kpis }: { kpis: FleetKpis }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      {[
        {
          label: "Fleet Availability",
          value: fmt(kpis.fleet_availability_pct, "%"),
          color: kpis.fleet_availability_pct == null ? "text-slate-400"
            : kpis.fleet_availability_pct > 85 ? "text-emerald-400"
            : kpis.fleet_availability_pct > 70 ? "text-amber-400"
            : "text-red-400",
        },
        {
          label: "Critical Turbines",
          value: String(kpis.critical),
          color: kpis.critical > 0 ? "text-red-400" : "text-emerald-400",
        },
        {
          label: "Needs Maintenance",
          value: String(kpis.assets_needing_maintenance),
          color: kpis.assets_needing_maintenance > 0 ? "text-amber-400" : "text-emerald-400",
        },
        {
          label: "Avg Power Deficit",
          value: fmt(kpis.avg_power_deficit_pct, "%"),
          color: kpis.avg_power_deficit_pct != null && kpis.avg_power_deficit_pct > 10
            ? "text-amber-400" : "text-emerald-400",
        },
      ].map((k) => (
        <div key={k.label} className="bg-panel-dark border border-border-dark rounded-xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">{k.label}</p>
          <p className={clsx("text-3xl font-black tabular-nums", k.color)}>{k.value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Turbine Card ──────────────────────────────────────────────────────────────

function TurbineCard({
  asset,
  selected,
  onClick,
}: {
  asset: AssetOverview;
  selected: boolean;
  onClick: () => void;
}) {
  const c = STATE_COLORS[asset.health_state];
  const trend = trendIcon(asset.trend_slope);
  const powerSign = asset.power_deficit_pct != null
    ? asset.power_deficit_pct > 0 ? "-" : "+"
    : "";
  const powerColor = asset.power_deficit_pct == null ? "text-slate-500"
    : asset.power_deficit_pct > 15 ? "text-red-400"
    : asset.power_deficit_pct > 5 ? "text-amber-400"
    : "text-emerald-400";

  return (
    <button
      onClick={onClick}
      className={clsx(
        "rounded-xl border p-4 text-left transition-all cursor-pointer w-full",
        c.border,
        c.bg,
        selected ? "ring-2 ring-primary ring-offset-1 ring-offset-background-dark" : "hover:brightness-110"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-slate-200">T-{String(asset.asset_id).padStart(2, "0")}</span>
        <span className={clsx(
          "text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide",
          c.badge
        )}>
          {asset.health_state}
        </span>
      </div>

      {/* Score */}
      <p className={clsx("text-4xl font-black tabular-nums leading-none mb-2", c.score)}>
        {asset.health_score}
      </p>

      {/* Health bar */}
      <div className="w-full h-1 bg-white/10 rounded-full mb-3 overflow-hidden">
        <div className={clsx("h-full rounded-full", c.bar)} style={{ width: `${asset.health_score}%` }} />
      </div>

      {/* Fault type */}
      <p className={clsx(
        "text-xs font-medium mb-3 truncate",
        asset.fault_type ? FAULT_TYPE_COLORS[asset.fault_type] ?? "text-slate-400" : "text-slate-600"
      )}>
        {asset.fault_type
          ? `${asset.fault_type.charAt(0).toUpperCase() + asset.fault_type.slice(1)} ${asset.fault_type_confidence != null ? Math.round(asset.fault_type_confidence * 100) + "%" : ""}`
          : "No fault signal"}
      </p>

      {/* Bottom row */}
      <div className="flex items-center justify-between text-[11px]">
        <span className={clsx("font-semibold tabular-nums", powerColor)}>
          {powerSign}{fmt(asset.power_deficit_pct, "% pwr")}
        </span>
        <div className="flex items-center gap-1">
          {trend && (
            <span className={clsx("material-symbols-outlined text-sm", trend.color)}>
              {trend.icon}
            </span>
          )}
          <span className="text-slate-600">{asset.fault_events} fault{asset.fault_events !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Lead time */}
      <div className="mt-2 text-[10px] text-slate-600 flex justify-between">
        <span>Lead time: <span className="text-slate-400">{fmt(asset.avg_lead_time_hours, "h", 0)}</span></span>
        <span>MTBF: <span className="text-slate-400">{asset.mtbf_days != null ? asset.mtbf_days.toFixed(1) + "d" : "—"}</span></span>
      </div>
    </button>
  );
}

// ── Asset Summary Panel ───────────────────────────────────────────────────────

function AssetSummaryPanel({ asset, onClose }: { asset: AssetOverview; onClose: () => void }) {
  const c = STATE_COLORS[asset.health_state];
  const trend = trendIcon(asset.trend_slope);

  const rows: { label: string; value: string; color?: string }[] = [
    { label: "Health score", value: `${asset.health_score} / 100`, color: c.score },
    {
      label: "Top fault signal",
      value: asset.fault_type
        ? `${asset.fault_type}${asset.fault_type_confidence != null ? ` (${Math.round(asset.fault_type_confidence * 100)}% conf.)` : ""}`
        : "None",
      color: asset.fault_type ? FAULT_TYPE_COLORS[asset.fault_type] : undefined,
    },
    { label: "Avg lead time", value: fmt(asset.avg_lead_time_hours, "h", 0) },
    { label: "Availability", value: fmt(asset.availability_pct, "%") },
    { label: "MTBF", value: asset.mtbf_days != null ? asset.mtbf_days.toFixed(1) + " days" : "—" },
    {
      label: "Power deficit",
      value: asset.power_deficit_pct != null
        ? (asset.power_deficit_pct > 0 ? "-" : "+") + fmt(asset.power_deficit_pct, "%")
        : "—",
      color: asset.power_deficit_pct != null && asset.power_deficit_pct > 10 ? "text-amber-400" : undefined,
    },
    { label: "Faults detected / total", value: `${asset.detected} / ${asset.fault_events}` },
    { label: "Missed faults", value: String(asset.missed), color: asset.missed > 0 ? "text-red-400" : undefined },
    {
      label: "Trend",
      value: trend ? trend.label : "—",
      color: trend?.color,
    },
  ];

  return (
    <div className="mt-4 rounded-xl border border-border-dark bg-panel-dark overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border-dark">
        <h3 className="font-bold text-base flex items-center gap-2">
          <span className={clsx("font-black tabular-nums text-lg", c.score)}>T-{String(asset.asset_id).padStart(2, "0")}</span>
          <span className="text-slate-400 font-normal">— asset summary</span>
        </h3>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
      <div className="divide-y divide-border-dark">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between px-5 py-3 text-sm">
            <span className="text-slate-500">{r.label}</span>
            <span className={clsx("font-semibold tabular-nums", r.color ?? "text-slate-200")}>{r.value}</span>
          </div>
        ))}
      </div>
      <div className="p-4 border-t border-border-dark grid grid-cols-2 gap-3">
        <Link
          href={`/events?asset=${asset.asset_id}`}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-border-dark bg-background-dark hover:bg-white/5 text-sm font-semibold text-slate-200 transition-colors"
        >
          View fault panel
          <span className="material-symbols-outlined text-sm">open_in_new</span>
        </Link>
        <button
          disabled
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-border-dark bg-background-dark text-sm font-semibold text-slate-600 cursor-not-allowed"
          title="Work order management not implemented"
        >
          Create work order
          <span className="material-symbols-outlined text-sm">open_in_new</span>
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FleetOverviewPage() {
  const { data, isLoading, error } = useFleetOverview();
  const [filter, setFilter] = useState<FilterState>("all");
  const [sort, setSort] = useState<SortState>("urgency");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const handleCardClick = (id: number) => {
    setSelectedId((prev) => (prev === id ? null : id));
  };

  const filtered = data
    ? [...data.assets]
        .filter((a) => filter === "all" || a.health_state === filter)
        .sort((a, b) =>
          sort === "urgency"
            ? a.health_score - b.health_score
            : a.asset_id - b.asset_id
        )
    : [];

  const selectedAsset = data?.assets.find((a) => a.asset_id === selectedId) ?? null;

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      {/* Header */}
      <div className="mb-1">
        <h2 className="text-2xl font-bold text-slate-100">Fleet Health Map — Wind Farm A</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          {data ? `${data.kpis.total_assets} turbines` : "—"}
        </p>
      </div>

      {/* Filter + sort bar */}
      <div className="flex flex-wrap items-center gap-2 my-5">
        {(["all", "critical", "warning", "healthy"] as FilterState[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={clsx(
              "px-4 py-1.5 rounded-lg text-sm font-semibold border transition-colors capitalize",
              filter === f
                ? "bg-primary text-white border-primary"
                : "bg-panel-dark border-border-dark text-slate-400 hover:text-slate-200"
            )}
          >
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            {data && f !== "all" && (
              <span className="ml-1.5 text-[10px] opacity-70">
                {f === "critical" ? data.kpis.critical
                  : f === "warning" ? data.kpis.warning
                  : data.kpis.healthy}
              </span>
            )}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-600">Sort:</span>
          {(["urgency", "score"] as SortState[]).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors capitalize",
                sort === s
                  ? "bg-white/10 border-white/20 text-slate-200"
                  : "bg-panel-dark border-border-dark text-slate-500 hover:text-slate-300"
              )}
            >
              {s === "urgency" ? "Sort: Urgency" : "Sort: Asset ID"}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-24">
          <LoadingSpinner className="mx-auto" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-800/50 bg-red-950/20 p-6 text-red-400 text-sm">
          Failed to load fleet data: {String(error)}
        </div>
      )}

      {data && (
        <>
          {/* KPI bar */}
          <KpiBar kpis={data.kpis} />

          {/* Legend */}
          <div className="flex items-center gap-5 mb-4 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-red-500 inline-block" />Critical &lt;50</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-amber-400 inline-block" />Warning 50–74</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-emerald-500 inline-block" />Healthy 75–100</span>
          </div>

          {/* Card grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtered.map((asset) => (
              <TurbineCard
                key={asset.asset_id}
                asset={asset}
                selected={selectedId === asset.asset_id}
                onClick={() => handleCardClick(asset.asset_id)}
              />
            ))}
          </div>

          {/* Expandable summary */}
          {selectedAsset && (
            <AssetSummaryPanel
              asset={selectedAsset}
              onClose={() => setSelectedId(null)}
            />
          )}

          {/* Performance table */}
          <div className="mt-8 rounded-xl border border-border-dark bg-panel-dark overflow-hidden">
            <div className="px-6 py-4 border-b border-border-dark">
              <h3 className="text-base font-bold text-slate-100">Asset Performance Summary</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-background-dark/50">
                  <tr>
                    {["Asset", "Health", "Availability", "Fault Events", "Detected", "Missed", "Power Deficit", "Lead Time", "MTBF", "Fault Type", "Trend"].map((h) => (
                      <th key={h} className="px-5 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-dark">
                  {[...data.assets]
                    .sort((a, b) => a.health_score - b.health_score)
                    .map((asset) => {
                      const c = STATE_COLORS[asset.health_state];
                      const trend = trendIcon(asset.trend_slope);
                      return (
                        <tr
                          key={asset.asset_id}
                          className="hover:bg-white/[0.03] transition-colors cursor-pointer"
                          onClick={() => { handleCardClick(asset.asset_id); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                        >
                          <td className="px-5 py-3.5 text-sm font-bold text-slate-100">T-{String(asset.asset_id).padStart(2, "0")}</td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <span className={clsx("text-lg font-black tabular-nums", c.score)}>{asset.health_score}</span>
                              <span className={clsx("text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase", c.badge)}>{asset.health_state}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-sm tabular-nums text-slate-300">{fmt(asset.availability_pct, "%")}</td>
                          <td className="px-5 py-3.5 text-sm tabular-nums text-slate-400">{asset.fault_events}</td>
                          <td className="px-5 py-3.5 text-sm tabular-nums text-emerald-400">{asset.detected}</td>
                          <td className="px-5 py-3.5 text-sm tabular-nums">
                            <span className={asset.missed > 0 ? "text-red-400 font-bold" : "text-slate-400"}>{asset.missed}</span>
                          </td>
                          <td className="px-5 py-3.5 text-sm tabular-nums text-slate-300">{fmt(asset.power_deficit_pct, "%")}</td>
                          <td className="px-5 py-3.5 text-sm tabular-nums text-sky-400">{fmt(asset.avg_lead_time_hours, "h", 0)}</td>
                          <td className="px-5 py-3.5 text-sm tabular-nums text-violet-400">{asset.mtbf_days != null ? asset.mtbf_days.toFixed(1) + "d" : "—"}</td>
                          <td className="px-5 py-3.5 text-sm">
                            {asset.fault_type ? (
                              <span className={clsx("capitalize font-medium", FAULT_TYPE_COLORS[asset.fault_type] ?? "text-slate-400")}>
                                {asset.fault_type}
                              </span>
                            ) : <span className="text-slate-600">—</span>}
                          </td>
                          <td className="px-5 py-3.5">
                            {trend ? (
                              <span className={clsx("material-symbols-outlined text-lg", trend.color)}>{trend.icon}</span>
                            ) : <span className="text-slate-600">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
