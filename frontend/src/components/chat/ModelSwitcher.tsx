import { useState, useRef, useEffect, useCallback } from "react";
import { useAvailableModels } from "@/hooks/useAvailableModels";

interface ModelSwitcherProps {
  currentModel?: string;
  onModelChange: (model: string) => void;
  disabled?: boolean;
}

export function ModelSwitcher({
  currentModel,
  onModelChange,
  disabled,
}: ModelSwitcherProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { providerModels } = useAvailableModels();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const handleSelect = useCallback(
    (model: string) => {
      if (model === currentModel) {
        setOpen(false);
        return;
      }
      onModelChange(model);
      setOpen(false);
    },
    [currentModel, onModelChange]
  );

  const displayModel = currentModel || "Select model";

  return (
    <div ref={containerRef} className="relative mb-2">
      {/* Trigger pill */}
      <button
        type="button"
        onClick={() => !disabled && setOpen((prev) => !prev)}
        disabled={disabled}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
          disabled
            ? "bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed"
            : open
              ? "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
        }`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
        <span className="truncate max-w-[180px]">{displayModel}</span>
        {/* Chevron */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Dropdown — opens upward */}
      {open && (
        <div className="absolute bottom-full left-0 mb-1 z-50 w-64 max-h-72 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg">
          {providerModels.length === 0 ? (
            <div className="px-3 py-4 text-xs text-gray-400 dark:text-gray-500 text-center">
              No providers configured
            </div>
          ) : (
            providerModels.map((provider) => (
              <div key={provider.provider_name}>
                {/* Provider group header */}
                <div className="sticky top-0 bg-gray-50 dark:bg-gray-950 px-3 py-1.5 text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold border-b border-gray-100 dark:border-gray-800">
                  {provider.provider_type}
                </div>
                {/* Model items */}
                {provider.models.map((model) => {
                  const isActive = model === currentModel;
                  return (
                    <button
                      key={model}
                      type="button"
                      onClick={() => handleSelect(model)}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between gap-2 ${
                        isActive
                          ? "text-blue-600 font-medium bg-blue-50 dark:bg-blue-900/20"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    >
                      <span className="truncate">{model}</span>
                      {isActive && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="shrink-0 text-blue-600"
                        >
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
