import { clsx } from "clsx";

interface StatusBadgeProps {
  label: string;
  variant: "anomaly" | "normal" | "neutral";
  size?: "sm" | "md";
}

export function StatusBadge({ label, variant, size = "md" }: StatusBadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center font-medium rounded-full",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
        variant === "anomaly" && "bg-red-900/50 text-red-400 border border-red-800",
        variant === "normal" && "bg-green-900/50 text-green-400 border border-green-800",
        variant === "neutral" && "bg-gray-800 text-slate-400 border border-gray-700"
      )}
    >
      {label}
    </span>
  );
}
