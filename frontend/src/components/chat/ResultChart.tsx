import { useRef, useEffect, useState } from "react";
import { Chart } from "frappe-charts";
import { ChartConfig } from "@/types";

interface ResultChartProps {
  config: ChartConfig;
}

export function ResultChart({ config }: ResultChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<any>(null);
  const [renderError, setRenderError] = useState(false);

  const hasData =
    config.labels &&
    config.labels.length > 0 &&
    config.datasets &&
    config.datasets.length > 0 &&
    config.datasets.some((ds) => ds.values && ds.values.length > 0);

  useEffect(() => {
    if (!chartRef.current || !hasData) return;

    // Defer chart creation to next frame so the container has layout dimensions
    const rafId = requestAnimationFrame(() => {
      if (!chartRef.current) return;

      // Clean up previous chart
      if (chartInstance.current?.destroy) {
        chartInstance.current.destroy();
      }

      try {
        chartInstance.current = new Chart(chartRef.current, {
          type: config.type === "percentage" ? "percentage" : config.type,
          title: config.title,
          data: {
            labels: config.labels.map(String),
            datasets: config.datasets.map((ds) => ({
              ...ds,
              values: ds.values.map((v) => Number(v) || 0),
            })),
          },
          height: 300,
          colors: ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"],
          barOptions: {
            spaceRatio: 0.4,
          },
          axisOptions: {
            xAxisMode: "tick",
            xIsSeries: config.type === "line",
          },
        });
        setRenderError(false);
      } catch (e) {
        console.error("Chart rendering error:", e);
        setRenderError(true);
      }
    });

    return () => {
      cancelAnimationFrame(rafId);
      if (chartInstance.current?.destroy) {
        chartInstance.current.destroy();
      }
    };
  }, [config, hasData]);

  if (!hasData) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 text-center text-sm text-gray-400 dark:text-gray-500">
        {config.title && <p className="font-medium text-gray-500 dark:text-gray-400 mb-1">{config.title}</p>}
        No chart data available.
      </div>
    );
  }

  if (renderError) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 text-center text-sm text-gray-400 dark:text-gray-500">
        {config.title && <p className="font-medium text-gray-500 dark:text-gray-400 mb-1">{config.title}</p>}
        Failed to render chart.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
      <div ref={chartRef} className="w-full" style={{ minHeight: 300 }} />
    </div>
  );
}
