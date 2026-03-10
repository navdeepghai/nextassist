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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {icon && <div className="text-gray-400 dark:text-gray-500">{icon}</div>}
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {title}
              {!loading && (
                <span className="ml-2 text-base font-normal text-gray-400 dark:text-gray-500">
                  ({data.length})
                </span>
              )}
            </h1>
            {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {createPath && (
          <button
            onClick={() => navigate(createPath)}
            className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-gray-300 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {createLabel || "New"}
          </button>
        )}
      </div>

      {/* Search & Filters Bar */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-gray-100"
            />
          </div>
          {filterDefs && filterDefs.length > 0 && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors ${
                activeFilterCount > 0
                  ? "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                  : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-1 w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          )}
          <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
            {isFiltered && filtered.length !== data.length
              ? `${filtered.length} of ${data.length}`
              : `${filtered.length}`}{" "}
            {filtered.length === 1 ? "record" : "records"}
          </span>
        </div>

        {/* Filter row */}
        {showFilters && filterDefs && (
          <div className="px-4 pb-3 flex items-center gap-3 flex-wrap border-t border-gray-100 dark:border-gray-800 pt-3">
            {filterDefs.map((f) => (
              <div key={f.key} className="flex items-center gap-1.5">
                <label className="text-xs text-gray-500 dark:text-gray-400">{f.label}</label>
                {f.type === "select" ? (
                  <div className="relative">
                    <select
                      value={activeFilters[f.key] || ""}
                      onChange={(e) =>
                        setActiveFilters((prev) => ({ ...prev, [f.key]: e.target.value }))
                      }
                      className="appearance-none text-sm border border-gray-200 dark:border-gray-700 rounded-lg pl-2 pr-7 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                    >
                      <option value="">All</option>
                      {f.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={activeFilters[f.key] || ""}
                    onChange={(e) =>
                      setActiveFilters((prev) => ({ ...prev, [f.key]: e.target.value }))
                    }
                    className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 w-32 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                    placeholder={`Filter ${f.label.toLowerCase()}...`}
                  />
                )}
              </div>
            ))}
            {activeFilterCount > 0 && (
              <button
                onClick={() => setActiveFilters({})}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
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
        <div className="mb-3 flex items-center justify-between px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
          <span className="text-sm text-blue-700 dark:text-blue-400 font-medium">
            {selectedRows.length} item{selectedRows.length > 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedKeys(new Set())}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Clear selection
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors"
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
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 border-t-gray-600 dark:border-t-gray-300 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
              {icon || <Search className="w-5 h-5 text-gray-400 dark:text-gray-500" />}
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {emptyTitle || "No records found"}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {emptyMessage || "Try adjusting your search or filters."}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                {onBulkDelete && (
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                      onChange={toggleAll}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                )}
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3 ${
                      col.sortable !== false ? "cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 select-none" : ""
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
                  <th className="w-20 px-4 py-3" />
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {filtered.map((row) => {
                const key = rowKey(row);
                const isSelected = selectedKeys.has(key);
                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick?.(row)}
                    className={`group transition-colors ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-900/10"
                        : onRowClick
                        ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                        : ""
                    }`}
                  >
                    {onBulkDelete && (
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(key)}
                          className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {col.render
                          ? col.render(row)
                          : String((row as Record<string, unknown>)[col.key] ?? "")}
                      </td>
                    ))}
                    {(actions || onDelete) && (
                      <td className="px-4 py-3 text-right">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
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
