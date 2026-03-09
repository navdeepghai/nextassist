import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Trash2, Clock, User } from "lucide-react";

interface FormViewProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  backPath: string;
  backLabel?: string;
  isNew?: boolean;
  onSave?: () => void;
  onDelete?: () => void;
  saving?: boolean;
  children: ReactNode;
  sidebar?: ReactNode;
  /** Metadata for the sidebar timeline */
  meta?: {
    created_at?: string;
    modified_at?: string;
    created_by?: string;
  };
}

export function FormView({
  title,
  subtitle,
  icon,
  backPath,
  backLabel,
  isNew,
  onSave,
  onDelete,
  saving,
  children,
  sidebar,
  meta,
}: FormViewProps) {
  const navigate = useNavigate();

  return (
    <div className="h-screen flex flex-col">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-6xl mx-auto pl-14 md:pl-6 pr-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(backPath)}
              className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {backLabel || "Back"}
            </button>
            <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
            {icon && <div className="text-gray-400 dark:text-gray-500">{icon}</div>}
            <div>
              <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h1>
              {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onDelete && !isNew && (
              <button
                onClick={onDelete}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
            {onSave && (
              <button
                onClick={onSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-gray-300 disabled:opacity-50 transition-colors"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {isNew ? "Create" : "Save"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content: 3-column layout with sidebar */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Main form area */}
            <div className="flex-1 min-w-0 space-y-5">{children}</div>

            {/* Right sidebar */}
            <div className="w-full md:w-72 md:shrink-0 space-y-5">
              {sidebar}
              {meta && <FormTimeline meta={meta} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Floating card section for forms */
export function FormSection({
  title,
  description,
  children,
  collapsible,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  collapsible?: boolean;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      {title && (
        <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</h3>
          {description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>}
        </div>
      )}
      <div className="px-5 py-4 space-y-4">{children}</div>
    </div>
  );
}

/** Form field wrapper */
export function FormField({
  label,
  required,
  description,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  description?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
        {required && <span className="text-red-500 dark:text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {description && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{description}</p>}
      {error && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{error}</p>}
    </div>
  );
}

/** Two-column row inside a form section */
export function FormRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>;
}

/** Sidebar timeline showing create/modify dates */
function FormTimeline({ meta }: { meta: { created_at?: string; modified_at?: string; created_by?: string } }) {
  const formatDate = (d?: string) => {
    if (!d) return "\u2014";
    return new Date(d).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Activity</h3>
      </div>
      <div className="px-4 py-3 space-y-3">
        {meta.modified_at && (
          <div className="flex items-start gap-2.5">
            <Clock className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Last Modified</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(meta.modified_at)}</p>
            </div>
          </div>
        )}
        {meta.created_at && (
          <div className="flex items-start gap-2.5">
            <Clock className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Created</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(meta.created_at)}</p>
            </div>
          </div>
        )}
        {meta.created_by && (
          <div className="flex items-start gap-2.5">
            <User className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Created By</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{meta.created_by}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
