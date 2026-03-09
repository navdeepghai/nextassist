import { useState, useEffect } from "react";
import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";
import { Settings, Save } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { FormSection, FormField, FormRow } from "@/components/form/FormView";

interface SettingsData {
  default_provider: string;
  provider_type: string;
  default_model: string;
  max_tokens: number;
  temperature: number;
  max_context_messages: number;
  enable_tool_calling: boolean;
  enable_file_uploads: boolean;
}

interface Provider {
  provider_name: string;
  provider_type: string;
}

const inputClass =
  "w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 dark:text-gray-100";

const readOnlyClass =
  "w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed";

export function SettingsForm() {
  const [form, setForm] = useState<SettingsData>({
    default_provider: "",
    provider_type: "",
    default_model: "",
    max_tokens: 0,
    temperature: 0,
    max_context_messages: 0,
    enable_tool_calling: false,
    enable_file_uploads: false,
  });

  const { data: settingsData, isLoading: loadingSettings } = useFrappeGetCall<{
    message: SettingsData;
  }>("nextassist.api.settings.get_settings");

  const { data: providerData, isLoading: loadingProviders } =
    useFrappeGetCall<{ message: Provider[] }>(
      "nextassist.api.provider.list_providers"
    );

  const { call: saveSettings, loading: saving } = useFrappePostCall(
    "nextassist.api.settings.save_settings"
  );

  const providers = providerData?.message ?? [];

  useEffect(() => {
    if (settingsData?.message) {
      const s = settingsData.message;
      setForm({
        default_provider: s.default_provider || "",
        provider_type: s.provider_type || "",
        default_model: s.default_model || "",
        max_tokens: s.max_tokens ?? 0,
        temperature: s.temperature ?? 0,
        max_context_messages: s.max_context_messages ?? 0,
        enable_tool_calling: Boolean(s.enable_tool_calling),
        enable_file_uploads: Boolean(s.enable_file_uploads),
      });
    }
  }, [settingsData]);

  const handleSave = async () => {
    try {
      await saveSettings({
        default_provider: form.default_provider,
        enable_tool_calling: form.enable_tool_calling,
        enable_file_uploads: form.enable_file_uploads,
      });
      toast.success("Settings saved successfully");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to save settings";
      toast.error(message);
    }
  };

  const isLoading = loadingSettings || loadingProviders;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 border-t-gray-600 dark:border-t-gray-300 rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="h-screen flex flex-col">
        {/* Sticky Header */}
        <div className="sticky top-0 z-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-6xl mx-auto pl-14 md:pl-6 pr-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-gray-400 dark:text-gray-500">
                <Settings className="w-5 h-5" />
              </div>
              <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Settings
              </h1>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-gray-300 disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">
            {/* AI Provider */}
            <FormSection title="AI Provider">
              <FormField label="Default Provider">
                <select
                  value={form.default_provider}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      default_provider: e.target.value,
                    }))
                  }
                  className={inputClass}
                >
                  <option value="">Select a provider</option>
                  {providers.map((p) => (
                    <option key={p.provider_name} value={p.provider_name}>
                      {p.provider_name}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormRow>
                <FormField label="Provider Type">
                  <input
                    type="text"
                    value={form.provider_type}
                    readOnly
                    className={readOnlyClass}
                  />
                </FormField>
                <FormField label="Default Model">
                  <input
                    type="text"
                    value={form.default_model}
                    readOnly
                    className={readOnlyClass}
                  />
                </FormField>
              </FormRow>

              <FormRow>
                <FormField label="Max Tokens">
                  <input
                    type="number"
                    value={form.max_tokens}
                    readOnly
                    className={readOnlyClass}
                  />
                </FormField>
                <FormField label="Temperature">
                  <input
                    type="text"
                    value={form.temperature}
                    readOnly
                    className={readOnlyClass}
                  />
                </FormField>
              </FormRow>

              <FormField label="Max Context Messages">
                <input
                  type="number"
                  value={form.max_context_messages}
                  readOnly
                  className={readOnlyClass}
                />
              </FormField>
            </FormSection>

            {/* Features */}
            <FormSection title="Features">
              <FormField label="Enable Tool Calling">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.enable_tool_calling}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      enable_tool_calling: !prev.enable_tool_calling,
                    }))
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    form.enable_tool_calling ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      form.enable_tool_calling
                        ? "translate-x-6"
                        : "translate-x-1"
                    }`}
                  />
                </button>
              </FormField>

              <FormField label="Enable File Uploads">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.enable_file_uploads}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      enable_file_uploads: !prev.enable_file_uploads,
                    }))
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    form.enable_file_uploads ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      form.enable_file_uploads
                        ? "translate-x-6"
                        : "translate-x-1"
                    }`}
                  />
                </button>
              </FormField>
            </FormSection>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
