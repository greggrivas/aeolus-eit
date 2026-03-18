import { useQuery } from "@tanstack/react-query";

async function fetchHealth(): Promise<{ status: string; artifacts_loaded: boolean; events_loaded: number }> {
  const res = await fetch("/api/health", { cache: "no-store" });
  if (!res.ok) throw new Error("Backend not reachable");
  return res.json();
}

export function useBackendHealth() {
  return useQuery({
    queryKey: ["backend-health"],
    queryFn: fetchHealth,
    // Poll every 2s so the UI unlocks as soon as backend is ready
    refetchInterval: (query) => {
      if (query.state.data?.artifacts_loaded) return false; // stop polling once ready
      return 2000;
    },
    retry: false,       // don't retry — just poll via refetchInterval
    staleTime: 0,       // always re-check
  });
}
