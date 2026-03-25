import { useQuery } from "@tanstack/react-query";
import { fetchFleetOverview } from "@/lib/api";

export function useFleetOverview() {
  return useQuery({
    queryKey: ["fleet-overview"],
    queryFn: fetchFleetOverview,
    staleTime: 5 * 60 * 1000,
  });
}
