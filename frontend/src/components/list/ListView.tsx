import { useState, useMemo, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Filter, ChevronDown, X, Trash2 } from "lucide-react";

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  width?: string;
}

export interface FilterDef {
  key: string;
  label: string;
  type: "select" | "text";
  options?: { value: string; label: string }[];
}

interface ListViewProps<T> {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  filters?: FilterDef[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  createPath?: string;
  createLabel?: string;
  onDelete?: (row: T) => void;
  onBulkDelete?: (rows: T[]) => Promise<void>;
  emptyTitle?: string;
  emptyMessage?: string;
  actions?: (row: T) => ReactNode;
}

export function ListView<T>({
  title,
  subtitle,
  icon,
  columns,
  data,
  loading,
  filters: filterDefs,
  rowKey,
  onRowClick,
  createPath,
  createLabel,
  onDelete,
  onBulkDelete,
  emptyTitle,
  emptyMessage,
  actions,
}: ListViewProps<T>) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const filtered = useMemo(() => {
    let result = [...data];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((row) =>
        Object.values(row as Record<string, unknown>).some(
          (v) => typeof v === "string" && v.toLowerCase().includes(q)
        )
      );
    }

    for (const [key, val] of Object.entries(activeFilters)) {
      if (!val) continue;
      result = result.filter((row) => {
        const rv = (row as Record<string, unknown>)[key];
        return String(rv) === val;
      });
    }

    if (sortKey) {
      result.sort((a, b) => {
        const av = (a as Record<string, unknown>)[sortKey] ?? "";
        const bv = (b as Record<string, unknown>)[sortKey] ?? "";
        const cmp = String(av).localeCompare(String(bv));
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [data, search, activeFilters, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length;

  // Bulk select helpers
  const filteredKeys = useMemo(() => filtered.map(rowKey), [filtered, rowKey]);
  const allSelected = filteredKeys.length > 0 && filteredKeys.every((k) => selectedKeys.has(k));
  const someSelected = filteredKeys.some((k) => selectedKeys.has(k));
  const selectedRows = filtered.filter((row) => selectedKeys.has(rowKey(row)));

  const toggleRow = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        filteredKeys.forEach((k) => next.delete(k));
        return next;
      });
    } else {
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        filteredKeys.forEach((k) => next.add(k));
        return next;
      });
    }
  };

  const handleBulkDelete = async () => {
    if (!onBulkDelete || selectedRows.length === 0) return;
    if (!confirm(`Delete ${selectedRows.length} selected item${selectedRows.length > 1 ? "s" : ""}?`)) return;
    setBulkDeleting(true);
    try {
      await onBulkDelete(selectedRows);
      setSelectedKeys(new Set());
    } finally {
      setBulkDeleting(false);
    }
  };

  const isFiltered = search || activeFilterCount > 0;

  return (
    <div className="max-w-6xl mx-auto pl-14 md:pl-6 pr-6 py-6">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          {icon && <div className="text-[#86868B]">{icon}</div>}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--na-text)]">
              {title}
              {!loading && (
                <span className="ml-2 text-lg font-normal text-[#AEAEB2]">
                  ({data.length})
                </span>
              )}
            </h1>
            {subtitle && <p className="text-[15px] text-[#86868B] mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {createPath && (
          <button
            onClick={() => navigate(createPath)}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-[#007AFF] dark:bg-[#0A84FF] text-white text-[15px] font-medium rounded-xl hover:bg-[#0071E3] dark:hover:bg-[#409CFF] transition-colors duration-200 ease-out"
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            {createLabel || "New"}
          </button>
        )}
      </div>

      {/* Search & Filters Bar */}
      <div className="bg-[var(--na-card)] rounded-2xl border border-black/[0.04] dark:border-white/[0.06] shadow-sm dark:shadow-none mb-4">
        <div className="flex items-center gap-3 px-5 py-3.5">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AEAEB2]" strokeWidth={1.5} />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 text-[15px] bg-[var(--na-input-bg)] border border-black/10 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 dark:focus:ring-[#0A84FF]/30 focus:border-[#007AFF] dark:focus:border-[#0A84FF] text-[var(--na-text)] placeholder:text-[#AEAEB2] transition-all duration-200 ease-out"
            />
          </div>
          {filterDefs && filterDefs.length > 0 && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[15px] rounded-xl border transition-colors duration-200 ease-out ${
                activeFilterCount > 0
                  ? "border-[#007AFF]/20 dark:border-[#0A84FF]/20 bg-[#007AFF]/8 dark:bg-[#0A84FF]/12 text-[#007AFF] dark:text-[#0A84FF]"
                  : "border-black/10 dark:border-white/10 text-[#86868B] hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
              }`}
            >
              <Filter className="w-4 h-4" strokeWidth={1.5} />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-1 w-5 h-5 rounded-full bg-[#007AFF] dark:bg-[#0A84FF] text-white text-[11px] flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          )}
          <span className="text-[13px] text-[#AEAEB2] whitespace-nowrap">
            {isFiltered && filtered.length !== data.length
              ? `${filtered.length} of ${data.length}`
              : `${filtered.length}`}{" "}
            {filtered.length === 1 ? "record" : "records"}
          </span>
        </div>

        {/* Filter row */}
        {showFilters && filterDefs && (
          <div className="px-5 pb-3.5 flex items-center gap-3 flex-wrap border-t border-black/[0.04] dark:border-white/[0.05] pt-3.5">
            {filterDefs.map((f) => (
              <div key={f.key} className="flex items-center gap-1.5">
                <label className="text-[13px] text-[#86868B]">{f.label}</label>
                {f.type === "select" ? (
                  <div className="relative">
                    <select
                      value={activeFilters[f.key] || ""}
                      onChange={(e) =>
                        setActiveFilters((prev) => ({ ...prev, [f.key]: e.target.value }))
                      }
                      className="appearance-none text-[15px] border border-black/10 dark:border-white/10 rounded-xl pl-3 pr-8 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 dark:focus:ring-[#0A84FF]/30 bg-[var(--na-input-bg)] text-[var(--na-text)]"
                    >
                      <option value="">All</option>
                      {f.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#AEAEB2]" />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={activeFilters[f.key] || ""}
                    onChange={(e) =>
                      setActiveFilters((prev) => ({ ...prev, [f.key]: e.target.value }))
                    }
                    className="text-[15px] border border-black/10 dark:border-white/10 rounded-xl px-3 py-1.5 w-32 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 dark:focus:ring-[#0A84FF]/30 bg-[var(--na-input-bg)] text-[var(--na-text)]"
                    placeholder={`Filter ${f.label.toLowerCase()}...`}
                  />
                )}
              </div>
            ))}
            {activeFilterCount > 0 && (
              <button
                onClick={() => setActiveFilters({})}
                className="text-[13px] text-[#86868B] hover:text-[var(--na-text)] flex items-center gap-1 transition-colors duration-200 ease-out"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bulk Action Bar */}
      {onBulkDelete && someSelected && (
        <div className="mb-3 flex items-center justify-between px-5 py-3 bg-[#007AFF]/8 dark:bg-[#0A84FF]/12 border border-[#007AFF]/20 dark:border-[#0A84FF]/20 rounded-2xl">
          <span className="text-[15px] text-[#007AFF] dark:text-[#0A84FF] font-medium">
            {selectedRows.length} item{selectedRows.length > 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedKeys(new Set())}
              className="text-[13px] text-[#007AFF] dark:text-[#0A84FF] hover:underline"
            >
              Clear selection
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="flex items-center gap-1.5 px-4 py-2 text-[15px] text-white bg-[#FF3B30] dark:bg-[#FF453A] hover:bg-[#FF3B30]/90 dark:hover:bg-[#FF453A]/90 disabled:opacity-50 rounded-xl transition-colors duration-200 ease-out"
            >
              {bulkDeleting ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              Delete selected
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-[var(--na-card)] rounded-2xl border border-black/[0.04] dark:border-white/[0.06] shadow-sm dark:shadow-none overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-[#007AFF]/30 dark:border-[#0A84FF]/30 border-t-[#007AFF] dark:border-t-[#0A84FF] rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E] flex items-center justify-center mb-3">
              {icon || <Search className="w-5 h-5 text-[#AEAEB2]" />}
            </div>
            <p className="text-[15px] font-medium text-[var(--na-text)]">
              {emptyTitle || "No records found"}
            </p>
            <p className="text-[13px] text-[#86868B] mt-1">
              {emptyMessage || "Try adjusting your search or filters."}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-black/[0.04] dark:border-white/[0.05]">
                {onBulkDelete && (
                  <th className="w-10 px-5 py-3.5">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                      onChange={toggleAll}
                      className="w-4 h-4 rounded border-black/20 dark:border-white/20 text-[#007AFF] dark:text-[#0A84FF] focus:ring-[#007AFF]/30 dark:focus:ring-[#0A84FF]/30 cursor-pointer"
                    />
                  </th>
                )}
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`text-left text-[13px] font-medium text-[#86868B] px-5 py-3.5 ${
                      col.sortable !== false ? "cursor-pointer hover:text-[var(--na-text)] select-none" : ""
                    }`}
                    style={col.width ? { width: col.width } : undefined}
                    onClick={() => col.sortable !== false && handleSort(col.key)}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key && (
                        <ChevronDown
                          className={`w-3 h-3 transition-transform ${
                            sortDir === "desc" ? "rotate-180" : ""
                          }`}
                        />
                      )}
                    </span>
                  </th>
                ))}
                {(actions || onDelete) && (
                  <th className="w-20 px-5 py-3.5" />
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const key = rowKey(row);
                const isSelected = selectedKeys.has(key);
                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick?.(row)}
                    className={`group transition-colors duration-200 ease-out border-b border-black/[0.04] dark:border-white/[0.05] last:border-b-0 ${
                      isSelected
                        ? "bg-[#007AFF]/5 dark:bg-[#0A84FF]/8"
                        : onRowClick
                        ? "cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                        : ""
                    }`}
                  >
                    {onBulkDelete && (
                      <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(key)}
                          className="w-4 h-4 rounded border-black/20 dark:border-white/20 text-[#007AFF] dark:text-[#0A84FF] focus:ring-[#007AFF]/30 dark:focus:ring-[#0A84FF]/30 cursor-pointer"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={col.key} className="px-5 py-3.5 text-[15px] text-[var(--na-text)]">
                        {col.render
                          ? col.render(row)
                          : String((row as Record<string, unknown>)[col.key] ?? "")}
                      </td>
                    ))}
                    {(actions || onDelete) && (
                      <td className="px-5 py-3.5 text-right">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-out">
                          {actions?.(row)}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
