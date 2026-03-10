import { StructuredResult } from "@/types";
import { ResultTable } from "./ResultTable";
import { ResultList } from "./ResultList";
import { ResultBullets } from "./ResultBullets";
import { ResultChart } from "./ResultChart";
import { ResultFiles } from "./ResultFiles";
import { ResultError } from "./ResultError";

interface ResultRendererProps {
  result: StructuredResult;
}

function DataRenderer({ data, format }: { data: Record<string, any>[]; format?: string }) {
  if (!data || !data.length) return null;

  switch (format) {
    case "bullets":
      return <ResultBullets data={data} />;
    case "list":
      return <ResultList data={data} />;
    default:
      return <ResultTable data={data} />;
  }
}

export function ResultRenderer({ result }: ResultRendererProps) {
  const hasContent =
    result.error ||
    (result.data && result.data.length > 0) ||
    result.chart ||
    (result.files && result.files.length > 0);

  if (!hasContent) return null;

  return (
    <div className="mt-3 space-y-3">
      {result.error && <ResultError error={result.error} />}
      {result.data && result.data.length > 0 && (
        <DataRenderer data={result.data} format={result.layout || result.format} />
      )}
      {result.chart && <ResultChart config={result.chart} />}
      {result.files && result.files.length > 0 && (
        <ResultFiles files={result.files} />
      )}
    </div>
  );
}
