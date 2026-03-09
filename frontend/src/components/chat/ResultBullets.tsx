interface ResultBulletsProps {
  data: Record<string, any>[];
}

export function ResultBullets({ data }: ResultBulletsProps) {
  if (!data.length) return null;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 px-4 py-3 space-y-2">
      {data.map((item, i) => {
        const label = item.label || Object.keys(item)[0];
        const value = item.value ?? item[Object.keys(item)[0]];

        return (
          <div key={i} className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
            <span className="text-sm text-gray-600 dark:text-gray-400">{label}:</span>
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              {typeof value === "number" ? value.toLocaleString() : String(value ?? "-")}
            </span>
          </div>
        );
      })}
    </div>
  );
}
