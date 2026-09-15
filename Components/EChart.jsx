import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import { GridComponent, LegendComponent, TitleComponent, TooltipComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  SVGRenderer,
]);

export default function EChart({ option, height = 300, ariaLabel, className = "" }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const chart = echarts.init(containerRef.current, null, { renderer: "svg" });
    chart.setOption(option, { notMerge: true });

    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.dispose();
    };
  }, [option]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height }}
      role="img"
      aria-label={ariaLabel}
    />
  );
}
