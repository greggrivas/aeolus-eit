import { clsx } from "clsx";

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        "animate-spin rounded-full border-2 border-gray-700 border-t-blue-500",
        "w-6 h-6",
        className
      )}
    />
  );
}
