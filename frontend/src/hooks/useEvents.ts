import { useQuery } from "@tanstack/react-query";
import { fetchEvents, fetchEvent, fetchTimeseries, fetchFeatures, fetchAttribution, EventSummary, TimeseriesResponse, FeatureInfo, EventAttribution } from "@/lib/api";

export function useEvents(labelFilter = "all") {
  return useQuery<EventSummary[]>({
    queryKey: ["events", labelFilter],
    queryFn: () => fetchEvents(labelFilter),
  });
}

export function useEventDetail(eventId: string | number | null) {
  return useQuery<EventSummary>({
    queryKey: ["event", eventId],
    queryFn: () => fetchEvent(eventId!),
    enabled: !!eventId,
  });
}

export function useSensorData(eventId: string | number | null, feature: string, downsample = 500) {
  return useQuery<TimeseriesResponse>({
    queryKey: ["timeseries", eventId, feature, downsample],
    queryFn: () => fetchTimeseries(eventId!, feature, downsample),
    enabled: !!eventId && !!feature,
  });
}

export function useEventFeatures(eventId: string | number | null) {
  return useQuery<FeatureInfo[]>({
    queryKey: ["features", eventId],
    queryFn: () => fetchFeatures(eventId!),
    enabled: !!eventId,
  });
}

export function useEventAttribution(eventId: string | number | null) {
  return useQuery<EventAttribution>({
    queryKey: ["attribution", eventId],
    queryFn: () => fetchAttribution(eventId!),
    enabled: !!eventId,
  });
}
