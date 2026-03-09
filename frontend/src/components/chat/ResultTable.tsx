interface ResultTableProps {
  data: Record<string, any>[];
}

function formatValue(value: any): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? value.toLocaleString()
      : value.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
  }
  return String(value);
}

function formatHeader(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ResultTable({ data }: ResultTableProps) {
  if (!data.length) return null;

  const columns = Object.keys(data[0]);

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-950">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="text-left px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap"
                >
                  {formatHeader(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr
                key={i}
                className={i % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50/50 dark:bg-gray-800/50"}
              >
                {columns.map((col) => (
                  <td
                    key={col}
                    className="px-3 py-2 text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-800 whitespace-nowrap"
                  >
                    {formatValue(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-1.5 text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-950 border-t border-gray-200 dark:border-gray-700">
        {data.length} row{data.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
