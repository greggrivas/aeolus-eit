"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useFleetOverview } from "@/hooks/useFleet";
import type { AssetOverview, FleetKpis } from "@/lib/api";

// ── KPI Card ────────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  icon: string;
  colorClass: string;
}

function KpiCard({ label, value, icon, colorClass }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-border-dark bg-panel-dark p-5 flex items-center gap-4">
      <div className={clsx("size-11 rounded-lg flex items-center justify-center bg-current/10", colorClass)}>
        <span className={clsx("material-symbols-outlined text-xl", colorClass)}>{icon}</span>
      </div>
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-0.5">{label}</p>
        <p className={clsx("text-2xl font-bold tabular-nums", colorClass)}>{value}</p>
      </div>
    </div>
  );
}

// ── Turbine SVG ─────────────────────────────────────────────────────────────────

function TurbineIcon({ state }: { state: "critical" | "warning" | "healthy" }) {
  const colorClass =
    state === "critical"
      ? "text-red-400"
      : state === "warning"
      ? "text-amber-400"
      : "text-emerald-400";

  return (
    <svg viewBox="0 0 64 80" className={clsx("w-12 h-12 mx-auto mb-2", colorClass)}>
      {/* Tower */}
      <rect x="29" y="40" width="6" height="35" rx="2" fill="currentColor" opacity="0.4" />
      {/* Hub */}
      <circle cx="32" cy="38" r="4" fill="currentColor" />
      {/* Blade 1 - up */}
      <path d="M32 34 C30 24 28 16 32 10 C36 16 34 24 32 34Z" fill="currentColor" opacity="0.8" />
      {/* Blade 2 - lower left */}
      <path d="M28 40 C19 36 12 30 10 24 C17 24 24 30 28 40Z" fill="currentColor" opacity="0.8" />
      {/* Blade 3 - lower right */}
      <path d="M36 40 C45 36 52 30 54 24 C47 24 40 30 36 40Z" fill="currentColor" opacity="0.8" />
    </svg>
  );
}

// ── Turbine Card ────────────────────────────────────────────────────────────────

function TurbineCard({ asset }: { asset: AssetOverview }) {
  const s = asset.health_state;

  const borderClass =
    s === "critical"
      ? "border-red-500/40"
      : s === "warning"
      ? "border-amber-400/40"
      : "border-emerald-500/40";

  const bgClass =
    s === "critical"
      ? "bg-red-950/20"
      : s === "warning"
      ? "bg-amber-950/20"
      : "bg-emerald-950/10";

  const scoreClass =
    s === "critical"
      ? "text-red-400"
      : s === "warning"
      ? "text-amber-400"
      : "text-emerald-400";

  const badgeClass =
    s === "critical"
      ? "bg-red-900/40 text-red-400 border-red-800/50"
      : s === "warning"
      ? "bg-amber-900/40 text-amber-400 border-amber-800/50"
      : "bg-emerald-900/40 text-emerald-400 border-emerald-800/50";

  return (
    <div
      className={clsx(
        "rounded-xl border p-4 flex flex-col items-center text-center transition-colors hover:brightness-110",
        borderClass,
        bgClass
      )}
    >
      <TurbineIcon state={s} />
      <p className="font-bold text-slate-100 text-sm">T-{asset.asset_id}</p>
      <p className={clsx("text-3xl font-black tabular-nums mt-1", scoreClass)}>
        {asset.health_score}
      </p>
      <span
        className={clsx(
          "mt-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide",
          badgeClass
        )}
      >
        {s}
      </span>
      {asset.fault_events > 0 && (
        <p className="mt-2 text-[10px] text-slate-500">
          {asset.fault_events} fault{asset.fault_events !== 1 ? "s" : ""} &middot; {asset.detected} detected
        </p>
      )}
      {asset.trend_slope != null && (
        <div className="mt-1.5 flex items-center justify-center gap-1">
          <span
            className={clsx(
              "material-symbols-outlined text-sm",
              asset.trend_slope < -0.000005
                ? "text-red-400"
                : asset.trend_slope > 0.000005
                ? "text-emerald-400"
                : "text-slate-500"
            )}
          >
            {asset.trend_slope < -0.000005
              ? "trending_down"
              : asset.trend_slope > 0.000005
              ? "trending_up"
              : "trending_flat"}
          </span>
          <span className="text-[9px] text-slate-600">trend</span>
        </div>
      )}
    </div>
  );
}

