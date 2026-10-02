"use client";

import { useEffect, useState } from "react";
import type { EChartsOption } from "echarts";
import type { CategoryPoint, ChartPoint } from "@/types/api";
import { EChart } from "./EChart";

type ChartPanelProps =
  | {
      title: string;
      type: "line";
      data: ChartPoint[];
      height?: number;
      note?: string;
    }
  | {
      title: string;
      type: "bar";
      data: CategoryPoint[];
      height?: number;
      horizontal?: boolean;
      note?: string;
    };

export function ChartPanel(props: ChartPanelProps) {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const updateTheme = () => setDarkMode(root.classList.contains("dark"));
    const observer = new MutationObserver(updateTheme);

    updateTheme();
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  const option =
    props.type === "line"
      ? lineOption(props.data, darkMode)
      : barOption(props.data, props.horizontal, darkMode);
  const empty = props.data.length === 0;

  return (
    <section className="min-w-0 rounded border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-950">{props.title}</h2>
        {props.note ? <p className="mt-1 text-xs text-slate-600">{props.note}</p> : null}
      </div>
      <div className="p-3">
        {empty ? (
          <div
            style={{ height: props.height ?? 300 }}
            className="flex min-w-0 items-center justify-center rounded bg-slate-50 px-4 text-center text-sm text-slate-500"
          >
            Sem dados para os filtros selecionados.
          </div>
        ) : (
          <EChart option={option} height={props.height ?? 300} />
        )}
      </div>
    </section>
  );
}

function lineOption(data: ChartPoint[], darkMode: boolean): EChartsOption {
  const labelColor = darkMode ? "#E2E0E0" : "#143A60";
  const gridColor = darkMode ? "#459CD7" : "#E2E0E0";

  return {
    grid: { left: 44, right: 16, top: 24, bottom: 32 },
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      data: data.map((point) => String(point.year)),
      axisLabel: { color: labelColor },
      axisLine: { lineStyle: { color: gridColor } }
    },
    yAxis: {
      type: "value",
      axisLabel: { color: labelColor },
      splitLine: { lineStyle: { color: gridColor, opacity: darkMode ? 0.35 : 1 } }
    },
    series: [
      {
        type: "line",
        data: data.map((point) => point.value),
        // Monotônica: a curva nunca passa acima/abaixo dos pontos reais entre um ano e outro.
        smooth: 0.4,
        smoothMonotone: "x",
        symbolSize: 7,
        lineStyle: { width: 3, color: "#066F9B" },
        itemStyle: { color: "#E8531E" },
        areaStyle: { color: "rgba(69, 156, 215, 0.18)" }
      }
    ]
  };
}

function barOption(data: CategoryPoint[], horizontal = false, darkMode = false): EChartsOption {
  const labels = data.map((point) => point.label);
  const values = data.map((point) => point.value);
  const labelColor = darkMode ? "#E2E0E0" : "#143A60";
  const gridColor = darkMode ? "#459CD7" : "#E2E0E0";

  return {
    grid: { left: horizontal ? 112 : 44, right: 16, top: 24, bottom: horizontal ? 24 : 56 },
    tooltip: { trigger: "axis" },
    xAxis: horizontal
      ? {
          type: "value",
          axisLabel: { color: labelColor },
          splitLine: { lineStyle: { color: gridColor, opacity: darkMode ? 0.35 : 1 } }
        }
      : {
          type: "category",
          data: labels,
          axisLabel: { color: labelColor, rotate: labels.some((label) => label.length > 8) ? 28 : 0 },
          axisLine: { lineStyle: { color: gridColor } }
        },
    yAxis: horizontal
      ? {
          type: "category",
          data: labels,
          axisLabel: { color: labelColor },
          axisLine: { lineStyle: { color: gridColor } }
        }
      : {
          type: "value",
          axisLabel: { color: labelColor },
          splitLine: { lineStyle: { color: gridColor, opacity: darkMode ? 0.35 : 1 } }
        },
    series: [
      {
        type: "bar",
        data: values,
        barMaxWidth: 34,
        itemStyle: { color: "#066F9B", borderRadius: horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0] }
      }
    ]
  };
}
