import { useFrappeGetCall } from "frappe-react-sdk";
import { useNavigate } from "react-router-dom";
import { Bot, Star, Check, X } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ListView, Column, FilterDef } from "@/components/list/ListView";

interface Provider {
  provider_name: string;
  provider_type: string;
  enabled: boolean;
  is_default: boolean;
  default_model: string;
  creation?: string;
}

const PROVIDER_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  OpenAI: { bg: "bg-blue-50 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400" },
  Anthropic: { bg: "bg-orange-50 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-400" },
  Google: { bg: "bg-green-50 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400" },
};

const columns: Column<Provider>[] = [
  {
    key: "provider_name",
    label: "Provider Name",
    sortable: true,
    render: (row) => (
      <span className="font-semibold text-gray-900 dark:text-gray-100">{row.provider_name}</span>
    ),
  },
  {
    key: "provider_type",
    label: "Provider Type",
    sortable: true,
    render: (row) => {
      const colors = PROVIDER_TYPE_COLORS[row.provider_type] || {
        bg: "bg-gray-50 dark:bg-gray-800",
        text: "text-gray-700 dark:text-gray-400",
      };
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}
        >
          {row.provider_type}
        </span>
      );
    },
  },
  {
    key: "enabled",
    label: "Enabled",
    sortable: true,
    width: "100px",
    render: (row) =>
      row.enabled ? (
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <Check className="w-3.5 h-3.5 text-green-600" />
        </span>
      ) : (
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          <X className="w-3.5 h-3.5 text-red-400" />
        </span>
      ),
  },
  {
    key: "is_default",
    label: "Default",
    sortable: true,
    width: "90px",
    render: (row) =>
      row.is_default ? (
        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
      ) : (
        <Star className="w-4 h-4 text-gray-300 dark:text-gray-600" />
      ),
  },
  {
    key: "default_model",
    label: "Default Model",
    sortable: true,
    render: (row) => (
      <span className="text-gray-600 dark:text-gray-400">{row.default_model || "—"}</span>
    ),
  },
  {
    key: "creation",
    label: "Created",
    sortable: true,
    width: "160px",
    render: (row) => {
      if (!row.creation) return "—";
      return (
        <span className="text-gray-500 dark:text-gray-400 text-xs">
          {new Date(row.creation).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      );
    },
  },
];

const filters: FilterDef[] = [
  {
    key: "provider_type",
    label: "Provider Type",
    type: "select",
    options: [
      { value: "OpenAI", label: "OpenAI" },
      { value: "Anthropic", label: "Anthropic" },
      { value: "Google", label: "Google" },
    ],
  },
  {
    key: "enabled",
    label: "Enabled",
    type: "select",
    options: [
      { value: "true", label: "Yes" },
      { value: "false", label: "No" },
    ],
  },
];

export function ProviderList() {
  const navigate = useNavigate();

  const { data, isLoading } = useFrappeGetCall<{ message: Provider[] }>(
    "nextassist.api.provider.list_providers"
  );

  const providers = data?.message ?? [];

  // Normalize enabled to string for filter matching
  const normalizedProviders = providers.map((p) => ({
    ...p,
    enabled: Boolean(p.enabled),
  }));

  return (
    <AppLayout>
      <ListView<Provider>
        title="AI Providers"
        subtitle="Manage your AI provider integrations"
        icon={<Bot className="w-5 h-5" />}
        columns={columns}
        data={normalizedProviders}
        loading={isLoading}
        filters={filters}
        rowKey={(row) => row.provider_name}
        onRowClick={(row) => navigate(`/providers/${row.provider_name}`)}
        createPath="/providers/new"
        createLabel="New Provider"
        emptyTitle="No providers configured"
        emptyMessage="Add an AI provider to get started with NextAssist."
      />
    </AppLayout>
  );
}