// ── KPI helpers ─────────────────────────────────────────────────────────────────

function buildKpiCards(kpis: FleetKpis) {
  const availColor =
    kpis.fleet_availability_pct == null
      ? "text-slate-400"
      : kpis.fleet_availability_pct > 85
      ? "text-emerald-400"
      : kpis.fleet_availability_pct > 70
      ? "text-amber-400"
      : "text-red-400";

  const alertColor = kpis.active_alerts > 0 ? "text-red-400" : "text-emerald-400";
  const maintColor = kpis.assets_needing_maintenance > 0 ? "text-amber-400" : "text-emerald-400";

  const deficitColor =
    kpis.avg_power_deficit_pct != null && kpis.avg_power_deficit_pct > 10
      ? "text-amber-400"
      : "text-emerald-400";

  return [
    {
      label: "Fleet Availability",
      value:
        kpis.fleet_availability_pct != null
          ? kpis.fleet_availability_pct.toFixed(1) + "%"
          : "—",
      icon: "sensors",
      colorClass: availColor,
    },
    {
      label: "Active Alerts",
      value: String(kpis.active_alerts),
      icon: "crisis_alert",
      colorClass: alertColor,
    },
    {
      label: "Needs Maintenance",
      value: String(kpis.assets_needing_maintenance),
      icon: "build",
      colorClass: maintColor,
    },
    {
      label: "Avg Power Deficit",
      value:
        kpis.avg_power_deficit_pct != null
          ? kpis.avg_power_deficit_pct.toFixed(1) + "%"
          : "—",
      icon: "bolt",
      colorClass: deficitColor,
    },
    {
      label: "False Alarm Rate",
      value:
        kpis.false_alarm_rate_pct != null
          ? kpis.false_alarm_rate_pct.toFixed(1) + "%"
          : "—",
      icon: "notifications_off",
      colorClass:
        kpis.false_alarm_rate_pct != null && kpis.false_alarm_rate_pct > 20
          ? "text-red-400"
          : kpis.false_alarm_rate_pct != null && kpis.false_alarm_rate_pct > 10
          ? "text-amber-400"
          : "text-emerald-400",
    },
    {
      label: "Avg Lead Time",
      value:
        kpis.fleet_avg_lead_time_hours != null
          ? kpis.fleet_avg_lead_time_hours.toFixed(0) + "h"
          : "—",
      icon: "schedule",
      colorClass: "text-sky-400",
    },
    {
      label: "Fleet MTBF",
      value:
        kpis.fleet_mtbf_days != null
          ? kpis.fleet_mtbf_days.toFixed(1) + "d"
          : "—",
      icon: "cycle",
      colorClass: "text-violet-400",
    },
  ];
}

// ── Page ────────────────────────────────────────────────────────────────────────

