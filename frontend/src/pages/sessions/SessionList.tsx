import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";
import { useNavigate } from "react-router-dom";
import { History, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ListView, Column, FilterDef } from "@/components/list/ListView";
import { Session } from "@/types";

function formatTokens(n?: number): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function relativeTime(dateStr?: string): string {
  if (!dateStr) return "—";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);
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
  "Limit Reached": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  Archived: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export function SessionList() {
  const navigate = useNavigate();

  const { data, isLoading, mutate } = useFrappeGetCall<{
    message: Session[];
  }>("nextassist.api.session.list_sessions", { limit: 200 });

  const { call: deleteSessionApi } = useFrappePostCall(
    "nextassist.api.session.delete_session"
  );

  const sessions = data?.message || [];

  const handleDelete = async (row: Session) => {
    if (!confirm(`Delete session "${row.title}"?`)) return;
    await deleteSessionApi({ session_id: row.name });
    await mutate();
  };

  const handleBulkDelete = async (rows: Session[]) => {
    for (const row of rows) {
      await deleteSessionApi({ session_id: row.name });
    }
    await mutate();
  };

  const columns: Column<Session>[] = [
    {
      key: "title",
      label: "Title",
      render: (row) => (
        <span className="font-semibold text-gray-900 dark:text-gray-100">{row.title || "Untitled"}</span>
      ),
    },
    {
      key: "user",
      label: "User",
      render: (row) => <span className="text-gray-600 dark:text-gray-400">{row.user}</span>,
    },
    {
      key: "status",
      label: "Status",
      render: (row) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            statusColors[row.status] || "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
          }`}
        >
          {row.status}
        </span>
      ),
    },
    {
      key: "provider",
      label: "Provider",
      render: (row) => <span className="text-gray-600 dark:text-gray-400">{row.provider || "—"}</span>,
    },
    {
      key: "model",
      label: "Model",
      render: (row) => <span className="text-gray-600 dark:text-gray-400">{row.model || "—"}</span>,
    },
    {
      key: "total_tokens",
      label: "Total Tokens",
      render: (row) => (
        <span className="text-gray-600 dark:text-gray-400 tabular-nums">{formatTokens(row.total_tokens)}</span>
      ),
    },
    {
      key: "last_message_at",
      label: "Last Message",
      render: (row) => (
        <span className="text-gray-500 dark:text-gray-400 text-xs">{relativeTime(row.last_message_at)}</span>
      ),
    },
    {
      key: "creation",
      label: "Created",
      render: (row) => (
        <span className="text-gray-500 dark:text-gray-400 text-xs">
          {new Date(row.creation).toLocaleDateString()}
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
        { value: "Limit Reached", label: "Limit Reached" },
        { value: "Archived", label: "Archived" },
      ],
    },
  ];

  return (
    <AppLayout>
      <ListView<Session>
        title="Sessions"
        subtitle="Chat session history"
        icon={<History className="w-5 h-5" />}
        columns={columns}
        data={sessions}
        loading={isLoading}
        filters={filters}
        rowKey={(row) => row.name}
        onRowClick={(row) => navigate(`/sessions/${row.name}`)}
        onBulkDelete={handleBulkDelete}
        emptyTitle="No sessions yet"
        emptyMessage="Sessions are created when you start a new chat."
        actions={(row) => (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(row);
            }}
            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Delete session"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      />
    </AppLayout>
  );
}
