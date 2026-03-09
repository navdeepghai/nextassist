interface ResultListProps {
  data: Record<string, any>[];
}

export function ResultList({ data }: ResultListProps) {
  if (!data.length) return null;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
      {data.map((item, i) => (
        <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
              {item.title || item.name || Object.values(item)[0]}
            </p>
            {item.subtitle && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{item.subtitle}</p>
            )}
          </div>
          {item.value !== undefined && item.value !== null && (
            <span className="ml-4 text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
              {String(item.value)}
            </span>
          )}
        </div>
      ))}
      <div className="px-4 py-1.5 text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-950">
        {data.length} item{data.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
