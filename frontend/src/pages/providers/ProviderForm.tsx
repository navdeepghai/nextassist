import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";
import { toast } from "sonner";
import { Bot, Eye, EyeOff, Copy, Check, ChevronDown } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProviderUsageSidebar } from "./ProviderUsageSidebar";
import {
  FormView,
  FormSection,
  FormField,
  FormRow,
} from "@/components/form/FormView";

const PROVIDER_MODELS: Record<string, string[]> = {
  OpenAI: [
    "gpt-5.4-pro",
    "gpt-5.4",
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4.1-nano",
    "gpt-4o",
    "gpt-4o-mini",
    "o4-mini",
    "o3",
    "o3-mini",
  ],
  Anthropic: [
    "claude-opus-4-6",
    "claude-sonnet-4-6",
    "claude-haiku-4-5",
    "claude-opus-4-20250514",
    "claude-sonnet-4-20250514",
    "claude-haiku-4-5-20251001",
  ],
  Google: [
    "gemini-3.1-pro-preview",
    "gemini-3.1-flash-lite-preview",
    "gemini-3-flash-preview",
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
  ],
};

interface ProviderData {
  provider_name: string;
  provider_type: string;
  enabled: boolean;
  is_default: boolean;
  api_key: string;
  api_base_url: string;
  organization_id: string;
  default_model: string;
  max_tokens: number;
  temperature: number;
  max_context_messages: number;
  creation?: string;
  modified?: string;
  owner?: string;
}

const INPUT_CLASS =
  "w-full px-3 py-2.5 text-[15px] border border-black/10 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 dark:focus:ring-[#0A84FF]/30 focus:border-[#007AFF] dark:focus:border-[#0A84FF] bg-[var(--na-input-bg)] text-[var(--na-text)]";

