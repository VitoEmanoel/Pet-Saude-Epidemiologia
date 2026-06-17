"use client";

import { useEffect, useRef } from "react";
import { BarChart, LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { init, use } from "echarts/core";
import type { EChartsOption } from "echarts";
import { CanvasRenderer } from "echarts/renderers";

use([BarChart, LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

type EChartProps = {
  option: EChartsOption;
  height?: number;
};

export function EChart({ option, height = 280 }: EChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const chart = init(containerRef.current);
    chart.setOption(option);

    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.dispose();
    };
  }, [option]);

  return <div ref={containerRef} style={{ height }} className="min-w-0 w-full overflow-hidden" />;
}