export default function FleetOverviewPage() {
  const { data, isLoading, error } = useFleetOverview();

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      {/* Page header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-100">Fleet Overview — Wind Farm A</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Per-asset health, availability, and power metrics
        </p>
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
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-4 mb-8">
            {buildKpiCards(data.kpis).map((card) => (
              <KpiCard key={card.label} {...card} />
            ))}
          </div>

          {/* Turbine Health Map */}
          <div className="rounded-xl border border-border-dark bg-panel-dark p-6 mb-8">
            <div className="mb-4">
              <h3 className="text-base font-bold text-slate-100">Turbine Health Map</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                (grid layout — positions are illustrative, not geographic)
              </p>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-4">
              {[...data.assets]
                .sort((a, b) => a.asset_id - b.asset_id)
                .map((asset) => (
                  <TurbineCard key={asset.asset_id} asset={asset} />
                ))}
            </div>
          </div>

          {/* Asset Performance Table */}
          <div className="rounded-xl border border-border-dark bg-panel-dark overflow-hidden">
            <div className="px-6 py-4 border-b border-border-dark">
              <h3 className="text-base font-bold text-slate-100">Asset Performance Summary</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-background-dark/50">
                  <tr>
                    <th className="px-5 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Asset</th>
                    <th className="px-5 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Health</th>
                    <th className="px-5 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Availability</th>
                    <th className="px-5 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Fault Events</th>
                    <th className="px-5 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Detected</th>
                    <th className="px-5 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Missed</th>
                    <th className="px-5 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Power Deficit</th>
                    <th className="px-5 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Lead Time</th>
                    <th className="px-5 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">MTBF</th>
                    <th className="px-5 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Trend</th>
                    <th className="px-5 py-3.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-dark">
                  {[...data.assets]
                    .sort((a, b) => a.health_score - b.health_score)
                    .map((asset) => {
                      const s = asset.health_state;
                      const scoreClass =
                        s === "critical"
                          ? "text-red-400"
                          : s === "warning"
                          ? "text-amber-400"
                          : "text-emerald-400";

                      const deficitClass =
                        asset.power_deficit_pct == null
                          ? "text-slate-500"
                          : asset.power_deficit_pct > 20
                          ? "text-red-400"
                          : asset.power_deficit_pct > 10
                          ? "text-amber-400"
                          : "text-slate-400";

                      return (
                        <tr key={asset.asset_id} className="hover:bg-white/[0.03] transition-colors">
                          <td className="px-5 py-3.5 text-sm font-bold text-slate-100">
                            T-{asset.asset_id}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <span className={clsx("text-lg font-black tabular-nums", scoreClass)}>
                                {asset.health_score}
                              </span>
                              <span
                                className={clsx(
                                  "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide",
                                  s === "critical"
                                    ? "bg-red-900/40 text-red-400 border-red-800/50"
                                    : s === "warning"
                                    ? "bg-amber-900/40 text-amber-400 border-amber-800/50"
                                    : "bg-emerald-900/40 text-emerald-400 border-emerald-800/50"
                                )}
                              >
                                {s}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-sm tabular-nums text-slate-300">
                            {asset.availability_pct != null
                              ? asset.availability_pct.toFixed(1) + "%"
                              : "—"}
                          </td>
                          <td className="px-5 py-3.5 text-sm tabular-nums text-slate-400">
                            {asset.fault_events}
                          </td>
                          <td className="px-5 py-3.5 text-sm tabular-nums text-emerald-400">
                            {asset.detected}
                          </td>
                          <td className="px-5 py-3.5 text-sm tabular-nums">
                            <span className={asset.missed > 0 ? "text-red-400 font-bold" : "text-slate-400"}>
                              {asset.missed}
                            </span>
                          </td>
                          <td className={clsx("px-5 py-3.5 text-sm tabular-nums font-medium", deficitClass)}>
                            {asset.power_deficit_pct != null
                              ? asset.power_deficit_pct.toFixed(1) + "%"
                              : "—"}
                          </td>
                          <td className="px-5 py-3.5 text-sm tabular-nums text-sky-400">
                            {asset.avg_lead_time_hours != null
                              ? asset.avg_lead_time_hours.toFixed(0) + "h"
                              : "—"}
                          </td>
                          <td className="px-5 py-3.5 text-sm tabular-nums text-violet-400">
                            {asset.mtbf_days != null
                              ? asset.mtbf_days.toFixed(1) + "d"
                              : "—"}
                          </td>
                          <td className="px-5 py-3.5">
                            {asset.trend_slope != null ? (
                              <span
                                className={clsx(
                                  "material-symbols-outlined text-lg",
                                  asset.trend_slope < -0.000005
                                    ? "text-red-400"
                                    : asset.trend_slope > 0.000005
                                    ? "text-emerald-400"
                                    : "text-slate-500"
                                )}
                              >
                                {asset.trend_slope < -0.000005
                                  ? "trending_down"
                                  : asset.trend_slope > 0.000005
                                  ? "trending_up"
                                  : "trending_flat"}
                              </span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <Link
                              href={`/events?asset=${asset.asset_id}`}
                              className="text-xs text-primary hover:underline font-medium"
                            >
                              View Events
                            </Link>
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
