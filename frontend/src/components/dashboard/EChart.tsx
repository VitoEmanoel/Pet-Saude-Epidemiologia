"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts";

type EChartProps = {
  option: echarts.EChartsOption;
  height?: number;
};

export function EChart({ option, height = 280 }: EChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const chart = echarts.init(containerRef.current);
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
