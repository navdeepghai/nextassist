import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";
import { useNavigate } from "react-router-dom";
import { Timer, Trash2, Play, Pause } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ListView, Column, FilterDef } from "@/components/list/ListView";
import { Scheduler } from "@/types";

const CRON_LABELS: Record<string, string> = {
  "0 9 * * *": "Daily at 9:00 AM",
  "0 9 * * 1-5": "Weekdays at 9:00 AM",
  "0 9 * * 1": "Weekly on Monday",
  "0 0 1 * *": "Monthly on the 1st",
  "0 */6 * * *": "Every 6 hours",
  "*/30 * * * *": "Every 30 minutes",
  "0 * * * *": "Every hour",
};

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
    const days = Math.floor(hrs / 24);
    return `in ${days}d`;
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

const statusColors: Record<string, string> = {
  Active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  Paused: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  Error: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  Completed: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const actionTypeColors: Record<string, string> = {
  email: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  notification: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  webhook: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  custom_code: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
};

export function SchedulerList() {
  const navigate = useNavigate();

  const { data, isLoading, mutate } = useFrappeGetCall<{
    message: Scheduler[];
  }>("nextassist.api.scheduler.list_schedulers", { limit: 200 });

  const { call: deleteApi } = useFrappePostCall(
    "nextassist.api.scheduler.delete_scheduler"
  );
  const { call: toggleApi } = useFrappePostCall(
    "nextassist.api.scheduler.toggle_scheduler"
  );

  const schedulers = data?.message || [];

  const handleDelete = async (row: Scheduler) => {
    if (!confirm(`Delete scheduler "${row.title}"?`)) return;
    await deleteApi({ scheduler_id: row.name });
    await mutate();
  };

  const handleToggle = async (row: Scheduler) => {
    await toggleApi({ scheduler_id: row.name, enabled: !row.enabled });
    await mutate();
  };

  const columns: Column<Scheduler>[] = [
    {
      key: "title",
      label: "Title",
      render: (row) => (
        <div>
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {row.title}
          </span>
          {row.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-xs">
              {row.description}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "cron_expression",
      label: "Schedule",
      render: (row) => (
        <span className="text-gray-600 dark:text-gray-400 text-xs">
          {cronToHuman(row.cron_expression)}
        </span>
      ),
    },
    {
      key: "action_type",
      label: "Action",
      render: (row) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            actionTypeColors[row.action_type] || "bg-gray-100 text-gray-600"
          }`}
        >
          {row.action_type}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            statusColors[row.status] || "bg-gray-100 text-gray-600"
          }`}
        >
          {row.status}
        </span>
      ),
    },
    {
      key: "total_runs",
      label: "Runs",
      render: (row) => (
        <div className="text-xs tabular-nums">
          <span className="text-gray-700 dark:text-gray-300">{row.total_runs}</span>
          {row.total_runs > 0 && (
            <span className="text-gray-400 dark:text-gray-500 ml-1">
              ({row.success_runs}ok / {row.error_runs}err)
            </span>
          )}
        </div>
      ),
    },
    {
      key: "last_run_at",
      label: "Last Run",
      render: (row) => (
        <span className="text-gray-500 dark:text-gray-400 text-xs">
          {relativeTime(row.last_run_at)}
        </span>
      ),
    },
    {
      key: "next_run_at",
      label: "Next Run",
      render: (row) => (
        <span className="text-gray-500 dark:text-gray-400 text-xs">
          {row.enabled ? relativeTime(row.next_run_at) : "\u2014"}
        </span>
      ),
    },
  ];

  const filters: FilterDef[] = [
    {
      key: "status",
      label: "Status",
      type: "select",
      options: [
        { value: "Active", label: "Active" },
        { value: "Paused", label: "Paused" },
        { value: "Error", label: "Error" },
        { value: "Completed", label: "Completed" },
      ],
    },
    {
      key: "action_type",
      label: "Action",
      type: "select",
      options: [
        { value: "email", label: "Email" },
        { value: "notification", label: "Notification" },
        { value: "webhook", label: "Webhook" },
        { value: "custom_code", label: "Custom Code" },
      ],
    },
  ];

  return (
    <AppLayout>
      <ListView<Scheduler>
        title="Schedulers"
        subtitle="Recurring automated tasks"
        icon={<Timer className="w-5 h-5" />}
        columns={columns}
        data={schedulers}
        loading={isLoading}
        filters={filters}
        rowKey={(row) => row.name}
        onRowClick={(row) => navigate(`/schedulers/${row.name}`)}
        createPath="/schedulers/new"
        createLabel="New Scheduler"
        emptyTitle="No schedulers yet"
        emptyMessage="Create a scheduler from chat or click 'New Scheduler' to set one up manually."
        actions={(row) => (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggle(row);
              }}
              className={`p-1.5 rounded-lg transition-colors ${
                row.enabled
                  ? "text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                  : "text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
              }`}
              title={row.enabled ? "Pause" : "Resume"}
            >
              {row.enabled ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(row);
              }}
              className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title="Delete scheduler"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      />
    </AppLayout>
  );
}
