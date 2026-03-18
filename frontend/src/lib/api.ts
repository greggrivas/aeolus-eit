const FASTAPI_URL = process.env.FASTAPI_URL ?? "http://localhost:8000";
const API_BASE = typeof window === "undefined" ? FASTAPI_URL : "/api";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, { cache: "no-store", ...options });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface EventSummary {
  event_id: number;
  event_label: "anomaly" | "normal";
  event_description: string;
  asset_id: number;
  event_start: string;
  event_end: string;
  row_count: number;
  train_rows: number;
  prediction_rows: number;
  usable_train_rows: number;
  status_dist: string;
  coverage: number | null;
  accuracy: number | null;
  reliability_alarm: boolean | null;
  earliness_weight: number | null;
  has_detection: boolean;
}

export interface TimeseriesPoint {
  time_stamp: string;
  anomaly_score: number | null;
  pred_anomaly: number;
  status_type_id: number;
  feature_value: number | null;
}

export interface TimeseriesResponse {
  event_id: number;
  feature: string;
  feature_description: string;
  total_rows: number;
  returned_rows: number;
  points: TimeseriesPoint[];
}

export interface FeatureInfo {
  column_name: string;
  sensor_name: string;
  description: string;
  unit: string;
  statistics_type: string;
}

export interface CareScores {
  coverage: number;
  accuracy: number;
  reliability: number;
  earliness: number;
  care: number;
  care_zero_reason: string | null;
  total_normal_prediction_rows: number;
  total_tn: number;
  anomaly_events_with_detection: number;
  anomaly_event_count: number;
}

export interface EventCareBreakdown {
  event_id: number;
  event_label: string;
  coverage: number | null;
  reliability_alarm: boolean | null;
  earliness_weight: number | null;
  has_detection: boolean;
  lead_time_hours: number | null;
}

export interface AttributionFeature {
  feature: string;
  description: string;
  z_score: number;
  mean: number;
  std: number;
  anomaly_mean_value: number;
}

export interface EventAttribution {
  event_id: number;
  event_label: string;
  anomaly_point_count: number;
  total_prediction_rows: number;
  lead_time_hours: number | null;
  score_trend: "escalating" | "stable" | "improving" | "no_detections";
  top_features: AttributionFeature[];
}

export interface ModelInfo {
  algorithm: string;
  n_estimators: number;
  contamination: string;
  random_state: number;
  threshold: number;
  train_rows: number;
  val_rows: number;
  val_fp_rate: number;
  train_date: string;
  score_meaning: string;
  feature_count: number;
}

export interface PredictionResult {
  anomaly_score: number;
  is_anomaly: boolean;
  threshold: number;
  features_used: number;
}

// ── API calls ──────────────────────────────────────────────────────────────────

export const fetchEvents = (labelFilter = "all") =>
  apiFetch<EventSummary[]>(`/events?label_filter=${labelFilter}`);

export const fetchEvent = (eventId: string | number) =>
  apiFetch<EventSummary>(`/events/${eventId}`);

export const fetchTimeseries = (eventId: string | number, feature: string, downsample = 500) =>
  apiFetch<TimeseriesResponse>(`/events/${eventId}/timeseries?feature=${feature}&downsample=${downsample}`);

export const fetchFeatures = (eventId: string | number) =>
  apiFetch<FeatureInfo[]>(`/events/${eventId}/features`);

export const fetchAttribution = (eventId: string | number) =>
  apiFetch<EventAttribution>(`/events/${eventId}/attribution`);

export const fetchCareScores = () =>
  apiFetch<CareScores>(`/scores/summary`);

export const fetchEventScores = () =>
  apiFetch<EventCareBreakdown[]>(`/scores/events`);

export const fetchModelInfo = () =>
  apiFetch<ModelInfo>(`/model/info`);

export const postPredict = (features: Record<string, number>) =>
  apiFetch<PredictionResult>(`/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ features }),
  });

export const postChat = (message: string, context?: Record<string, unknown>) =>
  apiFetch<{ response?: string; error?: string }>(`/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, context }),
  });
