import { clsx } from "clsx";

interface MetricCardProps {
  label: string;
  value: string | number | null;
  subtitle?: string;
  variant?: "default" | "good" | "warn" | "bad";
  className?: string;
}

export function MetricCard({ label, value, subtitle, variant = "default", className }: MetricCardProps) {
  const valueColor = {
    default: "text-slate-100",
    good: "text-green-400",
    warn: "text-yellow-400",
    bad: "text-red-400",
  }[variant];

  return (
    <div className={clsx("bg-[#111827] border border-gray-800 rounded-xl p-5", className)}>
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={clsx("text-3xl font-bold tabular-nums", valueColor)}>
        {value === null ? "—" : value}
      </p>
      {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
    </div>
  );
}
