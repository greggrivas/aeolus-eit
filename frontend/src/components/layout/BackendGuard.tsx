"use client";

import { useBackendHealth } from "@/hooks/useBackendHealth";

export function BackendGuard({ children }: { children: React.ReactNode }) {
  const { data: health, isError } = useBackendHealth();

  if (isError || (health && !health.artifacts_loaded)) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background-dark">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="size-12 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <div>
            <p className="text-slate-300 font-semibold">
              {isError ? "Waiting for backend…" : `Loading artifacts… ${health?.events_loaded ?? 0} events`}
            </p>
            <p className="text-slate-600 text-sm mt-1">
              {isError
                ? "Make sure uvicorn is running on port 8000"
                : "Backend is loading SCADA data into memory"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!health) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background-dark">
        <div className="flex flex-col items-center gap-4">
          <div className="size-12 rounded-full border-2 border-slate-700 border-t-slate-400 animate-spin" />
          <p className="text-slate-500 text-sm">Connecting to backend…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
