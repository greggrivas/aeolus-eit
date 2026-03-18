"use client";

import { useRouter } from "next/navigation";
import { EventSummary } from "@/lib/api";
import { EventBadge } from "./EventBadge";
import { clsx } from "clsx";

interface EventTableProps {
  events: EventSummary[];
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function formatScore(v: number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return (v * 100).toFixed(1) + "%";
}

function StatusBar({ statusDist }: { statusDist: string }) {
  let dist: Record<string, number> = {};
  try { dist = JSON.parse(statusDist); } catch { return null; }
  const total = Object.values(dist).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const STATUS_COLORS: Record<string, string> = {
    "0": "bg-green-600",
    "1": "bg-blue-500",
    "2": "bg-green-400",
    "3": "bg-yellow-500",
    "4": "bg-red-500",
    "5": "bg-orange-500",
  };

  return (
    <div className="flex h-2 rounded overflow-hidden w-24">
      {Object.entries(dist).map(([status, count]) => (
        <div
          key={status}
          className={clsx("flex-none", STATUS_COLORS[status] ?? "bg-gray-500")}
          style={{ width: `${(count / total) * 100}%` }}
          title={`Status ${status}: ${count} rows`}
        />
      ))}
    </div>
  );
}

export function EventTable({ events }: EventTableProps) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-slate-500 text-xs uppercase tracking-wider">
            <th className="text-left px-4 py-3">ID</th>
            <th className="text-left px-4 py-3">Label</th>
            <th className="text-left px-4 py-3">Description</th>
            <th className="text-left px-4 py-3">Start</th>
            <th className="text-right px-4 py-3">Rows</th>
            <th className="text-left px-4 py-3">Status dist.</th>
            <th className="text-right px-4 py-3">Coverage</th>
            <th className="text-right px-4 py-3">Earliness</th>
          </tr>
        </thead>
        <tbody>
          {events.map((ev) => (
            <tr
              key={ev.event_id}
              onClick={() => router.push(`/events/${ev.event_id}`)}
              className="border-b border-gray-800/50 hover:bg-gray-800/50 cursor-pointer transition-colors"
            >
              <td className="px-4 py-3 font-mono text-slate-300">{ev.event_id}</td>
              <td className="px-4 py-3">
                <EventBadge label={ev.event_label} />
              </td>
              <td className="px-4 py-3 text-slate-400 max-w-xs truncate">
                {ev.event_description || "—"}
              </td>
              <td className="px-4 py-3 text-slate-400">{formatDate(ev.event_start)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-slate-400">
                {ev.prediction_rows.toLocaleString()}
              </td>
              <td className="px-4 py-3">
                <StatusBar statusDist={ev.status_dist} />
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                <span className={ev.coverage !== null ? "text-blue-400" : "text-slate-600"}>
                  {formatScore(ev.coverage)}
                </span>
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                <span className={ev.earliness_weight !== null ? "text-blue-400" : "text-slate-600"}>
                  {formatScore(ev.earliness_weight)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