export function ProviderForm() {
  const { provider_name } = useParams<{ provider_name: string }>();
  const navigate = useNavigate();
  const isNew = !provider_name || provider_name === "new";

  const [form, setForm] = useState<ProviderData>({
    provider_name: "",
    provider_type: "OpenAI",
    enabled: true,
    is_default: false,
    api_key: "",
    api_base_url: "",
    organization_id: "",
    default_model: "",
    max_tokens: 4096,
    temperature: 0.7,
    max_context_messages: 20,
  });
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useFrappeGetCall<{ message: ProviderData }>(
    "nextassist.api.provider.get_provider",
    { provider_name },
    isNew ? null : undefined  // null swrKey skips the fetch entirely when creating new
  );

  const { call: saveProvider } = useFrappePostCall(
    "nextassist.api.provider.save_provider"
  );

  const { call: deleteProvider } = useFrappePostCall(
    "nextassist.api.provider.delete_provider"
  );

  // Populate form when data loads
  useEffect(() => {
    if (data?.message && !isNew) {
      const d = data.message;
      setForm({
        provider_name: d.provider_name || "",
        provider_type: d.provider_type || "OpenAI",
        enabled: Boolean(d.enabled),
        is_default: Boolean(d.is_default),
        api_key: d.api_key || "",
        api_base_url: d.api_base_url || "",
        organization_id: d.organization_id || "",
        default_model: d.default_model || "",
        max_tokens: d.max_tokens ?? 4096,
        temperature: d.temperature ?? 0.7,
        max_context_messages: d.max_context_messages ?? 20,
        creation: d.creation,
        modified: d.modified,
        owner: d.owner,
      });
    }
  }, [data, isNew]);

  const availableModels = useMemo(
    () => PROVIDER_MODELS[form.provider_type] || [],
    [form.provider_type]
  );

  const updateField = <K extends keyof ProviderData>(
    key: K,
    value: ProviderData[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!form.provider_name.trim()) {
      toast.error("Provider name is required.");
      return;
    }
    if (!form.provider_type) {
      toast.error("Provider type is required.");
      return;
    }
    if (isNew && !form.api_key.trim()) {
      toast.error("API key is required for new providers.");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        provider_name: form.provider_name,
        provider_type: form.provider_type,
        enabled: form.enabled,
        is_default: form.is_default,
        api_base_url: form.api_base_url,
        organization_id: form.organization_id,
        default_model: form.default_model,
        max_tokens: form.max_tokens,
        temperature: form.temperature,
        max_context_messages: form.max_context_messages,
        is_new: isNew,
      };

      // Only send api_key if it was provided (not the placeholder)
      if (form.api_key.trim()) {
        payload.api_key = form.api_key;
      }

      await saveProvider(payload);
      toast.success(
        isNew ? "Provider created successfully." : "Provider saved successfully."
      );
      navigate("/providers");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to save provider.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this provider?")) {
      return;
    }

    try {
      await deleteProvider({ provider_name: form.provider_name });
      toast.success("Provider deleted.");
      navigate("/providers");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to delete provider.";
      toast.error(message);
    }
  };

  if (!isNew && isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout fullWidth>
      <FormView
        title={isNew ? "New Provider" : form.provider_name}
        subtitle={isNew ? "Configure a new AI provider" : "Edit provider settings"}
        icon={<Bot className="w-5 h-5" />}
        backPath="/providers"
        backLabel="Providers"
        isNew={isNew}
        onSave={handleSave}
        onDelete={isNew ? undefined : handleDelete}
        saving={saving}
        sidebar={
          !isNew && provider_name ? (
            <ProviderUsageSidebar providerName={provider_name} />
          ) : undefined
        }
        meta={
          !isNew
            ? {
                created_at: form.creation,
                modified_at: form.modified,
                created_by: form.owner,
              }
            : undefined
        }
      >
        {/* General Section */}
        <FormSection title="General">
          <FormRow>
            <FormField label="Provider Name" required>
              <input
                type="text"
                value={form.provider_name}
                onChange={(e) => updateField("provider_name", e.target.value)}
                disabled={!isNew}
                placeholder="e.g. my-openai-provider"
                className={`${INPUT_CLASS} ${!isNew ? "bg-[var(--na-input-bg)] text-[#AEAEB2] cursor-not-allowed" : ""}`}
              />
            </FormField>
            <FormField label="Provider Type" required>
              <div className="relative">
                <select
                  value={form.provider_type}
                  onChange={(e) => {
                    updateField("provider_type", e.target.value);
                    // Reset default_model when provider type changes
                    updateField("default_model", "");
                  }}
                  className={`${INPUT_CLASS} appearance-none pr-8`}
                >
                  <option value="OpenAI">OpenAI</option>
                  <option value="Anthropic">Anthropic</option>
                  <option value="Google">Google</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>
            </FormField>
          </FormRow>
        </FormSection>

        {/* Status Section */}
        <FormSection title="Status">
          <FormRow>
            <FormField label="Enabled">
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.enabled}
                  onClick={() => updateField("enabled", !form.enabled)}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:ring-offset-1 ${
                    form.enabled ? "bg-[#007AFF] dark:bg-[#0A84FF]" : "bg-[#E5E5EA] dark:bg-[#39393D]"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                      form.enabled ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {form.enabled ? "Active" : "Inactive"}
                </span>
              </div>
            </FormField>
            <FormField label="Default Provider">
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.is_default}
                  onClick={() => updateField("is_default", !form.is_default)}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:ring-offset-1 ${
                    form.is_default ? "bg-[#007AFF] dark:bg-[#0A84FF]" : "bg-[#E5E5EA] dark:bg-[#39393D]"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                      form.is_default ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {form.is_default ? "Yes" : "No"}
                </span>
              </div>
            </FormField>
          </FormRow>
        </FormSection>

        {/* Credentials Section */}
        <FormSection title="Credentials">
          <FormField
            label="API Key"
            required={isNew}
            description={
              isNew
                ? "Your provider API key. This will be stored securely."
                : "Leave blank to keep existing key unchanged."
            }
          >
            <div className="relative flex items-center">
              <input
                type={showApiKey ? "text" : "password"}
                value={form.api_key}
                onChange={(e) => updateField("api_key", e.target.value)}
                placeholder={isNew ? "sk-..." : "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"}
                className={`${INPUT_CLASS} pr-20`}
              />
              <div className="absolute right-1.5 flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setShowApiKey((prev) => !prev)}
                  className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title={showApiKey ? "Hide API key" : "Show API key"}
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                {form.api_key && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(form.api_key);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="Copy API key"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>
          </FormField>
          <FormRow>
            <FormField
              label="API Base URL"
              description="Override the default API endpoint (optional)."
            >
              <input
                type="text"
                value={form.api_base_url}
                onChange={(e) => updateField("api_base_url", e.target.value)}
                placeholder="https://api.openai.com/v1"
                className={INPUT_CLASS}
              />
            </FormField>
            <FormField
              label="Organization ID"
              description="Required for some OpenAI accounts."
            >
              <input
                type="text"
                value={form.organization_id}
                onChange={(e) => updateField("organization_id", e.target.value)}
                placeholder="org-..."
                className={INPUT_CLASS}
              />
            </FormField>
          </FormRow>
        </FormSection>

        {/* Model Configuration Section */}
        <FormSection title="Model Configuration">
          <FormField label="Default Model">
            <div className="relative">
              <select
                value={form.default_model}
                onChange={(e) => updateField("default_model", e.target.value)}
                className={`${INPUT_CLASS} appearance-none pr-8`}
              >
                <option value="">Select a model...</option>
                {availableModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
          </FormField>
          <FormRow>
            <FormField label="Max Tokens">
              <input
                type="number"
                value={form.max_tokens}
                onChange={(e) =>
                  updateField("max_tokens", parseInt(e.target.value, 10) || 0)
                }
                min={1}
                className={INPUT_CLASS}
              />
            </FormField>
            <FormField label="Temperature">
              <input
                type="number"
                value={form.temperature}
                onChange={(e) =>
                  updateField(
                    "temperature",
                    parseFloat(e.target.value) || 0
                  )
                }
                min={0}
                max={2}
                step={0.1}
                className={INPUT_CLASS}
              />
            </FormField>
          </FormRow>
          <FormField
            label="Max Context Messages"
            description="Maximum number of previous messages sent as context."
          >
            <input
              type="number"
              value={form.max_context_messages}
              onChange={(e) =>
                updateField(
                  "max_context_messages",
                  parseInt(e.target.value, 10) || 0
                )
              }
              min={1}
              className={INPUT_CLASS}
            />
          </FormField>
        </FormSection>
      </FormView>
    </AppLayout>
  );
}
