"use client";

// Lightweight, dependency-free SVG charts for the Evidence & Certainty
// section (no charting library is installed in this project, and adding
// one just for two chart types was judged unnecessary). Both charts lay
// comparisons out as horizontal rows with the label in its own fixed-width
// column to the left of the plot area - this is a deliberate layout choice
// so long treatment-comparison names (e.g. "Amoxicillin-Clavulanate vs
// Placebo") can never overlap the plotted data, regardless of label length,
// without needing rotated axis text.

import { useRef, useState } from 'react';

const ROW_HEIGHT = 34;
const LABEL_COL_WIDTH = 220;
const PLOT_PADDING_RIGHT = 24;
const TOP_PADDING = 28;
const BOTTOM_PADDING = 36;

export interface BoxPlotDatum {
  label: string;
  values: number[];
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  return sorted[base];
}

function useSvgPngDownload(svgRef: React.RefObject<SVGSVGElement | null>) {
  return (filename: string) => {
    const svg = svgRef.current;
    if (!svg) return;
    const width = Number(svg.getAttribute("width"));
    const height = Number(svg.getAttribute("height"));
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const scale = 2; // high-resolution output
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); return; }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = filename;
      link.click();
    };
    img.src = url;
  };
}

export function BoxPlotChart({ data, xLabel, chartTitle }: { data: BoxPlotDatum[]; xLabel: string; chartTitle: string }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const download = useSvgPngDownload(svgRef);
  const [width, setWidth] = useState(760);

  const allValues = data.flatMap(d => d.values).filter(v => Number.isFinite(v));
  if (allValues.length === 0) {
    return <div className="text-slate-500 text-sm italic">No numeric values available to plot for this selection.</div>;
  }
  const min = Math.min(...allValues), max = Math.max(...allValues);
  const range = max - min || 1;
  const plotLeft = LABEL_COL_WIDTH;
  const plotWidth = Math.max(width - plotLeft - PLOT_PADDING_RIGHT, 120);
  const height = TOP_PADDING + data.length * ROW_HEIGHT + BOTTOM_PADDING;
  const scaleX = (v: number) => plotLeft + ((v - min) / range) * plotWidth;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <h5 className="text-white font-semibold text-xs">{chartTitle}</h5>
        <button onClick={() => download(`${chartTitle.replace(/\s+/g, "-").toLowerCase()}.png`)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow">Download PNG</button>
      </div>
      <div className="bg-white rounded-xl p-4 overflow-x-auto" ref={(el) => { if (el) setWidth(Math.max(el.clientWidth, 560)); }}>
        <svg ref={svgRef} width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
          {/* axis */}
          <line x1={plotLeft} y1={TOP_PADDING - 8} x2={plotLeft} y2={height - BOTTOM_PADDING + 4} stroke="#cbd5e1" strokeWidth={1} />
          <line x1={plotLeft} y1={height - BOTTOM_PADDING + 4} x2={width - PLOT_PADDING_RIGHT} y2={height - BOTTOM_PADDING + 4} stroke="#cbd5e1" strokeWidth={1} />
          {[0, 0.25, 0.5, 0.75, 1].map((f) => {
            const v = min + f * range;
            const x = scaleX(v);
            return (
              <g key={f}>
                <line x1={x} y1={TOP_PADDING - 8} x2={x} y2={height - BOTTOM_PADDING + 4} stroke="#f1f5f9" strokeWidth={1} />
                <text x={x} y={height - BOTTOM_PADDING + 18} fontSize={10} fill="#475569" textAnchor="middle">{v.toFixed(1)}</text>
              </g>
            );
          })}
          <text x={(plotLeft + width - PLOT_PADDING_RIGHT) / 2} y={height - 4} fontSize={11} fill="#334155" textAnchor="middle">{xLabel}</text>

          {data.map((d, i) => {
            const y = TOP_PADDING + i * ROW_HEIGHT + ROW_HEIGHT / 2;
            const vals = d.values.filter(Number.isFinite).slice().sort((a, b) => a - b);
            const rowLabel = d.label.length > 30 ? d.label.slice(0, 28) + "…" : d.label;
            if (vals.length === 0) {
              return (
                <g key={d.label}>
                  <text x={LABEL_COL_WIDTH - 10} y={y + 4} fontSize={11} fill="#334155" textAnchor="end">{rowLabel}</text>
                  <text x={plotLeft + 8} y={y + 4} fontSize={10} fill="#94a3b8" fontStyle="italic">no data</text>
                </g>
              );
            }
            const q1 = quantile(vals, 0.25), q2 = quantile(vals, 0.5), q3 = quantile(vals, 0.75);
            const vmin = vals[0], vmax = vals[vals.length - 1];
            const boxH = 14;
            return (
              <g key={d.label}>
                <title>{d.label}</title>
                <text x={LABEL_COL_WIDTH - 10} y={y + 4} fontSize={11} fill="#334155" textAnchor="end">{rowLabel}</text>
                <line x1={scaleX(vmin)} y1={y} x2={scaleX(q1)} y2={y} stroke="#6366f1" strokeWidth={1.5} />
                <line x1={scaleX(q3)} y1={y} x2={scaleX(vmax)} y2={y} stroke="#6366f1" strokeWidth={1.5} />
                <rect x={scaleX(q1)} y={y - boxH / 2} width={Math.max(scaleX(q3) - scaleX(q1), 1)} height={boxH} fill="#a5b4fc" stroke="#4f46e5" strokeWidth={1.2} />
                <line x1={scaleX(q2)} y1={y - boxH / 2} x2={scaleX(q2)} y2={y + boxH / 2} stroke="#312e81" strokeWidth={1.8} />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export interface BarChartDatum {
  label: string;
  categories: { name: string; count: number }[];
}

const CATEGORY_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#0ea5e9", "#a855f7", "#84cc16"];

export function CategoricalBarChart({ data, chartTitle }: { data: BarChartDatum[]; chartTitle: string }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const download = useSvgPngDownload(svgRef);
  const [width, setWidth] = useState(760);

  const allCategoryNames = Array.from(new Set(data.flatMap(d => d.categories.map(c => c.name))));
  const maxCount = Math.max(1, ...data.flatMap(d => d.categories.map(c => c.count)));
  const plotLeft = LABEL_COL_WIDTH;
  const plotWidth = Math.max(width - plotLeft - PLOT_PADDING_RIGHT, 120);
  const legendHeight = allCategoryNames.length > 0 ? 22 : 0;
  const height = TOP_PADDING + legendHeight + data.length * ROW_HEIGHT + BOTTOM_PADDING;
  const scaleX = (v: number) => (v / maxCount) * plotWidth;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <h5 className="text-white font-semibold text-xs">{chartTitle}</h5>
        <button onClick={() => download(`${chartTitle.replace(/\s+/g, "-").toLowerCase()}.png`)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow">Download PNG</button>
      </div>
      <div className="bg-white rounded-xl p-4 overflow-x-auto" ref={(el) => { if (el) setWidth(Math.max(el.clientWidth, 560)); }}>
        <svg ref={svgRef} width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
          {allCategoryNames.map((name, i) => (
            <g key={name} transform={`translate(${plotLeft + i * 130}, ${TOP_PADDING - 14})`}>
              <rect width={10} height={10} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} rx={2} />
              <text x={14} y={9} fontSize={10} fill="#334155">{name.length > 16 ? name.slice(0, 14) + "…" : name}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const y = TOP_PADDING + legendHeight + i * ROW_HEIGHT + ROW_HEIGHT / 2;
            const rowLabel = d.label.length > 30 ? d.label.slice(0, 28) + "…" : d.label;
            const total = d.categories.reduce((s, c) => s + c.count, 0);
            let x = plotLeft;
            return (
              <g key={d.label}>
                <title>{d.label}</title>
                <text x={LABEL_COL_WIDTH - 10} y={y + 4} fontSize={11} fill="#334155" textAnchor="end">{rowLabel}</text>
                {total === 0 ? (
                  <text x={plotLeft + 8} y={y + 4} fontSize={10} fill="#94a3b8" fontStyle="italic">no data</text>
                ) : d.categories.map((c) => {
                  const w = scaleX(c.count);
                  const rect = <rect key={c.name} x={x} y={y - 9} width={Math.max(w, 0)} height={18} fill={CATEGORY_COLORS[allCategoryNames.indexOf(c.name) % CATEGORY_COLORS.length]} />;
                  x += w;
                  return rect;
                })}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
