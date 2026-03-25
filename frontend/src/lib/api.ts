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
  lead_time_hours: number | null;
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

export interface SimulationPoint {
  index: number;
  time_stamp: string;
  anomaly_score: number;
  pred_anomaly: number;
}

export interface SimulationResult {
  event_id: number;
  event_label: string;
  event_description: string;
  sample_start_pct: number;
  threshold: number;
  total_sampled: number;
  anomaly_count: number;
  first_detection_index: number | null;
  points: SimulationPoint[];
}

export const fetchSimulation = (n = 150, eventId?: string | number) => {
  const params = new URLSearchParams({ n: String(n) });
  if (eventId != null) params.set("event_id", String(eventId));
  params.set("seed", String(Math.floor(Math.random() * 100000)));
  return apiFetch<SimulationResult>(`/simulate?${params}`);
};

export interface WorkOrder {
  work_order_id: string;
  generated_at: string;
  asset_id: number;
  event_id: number;
  fault_description: string;
  urgency: "HIGH" | "MEDIUM" | "LOW";
  has_model_detection: boolean;
  lead_time_hours: number | null;
  top_contributing_sensors: {
    sensor: string;
    description: string;
    z_score: number;
    normal_mean: number;
    anomaly_mean: number;
    deviation_pct: number;
  }[];
  recommended_actions: string[];
  estimated_inspection_hours: number;
  notes: string;
}

export const postChat = (message: string, context?: Record<string, unknown>) =>
  apiFetch<{ response?: string; error?: string; work_order?: WorkOrder }>(`/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, context }),
  });

export interface SubsystemSignal {
  key: string;
  label: string;
  icon: string;
  color: string;
  signal: number;        // 0-1
  mean_z_score: number;
  description: string;
  sensors_checked: number;
  sensors_available: number;
  top_sensor: string | null;
  top_sensor_description: string | null;
  top_z_score: number | null;
}

export interface SubsystemSignalsResponse {
  event_id: number;
  event_label: string;
  has_anomaly_rows: boolean;
  subsystems: SubsystemSignal[];
}

export const fetchSubsystemSignals = (eventId: string | number) =>
  apiFetch<SubsystemSignalsResponse>(`/events/${eventId}/subsystems`);

// ── Fleet Overview ──────────────────────────────────────────────────────────────

export interface AssetOverview {
  asset_id: number;
  health_state: "critical" | "warning" | "healthy";
  health_score: number;
  fault_events: number;
  detected: number;
  missed: number;
  availability_pct: number | null;
  power_deficit_pct: number | null;
  avg_power_fault: number | null;
  avg_power_normal: number | null;
  avg_lead_time_hours: number | null;
  mtbf_days: number | null;
}

export interface FleetKpis {
  total_assets: number;
  critical: number;
  warning: number;
  healthy: number;
  fleet_availability_pct: number | null;
  active_alerts: number;
  assets_needing_maintenance: number;
  avg_power_deficit_pct: number | null;
  false_alarm_rate_pct: number | null;
  fleet_avg_lead_time_hours: number | null;
  fleet_mtbf_days: number | null;
}

export interface FleetOverviewResponse {
  assets: AssetOverview[];
  kpis: FleetKpis;
}

export const fetchFleetOverview = () =>
  apiFetch<FleetOverviewResponse>(`/fleet`);
