export interface Session {
  name: string;
  title: string;
  user: string;
  provider?: string;
  model?: string;
  status: "Active" | "Limit Reached" | "Archived";
  last_message_at?: string;
  total_tokens?: number;
  creation: string;
  modified: string;
}

export interface Message {
  name: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  provider?: string;
  model?: string;
  token_count?: number;
  tool_calls?: string;
  tool_call_id?: string;
  is_error?: boolean;
  metadata?: string | Record<string, any>;
  creation: string;
}

export interface StructuredResult {
  data: Record<string, any>[];
  layout?: "table" | "list" | "bullets";
  format?: "table" | "list" | "bullets"; // backward compat for stored messages
  chart: ChartConfig | null;
  files: FileResult[];
  error: string | null;
}

export interface ChartConfig {
  type: "bar" | "line" | "pie" | "percentage";
  title: string;
  labels: string[];
  datasets: { name: string; values: number[] }[];
}

export interface FileResult {
  name: string;
  file_name: string;
  file_url: string;
  view_url: string;
  display_type: "image" | "pdf" | "video" | "text" | "download";
  file_size?: number;
  is_private?: number;
  attached_to_doctype?: string;
  attached_to_name?: string;
}

export interface ProviderModels {
  provider_name: string;
  provider_type: string;
  default_model: string;
  models: string[];
}

export interface StructuredResultEvent {
  session: string;
  message_id: string;
  result: StructuredResult;
}

export interface StreamingChunk {
  session: string;
  content: string;
}

export interface StreamingComplete {
  session: string;
  message_id: string;
  full_content: string;
  token_count: number;
}

export interface ToolCallEvent {
  session: string;
  tool: string;
  tool_call_id: string;
  status: "calling" | "done";
  result_preview?: string;
}

export interface Scheduler {
  name: string;
  title: string;
  description?: string;
  user: string;
  session_id?: string;
  enabled: boolean;
  status: "Active" | "Paused" | "Error" | "Completed";
  cron_expression: string;
  next_run_at?: string;
  query_doctype: string;
  query_filters?: Record<string, any>;
  query_fields?: string[];
  query_condition?: string;
  action_type: "email" | "notification" | "webhook" | "custom_code";
  action_config: Record<string, any>;
  total_runs: number;
  success_runs: number;
  error_runs: number;
  last_run_at?: string;
  last_error?: string;
  creation: string;
  modified: string;
}

export interface SchedulerRun {
  name: string;
  scheduler_id: string;
  status: "running" | "success" | "error" | "skipped";
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  matched_count: number;
  actioned_count: number;
  error?: string;
  result_data?: Record<string, any>;
  creation: string;
}

export interface RunStatsEntry {
  run_date: string;
  status: string;
  count: number;
  total_matched: number;
  total_actioned: number;
  avg_duration_ms: number;
}
