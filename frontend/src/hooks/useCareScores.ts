import { useQuery } from "@tanstack/react-query";
import { fetchCareScores, fetchEventScores, CareScores, EventCareBreakdown } from "@/lib/api";

export function useCareScores() {
  return useQuery<CareScores>({
    queryKey: ["care-scores"],
    queryFn: fetchCareScores,
  });
}

export function useEventCareScores() {
  return useQuery<EventCareBreakdown[]>({
    queryKey: ["event-care-scores"],
    queryFn: fetchEventScores,
  });
}
