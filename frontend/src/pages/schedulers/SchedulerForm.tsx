import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";
import {
  Timer,
  Play,
  Pause,
  Pencil,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  Target,
  Zap,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  FormView,
  FormSection,
  FormField,
  FormRow,
} from "@/components/form/FormView";
import { Scheduler, SchedulerRun, RunStatsEntry } from "@/types";

const inputClass =
  "w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 dark:text-gray-100";

const CRON_PRESETS = [
  { label: "Daily at 9:00 AM", value: "0 9 * * *" },
  { label: "Weekdays at 9:00 AM", value: "0 9 * * 1-5" },
  { label: "Every Monday at 9:00 AM", value: "0 9 * * 1" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "First of month", value: "0 0 1 * *" },
];

const CRON_LABELS: Record<string, string> = Object.fromEntries(
  CRON_PRESETS.map((p) => [p.value, p.label])
);

function cronToHuman(expr: string): string {
  return CRON_LABELS[expr] || expr;
}

function relativeTime(dateStr?: string): string {
  if (!dateStr) return "\u2014";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 0) {
    const absSec = Math.abs(diffSec);
    const mins = Math.floor(absSec / 60);
    if (mins < 60) return `in ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `in ${hrs}h`;
    return `in ${Math.floor(hrs / 24)}d`;
  }
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

interface FormState {
  title: string;
  description: string;
  cron_expression: string;
  query_doctype: string;
  query_filters: string;
  query_fields: string;
  query_condition: string;
  action_type: string;
  action_config: string;
  enabled: boolean;
}

const defaultForm: FormState = {
  title: "",
  description: "",
  cron_expression: "0 9 * * *",
  query_doctype: "",
  query_filters: "{}",
  query_fields: '["name"]',
  query_condition: "",
  action_type: "email",
  action_config: '{"recipients_field": "", "subject": "", "message": ""}',
  enabled: true,
};

export function SchedulerForm() {
  const { schedulerId } = useParams<{ schedulerId: string }>();
  const navigate = useNavigate();
  const isNew = !schedulerId || schedulerId === "new";
  const [editing, setEditing] = useState(isNew);
  const [form, setForm] = useState<FormState>(defaultForm);

  // Fetch existing scheduler
  const { data: schedulerData, isLoading, mutate } = useFrappeGetCall<{
    message: Scheduler;
  }>(
    "nextassist.api.scheduler.get_scheduler",
    isNew ? undefined : { scheduler_id: schedulerId }
  );

  // Fetch runs for dashboard mode
  const { data: runsData } = useFrappeGetCall<{
    message: SchedulerRun[];
  }>(
    "nextassist.api.scheduler.list_runs",
    isNew ? undefined : { scheduler_id: schedulerId, limit: 20 }
  );

  // Fetch run stats for dashboard
  const { data: statsData } = useFrappeGetCall<{
    message: RunStatsEntry[];
  }>(
    "nextassist.api.scheduler.get_run_stats",
    isNew ? undefined : { scheduler_id: schedulerId, days: 30 }
  );

  const { call: saveApi, loading: saving } = useFrappePostCall(
    "nextassist.api.scheduler.save_scheduler"
  );
  const { call: deleteApi } = useFrappePostCall(
    "nextassist.api.scheduler.delete_scheduler"
  );
  const { call: toggleApi } = useFrappePostCall(
    "nextassist.api.scheduler.toggle_scheduler"
  );

  const scheduler = schedulerData?.message;
  const runs = runsData?.message || [];
  const stats = statsData?.message || [];

  useEffect(() => {
    if (scheduler && !isNew) {
      setForm({
        title: scheduler.title || "",
        description: scheduler.description || "",
        cron_expression: scheduler.cron_expression || "0 9 * * *",
        query_doctype: scheduler.query_doctype || "",
        query_filters: JSON.stringify(scheduler.query_filters || {}, null, 2),
        query_fields: JSON.stringify(scheduler.query_fields || ["name"], null, 2),
        query_condition: scheduler.query_condition || "",
        action_type: scheduler.action_type || "email",
        action_config: JSON.stringify(scheduler.action_config || {}, null, 2),
        enabled: Boolean(scheduler.enabled),
      });
    }
  }, [scheduler, isNew]);

  const updateField = (key: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    let parsedFilters, parsedFields, parsedConfig;
    try {
      parsedFilters = JSON.parse(form.query_filters);
    } catch {
      parsedFilters = {};
    }
    try {
      parsedFields = JSON.parse(form.query_fields);
    } catch {
      parsedFields = ["name"];
    }
    try {
      parsedConfig = JSON.parse(form.action_config);
    } catch {
      parsedConfig = {};
    }

    await saveApi({
      title: form.title,
      description: form.description,
      cron_expression: form.cron_expression,
      query_doctype: form.query_doctype,
      query_filters: JSON.stringify(parsedFilters),
      query_fields: JSON.stringify(parsedFields),
      query_condition: form.query_condition,
      action_type: form.action_type,
      action_config: JSON.stringify(parsedConfig),
      ...(schedulerId ? { scheduler_id: schedulerId } : {}),
    });

    if (isNew) {
      navigate("/schedulers");
    } else {
      setEditing(false);
      await mutate();
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this scheduler and all its run history?")) return;
    await deleteApi({ scheduler_id: schedulerId });
    navigate("/schedulers");
  };

  const handleToggle = async () => {
    if (!scheduler) return;
    await toggleApi({ scheduler_id: schedulerId, enabled: !scheduler.enabled });
    await mutate();
  };

  if (!isNew && isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 border-t-gray-600 dark:border-t-gray-300 rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  // ── Dashboard mode (existing scheduler, not editing) ──
  if (!isNew && !editing && scheduler) {
    const successRate =
      scheduler.total_runs > 0
        ? Math.round((scheduler.success_runs / scheduler.total_runs) * 100)
        : 0;

    // Compute avg duration from stats
    const totalDuration = stats.reduce(
      (sum, s) => sum + (s.avg_duration_ms || 0) * s.count,
      0
    );
    const totalCount = stats.reduce((sum, s) => sum + s.count, 0);
    const avgDuration = totalCount > 0 ? Math.round(totalDuration / totalCount) : 0;

    return (
      <AppLayout>
        <div className="h-screen flex flex-col">
          {/* Header */}
          <div className="sticky top-0 z-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
            <div className="max-w-6xl mx-auto pl-14 md:pl-6 pr-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate("/schedulers")}
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  &larr; Schedulers
                </button>
                <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
                <Timer className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                <div>
                  <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    {scheduler.title}
                  </h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {cronToHuman(scheduler.cron_expression)}
                    {scheduler.description && ` \u2014 ${scheduler.description}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggle}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    scheduler.enabled
                      ? "border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                      : "border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
                  }`}
                >
                  {scheduler.enabled ? (
                    <>
                      <Pause className="w-4 h-4" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" /> Resume
                    </>
                  )}
                </button>
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <Pencil className="w-4 h-4" /> Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>

          {/* Dashboard content */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryCard
                  icon={<Activity className="w-4 h-4" />}
                  label="Total Runs"
                  value={String(scheduler.total_runs)}
                  color="text-blue-600 dark:text-blue-400"
                />
                <SummaryCard
                  icon={<CheckCircle2 className="w-4 h-4" />}
                  label="Success Rate"
                  value={`${successRate}%`}
                  color="text-green-600 dark:text-green-400"
                />
                <SummaryCard
                  icon={<XCircle className="w-4 h-4" />}
                  label="Errors"
                  value={String(scheduler.error_runs)}
                  color="text-red-600 dark:text-red-400"
                />
                <SummaryCard
                  icon={<Clock className="w-4 h-4" />}
                  label="Avg Duration"
                  value={avgDuration > 0 ? `${avgDuration}ms` : "\u2014"}
                  color="text-gray-600 dark:text-gray-400"
                />
              </div>

              {/* Config summary + Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                    Configuration
                  </h3>
                  <dl className="space-y-2 text-sm">
                    <ConfigRow label="DocType" value={scheduler.query_doctype} />
                    <ConfigRow
                      label="Filters"
                      value={JSON.stringify(scheduler.query_filters || {})}
                    />
                    {scheduler.query_condition && (
                      <ConfigRow label="Condition" value={scheduler.query_condition} />
                    )}
                    <ConfigRow label="Action" value={scheduler.action_type} />
                    <ConfigRow label="Schedule" value={cronToHuman(scheduler.cron_expression)} />
                  </dl>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                    Status
                  </h3>
                  <dl className="space-y-2 text-sm">
                    <ConfigRow
                      label="Status"
                      value={
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            scheduler.status === "Active"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : scheduler.status === "Error"
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                          }`}
                        >
                          {scheduler.status}
                        </span>
                      }
                    />
                    <ConfigRow label="Last Run" value={relativeTime(scheduler.last_run_at)} />
                    <ConfigRow
                      label="Next Run"
                      value={scheduler.enabled ? relativeTime(scheduler.next_run_at) : "Paused"}
                    />
                    <ConfigRow label="Owner" value={scheduler.user} />
                    {scheduler.last_error && (
                      <ConfigRow
                        label="Last Error"
                        value={
                          <span className="text-red-600 dark:text-red-400 break-all">
                            {scheduler.last_error}
                          </span>
                        }
                      />
                    )}
                  </dl>
                </div>
              </div>

              {/* Run history */}
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Run History
                  </h3>
                </div>
                {runs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Activity className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">No runs yet</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Runs will appear here after the scheduler executes.
                    </p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-800">
                        <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                          Status
                        </th>
                        <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                          Started
                        </th>
                        <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                          Duration
                        </th>
                        <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                          Matched
                        </th>
                        <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                          Actioned
                        </th>
                        <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                          Details
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {runs.map((run) => (
                        <RunRow key={run.name} run={run} />
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── Form mode (new or editing) ──
  return (
    <AppLayout>
      <FormView
        title={isNew ? "New Scheduler" : `Edit: ${form.title}`}
        subtitle={isNew ? "Create a recurring automated task" : "Modify scheduler configuration"}
        icon={<Timer className="w-5 h-5" />}
        backPath="/schedulers"
        backLabel="Schedulers"
        isNew={isNew}
        onSave={handleSave}
        onDelete={isNew ? undefined : handleDelete}
        saving={saving}
        meta={
          !isNew && scheduler
            ? {
                created_at: scheduler.creation,
                modified_at: scheduler.modified,
                created_by: scheduler.user,
              }
            : undefined
        }
      >
        {/* General */}
        <FormSection title="General">
          <FormField label="Title" required>
            <input
              type="text"
              value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="e.g. Stale Lead Alert"
              className={inputClass}
            />
          </FormField>
          <FormField label="Description">
            <textarea
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="What does this scheduler do?"
              rows={2}
              className={inputClass}
            />
          </FormField>
          <FormField label="Enabled">
            <button
              type="button"
              role="switch"
              aria-checked={form.enabled}
              onClick={() => updateField("enabled", !form.enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                form.enabled ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  form.enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </FormField>
        </FormSection>

        {/* Schedule */}
        <FormSection title="Schedule" description="When should this scheduler run?">
          <FormField
            label="Cron Expression"
            required
            description="Standard cron format: minute hour day-of-month month day-of-week"
          >
            <input
              type="text"
              value={form.cron_expression}
              onChange={(e) => updateField("cron_expression", e.target.value)}
              placeholder="0 9 * * *"
              className={inputClass}
            />
          </FormField>
          <div className="flex flex-wrap gap-2">
            {CRON_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => updateField("cron_expression", preset.value)}
                className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                  form.cron_expression === preset.value
                    ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                    : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </FormSection>

        {/* Query */}
        <FormSection title="Query" description="What data should this scheduler check?">
          <FormField label="DocType" required description="The ERPNext document type to query">
            <input
              type="text"
              value={form.query_doctype}
              onChange={(e) => updateField("query_doctype", e.target.value)}
              placeholder="e.g. Lead, Sales Invoice, Purchase Order"
              className={inputClass}
            />
          </FormField>
          <FormRow>
            <FormField label="Filters" description="JSON object for Frappe-style filters">
              <textarea
                value={form.query_filters}
                onChange={(e) => updateField("query_filters", e.target.value)}
                rows={3}
                className={`${inputClass} font-mono text-xs`}
                placeholder='{"status": "Open"}'
              />
            </FormField>
            <FormField label="Fields" description="JSON array of field names to fetch">
              <textarea
                value={form.query_fields}
                onChange={(e) => updateField("query_fields", e.target.value)}
                rows={3}
                className={`${inputClass} font-mono text-xs`}
                placeholder='["name", "lead_name", "modified"]'
              />
            </FormField>
          </FormRow>
          <FormField
            label="Condition"
            description="Python expression evaluated per doc. Use doc.get('field') and frappe.utils."
          >
            <textarea
              value={form.query_condition}
              onChange={(e) => updateField("query_condition", e.target.value)}
              rows={2}
              className={`${inputClass} font-mono text-xs`}
              placeholder="doc.get('modified') < str(frappe.utils.add_days(frappe.utils.today(), -10))"
            />
          </FormField>
        </FormSection>

        {/* Action */}
        <FormSection title="Action" description="What should happen when matching documents are found?">
          <FormField label="Action Type" required>
            <div className="relative">
              <select
                value={form.action_type}
                onChange={(e) => {
                  const type = e.target.value;
                  updateField("action_type", type);
                  // Set default config template
                  const templates: Record<string, string> = {
                    email: '{\n  "recipients_field": "",\n  "subject": "",\n  "message": ""\n}',
                    notification: '{\n  "user_field": "",\n  "subject": "",\n  "message": ""\n}',
                    webhook: '{\n  "url": "",\n  "method": "POST",\n  "body_template": "{}"\n}',
                    custom_code: '{\n  "code": ""\n}',
                  };
                  updateField("action_config", templates[type] || "{}");
                }}
                className={`${inputClass} appearance-none pr-8`}
              >
                <option value="email">Email</option>
                <option value="notification">Notification</option>
                <option value="webhook">Webhook</option>
                <option value="custom_code">Custom Code</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
          </FormField>
          <FormField
            label="Action Config"
            required
            description={
              form.action_type === "email"
                ? "recipients_field, subject, message (supports {{ doc.field }} Jinja)"
                : form.action_type === "notification"
                ? "user_field, subject, message (supports {{ doc.field }} Jinja)"
                : form.action_type === "webhook"
                ? "url, method, headers, body_template"
                : "code (Python code with access to docs list)"
            }
          >
            <textarea
              value={form.action_config}
              onChange={(e) => updateField("action_config", e.target.value)}
              rows={6}
              className={`${inputClass} font-mono text-xs`}
            />
          </FormField>
        </FormSection>

        {/* Cancel editing button for existing schedulers */}
        {!isNew && (
          <div className="flex justify-end">
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </FormView>
    </AppLayout>
  );
}

// ── Sub-components ──

function SummaryCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
      <div className={`flex items-center gap-2 mb-1 ${color}`}>
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {label}
        </span>
      </div>
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function ConfigRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <dt className="text-gray-500 dark:text-gray-400 shrink-0 w-24">{label}</dt>
      <dd className="text-gray-900 dark:text-gray-100 break-all">
        {typeof value === "string" ? value || "\u2014" : value}
      </dd>
    </div>
  );
}

function RunRow({ run }: { run: SchedulerRun }) {
  const [expanded, setExpanded] = useState(false);

  const statusIcon =
    run.status === "success" ? (
      <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
    ) : run.status === "error" ? (
      <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
    ) : run.status === "running" ? (
      <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
    ) : (
      <Target className="w-4 h-4 text-gray-400" />
    );

  return (
    <>
      <tr
        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {statusIcon}
            <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{run.status}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
          {relativeTime(run.started_at)}
        </td>
        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 tabular-nums">
          {run.duration_ms != null ? `${run.duration_ms}ms` : "\u2014"}
        </td>
        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 tabular-nums">
          {run.matched_count}
        </td>
        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 tabular-nums">
          {run.actioned_count}
        </td>
        <td className="px-4 py-3">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50">
            <div className="space-y-2 text-xs">
              {run.error && (
                <div>
                  <span className="font-medium text-red-600 dark:text-red-400">Error: </span>
                  <span className="text-gray-700 dark:text-gray-300">{run.error}</span>
                </div>
              )}
              {run.started_at && (
                <div>
                  <span className="font-medium text-gray-500 dark:text-gray-400">Started: </span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {new Date(run.started_at).toLocaleString()}
                  </span>
                </div>
              )}
              {run.completed_at && (
                <div>
                  <span className="font-medium text-gray-500 dark:text-gray-400">Completed: </span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {new Date(run.completed_at).toLocaleString()}
                  </span>
                </div>
              )}
              {run.result_data && (
                <div>
                  <span className="font-medium text-gray-500 dark:text-gray-400">Result: </span>
                  <pre className="mt-1 p-2 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 overflow-x-auto">
                    {JSON.stringify(run.result_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
