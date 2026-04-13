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
  saveDisabled?: boolean;
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
  saveDisabled,
  children,
  sidebar,
  meta,
}: FormViewProps) {
  const navigate = useNavigate();

  return (
    <div className="h-screen flex flex-col">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl border-b border-black/5 dark:border-white/5">
        <div className="max-w-6xl mx-auto pl-14 md:pl-6 pr-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(backPath)}
              className="flex items-center gap-1 text-[15px] text-[#86868B] hover:text-[var(--na-text)] transition-colors duration-200 ease-out"
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
              {backLabel || "Back"}
            </button>
            <div className="w-px h-5 bg-black/10 dark:bg-white/10" />
            {icon && <div className="text-[#86868B]">{icon}</div>}
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-[var(--na-text)]">{title}</h1>
              {subtitle && <p className="text-[13px] text-[#86868B]">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onDelete && !isNew && (
              <button
                onClick={onDelete}
                className="flex items-center gap-1.5 px-4 py-2 text-[15px] text-[#FF3B30] dark:text-[#FF453A] bg-[#FF3B30]/10 dark:bg-[#FF453A]/10 hover:bg-[#FF3B30]/20 dark:hover:bg-[#FF453A]/20 rounded-xl transition-colors duration-200 ease-out"
              >
                <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                Delete
              </button>
            )}
            {onSave && (
              <button
                onClick={onSave}
                disabled={saving || saveDisabled}
                className="flex items-center gap-1.5 px-5 py-2 bg-[#007AFF] dark:bg-[#0A84FF] text-white text-[15px] font-medium rounded-xl hover:bg-[#0071E3] dark:hover:bg-[#409CFF] disabled:opacity-50 transition-colors duration-200 ease-out"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" strokeWidth={1.5} />
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
    <div className="bg-[var(--na-card)] rounded-2xl border border-black/[0.04] dark:border-white/[0.06] shadow-sm dark:shadow-none overflow-hidden">
      {title && (
        <div className="px-5 py-3.5 border-b border-black/[0.04] dark:border-white/[0.05]">
          <h3 className="text-[15px] font-medium text-[var(--na-text)]">{title}</h3>
          {description && <p className="text-[13px] text-[#86868B] mt-0.5">{description}</p>}
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
      <label className="block text-[13px] font-medium text-[#86868B] mb-1.5">
        {label}
        {required && <span className="text-[#FF3B30] dark:text-[#FF453A] ml-0.5">*</span>}
      </label>
      {children}
      {description && <p className="text-[13px] text-[#AEAEB2] mt-1">{description}</p>}
      {error && <p className="text-[13px] text-[#FF3B30] dark:text-[#FF453A] mt-1">{error}</p>}
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
    <div className="bg-[var(--na-card)] rounded-2xl border border-black/[0.04] dark:border-white/[0.06] shadow-sm dark:shadow-none overflow-hidden">
      <div className="px-5 py-3.5 border-b border-black/[0.04] dark:border-white/[0.05]">
        <h3 className="text-[15px] font-medium text-[var(--na-text)]">Activity</h3>
      </div>
      <div className="px-5 py-4 space-y-3">
        {meta.modified_at && (
          <div className="flex items-start gap-2.5">
            <Clock className="w-4 h-4 text-[#AEAEB2] mt-0.5 shrink-0" strokeWidth={1.5} />
            <div>
              <p className="text-[13px] font-medium text-[var(--na-text)]">Last Modified</p>
              <p className="text-[13px] text-[#86868B]">{formatDate(meta.modified_at)}</p>
            </div>
          </div>
        )}
        {meta.created_at && (
          <div className="flex items-start gap-2.5">
            <Clock className="w-4 h-4 text-[#AEAEB2] mt-0.5 shrink-0" strokeWidth={1.5} />
            <div>
              <p className="text-[13px] font-medium text-[var(--na-text)]">Created</p>
              <p className="text-[13px] text-[#86868B]">{formatDate(meta.created_at)}</p>
            </div>
          </div>
        )}
        {meta.created_by && (
          <div className="flex items-start gap-2.5">
            <User className="w-4 h-4 text-[#AEAEB2] mt-0.5 shrink-0" strokeWidth={1.5} />
            <div>
              <p className="text-[13px] font-medium text-[var(--na-text)]">Created By</p>
              <p className="text-[13px] text-[#86868B]">{meta.created_by}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
