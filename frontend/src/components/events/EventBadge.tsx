import { StatusBadge } from "@/components/ui/StatusBadge";

export function EventBadge({ label }: { label: string }) {
  return (
    <StatusBadge
      label={label}
      variant={label === "anomaly" ? "anomaly" : label === "normal" ? "normal" : "neutral"}
      size="sm"
    />
  );
}
