"use client";

import type { EChartsOption } from "echarts";
import type { CategoryPoint, ChartPoint } from "@/types/api";
import { EChart } from "./EChart";

type ChartPanelProps =
  | {
      title: string;
      type: "line";
      data: ChartPoint[];
      height?: number;
    }
  | {
      title: string;
      type: "bar";
      data: CategoryPoint[];
      height?: number;
      horizontal?: boolean;
    };

export function ChartPanel(props: ChartPanelProps) {
  const option = props.type === "line" ? lineOption(props.data) : barOption(props.data, props.horizontal);

  return (
    <section className="min-w-0 rounded border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-950">{props.title}</h2>
      </div>
      <div className="p-3">
        <EChart option={option} height={props.height ?? 300} />
      </div>
    </section>
  );
}

function lineOption(data: ChartPoint[]): EChartsOption {
  return {
    grid: { left: 44, right: 16, top: 24, bottom: 32 },
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      data: data.map((point) => String(point.year)),
      axisLabel: { color: "#475569" },
      axisLine: { lineStyle: { color: "#cbd5e1" } }
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#475569" },
      splitLine: { lineStyle: { color: "#e2e8f0" } }
    },
    series: [
      {
        type: "line",
        data: data.map((point) => point.value),
        smooth: true,
        symbolSize: 7,
        lineStyle: { width: 3, color: "#178354" },
        itemStyle: { color: "#178354" },
        areaStyle: { color: "rgba(23, 131, 84, 0.12)" }
      }
    ]
  };
}

function barOption(data: CategoryPoint[], horizontal = false): EChartsOption {
  const labels = data.map((point) => point.label);
  const values = data.map((point) => point.value);

  return {
    grid: { left: horizontal ? 112 : 44, right: 16, top: 24, bottom: horizontal ? 24 : 56 },
    tooltip: { trigger: "axis" },
    xAxis: horizontal
      ? {
          type: "value",
          axisLabel: { color: "#475569" },
          splitLine: { lineStyle: { color: "#e2e8f0" } }
        }
      : {
          type: "category",
          data: labels,
          axisLabel: { color: "#475569", rotate: labels.some((label) => label.length > 8) ? 28 : 0 },
          axisLine: { lineStyle: { color: "#cbd5e1" } }
        },
    yAxis: horizontal
      ? {
          type: "category",
          data: labels,
          axisLabel: { color: "#475569" },
          axisLine: { lineStyle: { color: "#cbd5e1" } }
        }
      : {
          type: "value",
          axisLabel: { color: "#475569" },
          splitLine: { lineStyle: { color: "#e2e8f0" } }
        },
    series: [
      {
        type: "bar",
        data: values,
        barMaxWidth: 34,
        itemStyle: { color: "#2563eb", borderRadius: horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0] }
      }
    ]
  };
}
