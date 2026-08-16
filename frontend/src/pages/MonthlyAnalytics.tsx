// src/pages/MonthlyAnalytics.tsx
 
import React, { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { apiClient } from "../services/api";
import BranchSelector from "../components/BranchSelector";
import type { TimeSeriesResponse } from "../types/index";
 
interface MonthlyAnalyticsProps {
  onBackHome: () => void;
  initialBranch?: string;
  onBranchChange?: (branch: string) => void;
}
 
// ── Shared chart helpers (same conventions as CirculationTrends.tsx) ─────────
 
const FY_COLORS = ["#6366F1", "#16A34A", "#2563EB", "#D97706", "#DC2626", "#9333EA"];
 
function niceInterval(range: number, targetTicks: number): number {
  const rough = range / targetTicks;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough || 1)));
  const residual = rough / magnitude;
  let nice: number;
  if (residual <= 1.5) nice = 1;
  else if (residual <= 3) nice = 2;
  else if (residual <= 7) nice = 5;
  else nice = 10;
  return nice * magnitude;
}
 
function formatYLabel(value: number): string {
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return value.toLocaleString();
}
 
function yAxis(values: number[], targetTicks = 4) {
  const minValue = Math.min(...values, 0);
  const maxValue = Math.max(...values, 0);
  const interval = niceInterval(maxValue - minValue || 1, targetTicks);
  const yMin = Math.floor(minValue / interval) * interval;
  const yMax = Math.ceil(maxValue / interval) * interval;
  const ticks: number[] = [];
  for (let v = yMin; v <= yMax; v += interval) ticks.push(Math.round(v));
  return { yMin, yMax, yRange: yMax - yMin || 1, ticks };
}
 
const CHART_W = 620;
const CHART_H = 260;
const PAD_L = 60;
const PAD_R = 20;
const PAD_T = 16;
const PAD_B = 34;
const PLOT_W = CHART_W - PAD_L - PAD_R;
const PLOT_H = CHART_H - PAD_T - PAD_B;
 
function ChartFrame({
  title,
  children,
  ticks,
  yCoord,
  legend,
}: {
  title: string;
  children: React.ReactNode;
  ticks: number[];
  yCoord: (v: number) => number;
  legend?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
      </div>
      <div className="bg-gray-50 rounded p-3">
        <svg
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          className="w-full h-auto"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Axes */}
          <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + PLOT_H} stroke="#374151" strokeWidth="2" />
          <line
            x1={PAD_L}
            y1={PAD_T + PLOT_H}
            x2={PAD_L + PLOT_W}
            y2={PAD_T + PLOT_H}
            stroke="#374151"
            strokeWidth="2"
          />
          {/* Grid + y labels */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD_L}
                y1={yCoord(t)}
                x2={PAD_L + PLOT_W}
                y2={yCoord(t)}
                stroke="#E5E7EB"
                strokeWidth="1"
              />
              <text x={PAD_L - 8} y={yCoord(t) + 4} textAnchor="end" fontSize="10" fill="#6B7280">
                {formatYLabel(t)}
              </text>
            </g>
          ))}
          {children}
        </svg>
      </div>
      {legend && <div className="flex flex-wrap gap-3 mt-3">{legend}</div>}
    </div>
  );
}
 
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-600">
      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </div>
  );
}
 
// ── Panel 1: Multi-year overlay ───────────────────────────────────────────────
 
function OverlayChart({ data }: { data: TimeSeriesResponse }) {
  const { overlay } = data.series;
  const allValues = Object.values(overlay).flatMap((pts) => pts.map((p) => p.total));
  const { yMin, yRange, ticks } = yAxis(allValues);
  const yCoord = (v: number) => PAD_T + PLOT_H - ((v - yMin) / yRange) * PLOT_H;
  const xCoord = (i: number) => PAD_L + (i / 11) * PLOT_W;
  const monthIndex = (m: string) => data.monthLabels.indexOf(m);
 
  return (
    <ChartFrame
      title="Total Circulation by Fiscal Year"
      ticks={ticks}
      yCoord={yCoord}
      legend={data.fyLabels.map((fy, i) => (
        <LegendDot key={fy} color={FY_COLORS[i % FY_COLORS.length]} label={fy} />
      ))}
    >
      {data.fyLabels.map((fy, i) => {
        const color = FY_COLORS[i % FY_COLORS.length];
        const pts = overlay[fy] || [];
        const actual = pts.filter((p) => !p.forecast);
        const forecast = pts.filter((p) => p.forecast);
        const actualPath = actual
          .map((p, idx) => `${idx === 0 ? "M" : "L"} ${xCoord(monthIndex(p.month))} ${yCoord(p.total)}`)
          .join(" ");
        const bridge = [...actual.slice(-1), ...forecast];
        const bridgePath = bridge
          .map((p, idx) => `${idx === 0 ? "M" : "L"} ${xCoord(monthIndex(p.month))} ${yCoord(p.total)}`)
          .join(" ");
        return (
          <g key={fy}>
            <path d={actualPath} stroke={color} strokeWidth="2.5" fill="none" strokeLinejoin="round" />
            {forecast.length > 0 && (
              <path d={bridgePath} stroke={color} strokeWidth="2" fill="none" strokeDasharray="6 4" opacity={0.85} />
            )}
            {forecast.map((p) => (
              <g key={p.month}>
                {p.seLow !== undefined && p.seHigh !== undefined && (
                  <rect
                    x={xCoord(monthIndex(p.month)) - 6}
                    y={yCoord(p.seHigh)}
                    width={12}
                    height={Math.max(1, yCoord(p.seLow) - yCoord(p.seHigh))}
                    fill={color}
                    opacity={0.15}
                  />
                )}
                <path
                  d={`M ${xCoord(monthIndex(p.month)) - 4} ${yCoord(p.total) + 4} L ${xCoord(monthIndex(p.month))} ${yCoord(p.total) - 4} L ${xCoord(monthIndex(p.month)) + 4} ${yCoord(p.total) + 4} Z`}
                  fill={color}
                />
                <title>{`${fy} ${p.month} (forecast): ${Math.round(p.total).toLocaleString()}`}</title>
              </g>
            ))}
            {actual.map((p) => (
              <circle key={p.month} cx={xCoord(monthIndex(p.month))} cy={yCoord(p.total)} r={3.5} fill={color} stroke="white" strokeWidth="1.5">
                <title>{`${fy} ${p.month}: ${Math.round(p.total).toLocaleString()}`}</title>
              </circle>
            ))}
          </g>
        );
      })}
      {data.monthLabels.map((m, i) => (
        <text key={m} x={xCoord(i)} y={PAD_T + PLOT_H + 16} textAnchor="middle" fontSize="9" fill="#6B7280">
          {m}
        </text>
      ))}
    </ChartFrame>
  );
}
 
// ── Panel 2: Annual print vs non-print ────────────────────────────────────────
 
function AnnualBarChart({ data }: { data: TimeSeriesResponse }) {
  const annual = data.series.annual;
  const allValues = annual.flatMap((a) => [
    a.print + a.forecastPrint,
    a.nonprint + a.forecastNonprint,
  ]);
  const { yMin, yRange, ticks } = yAxis(allValues);
  const yCoord = (v: number) => PAD_T + PLOT_H - ((v - yMin) / yRange) * PLOT_H;
  const groupW = PLOT_W / Math.max(annual.length, 1);
  const barW = Math.min(28, groupW * 0.28);
 
  return (
    <ChartFrame
      title="Annual Print vs Non-Print Totals"
      ticks={ticks}
      yCoord={yCoord}
      legend={[
        <LegendDot key="p" color="#2563EB" label="Print" />,
        <LegendDot key="n" color="#D97706" label="Non-Print" />,
      ]}
    >
      {annual.map((a, i) => {
        const cx = PAD_L + groupW * (i + 0.5);
        const isForecastYear = a.forecastPrint > 0 || a.forecastNonprint > 0;
        return (
          <g key={a.fy}>
            <rect x={cx - barW - 2} y={yCoord(a.print)} width={barW} height={Math.max(0, PAD_T + PLOT_H - yCoord(a.print))} fill="#2563EB">
              <title>{`${a.fy} Print: ${Math.round(a.print).toLocaleString()}`}</title>
            </rect>
            <rect x={cx + 2} y={yCoord(a.nonprint)} width={barW} height={Math.max(0, PAD_T + PLOT_H - yCoord(a.nonprint))} fill="#D97706">
              <title>{`${a.fy} Non-Print: ${Math.round(a.nonprint).toLocaleString()}`}</title>
            </rect>
            {isForecastYear && (
              <>
                <rect
                  x={cx - barW - 2}
                  y={yCoord(a.print + a.forecastPrint)}
                  width={barW}
                  height={Math.max(0, PAD_T + PLOT_H - yCoord(a.print + a.forecastPrint))}
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                >
                  <title>{`${a.fy} Print incl. forecast: ${Math.round(a.print + a.forecastPrint).toLocaleString()}`}</title>
                </rect>
                <rect
                  x={cx + 2}
                  y={yCoord(a.nonprint + a.forecastNonprint)}
                  width={barW}
                  height={Math.max(0, PAD_T + PLOT_H - yCoord(a.nonprint + a.forecastNonprint))}
                  fill="none"
                  stroke="#D97706"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                >
                  <title>{`${a.fy} Non-Print incl. forecast: ${Math.round(a.nonprint + a.forecastNonprint).toLocaleString()}`}</title>
                </rect>
              </>
            )}
            <text x={cx} y={PAD_T + PLOT_H + 16} textAnchor="middle" fontSize="9" fill="#6B7280">
              {a.fy}
            </text>
          </g>
        );
      })}
    </ChartFrame>
  );
}
 
// ── Panel 3: Full chronological timeline ──────────────────────────────────────
 
function TimelineChart({ data }: { data: TimeSeriesResponse }) {
  const timeline = data.series.timeline;
  const { yMin, yRange, ticks } = yAxis(timeline.map((p) => p.total));
  const yCoord = (v: number) => PAD_T + PLOT_H - ((v - yMin) / yRange) * PLOT_H;
  const total = data.fyLabels.length * 12;
  const xCoord = (i: number) => PAD_L + (i / Math.max(total - 1, 1)) * PLOT_W;
 
  const actual = timeline.filter((p) => !p.forecast);
  const forecast = timeline.filter((p) => p.forecast);
  const actualPath = actual.map((p, idx) => `${idx === 0 ? "M" : "L"} ${xCoord(p.index)} ${yCoord(p.total)}`).join(" ");
  const areaPath = `${actualPath} L ${xCoord(actual[actual.length - 1]?.index ?? 0)} ${PAD_T + PLOT_H} L ${xCoord(0)} ${PAD_T + PLOT_H} Z`;
  const bridge = [...actual.slice(-1), ...forecast];
  const bridgePath = bridge.map((p, idx) => `${idx === 0 ? "M" : "L"} ${xCoord(p.index)} ${yCoord(p.total)}`).join(" ");
 
  return (
    <ChartFrame title={`Full Chronological Timeline${data.hasForecast ? " + Forecast" : ""}`} ticks={ticks} yCoord={yCoord}>
      <path d={areaPath} fill="#2563EB" opacity={0.1} />
      <path d={actualPath} stroke="#2563EB" strokeWidth="2" fill="none" />
      {forecast.length > 0 && (
        <path d={bridgePath} stroke="#9333EA" strokeWidth="2" fill="none" strokeDasharray="6 4" />
      )}
      {forecast.map((p) => (
        <g key={p.index}>
          {p.seLow !== undefined && p.seHigh !== undefined && (
            <rect
              x={xCoord(p.index) - 5}
              y={yCoord(p.seHigh)}
              width={10}
              height={Math.max(1, yCoord(p.seLow) - yCoord(p.seHigh))}
              fill="#9333EA"
              opacity={0.15}
            />
          )}
          <circle cx={xCoord(p.index)} cy={yCoord(p.total)} r={3.5} fill="#9333EA" stroke="white" strokeWidth="1.5">
            <title>{`${p.fy} ${p.month} (forecast): ${Math.round(p.total).toLocaleString()}`}</title>
          </circle>
        </g>
      ))}
      {data.fyLabels.map((fy, i) => (
        <g key={fy}>
          {i > 0 && (
            <line x1={xCoord(i * 12) - PLOT_W / total / 2} y1={PAD_T} x2={xCoord(i * 12) - PLOT_W / total / 2} y2={PAD_T + PLOT_H} stroke="#9CA3AF" strokeWidth="1" strokeDasharray="3 3" />
          )}
          <text x={xCoord(i * 12 + 5)} y={PAD_T + PLOT_H + 16} textAnchor="middle" fontSize="9" fill="#6B7280">
            {fy}
          </text>
        </g>
      ))}
    </ChartFrame>
  );
}
 
// ── Panel 4: YoY % change ─────────────────────────────────────────────────────
 
function YoyChart({ data }: { data: TimeSeriesResponse }) {
  const yoy = data.series.yoy;
  const labels = Object.keys(yoy);
  const allValues = Object.values(yoy).flatMap((pts) => pts.map((p) => p.pctChange));
  const { yMin, yRange, ticks } = yAxis(allValues.length ? allValues : [0]);
  const yCoord = (v: number) => PAD_T + PLOT_H - ((v - yMin) / yRange) * PLOT_H;
  const xCoord = (i: number) => PAD_L + (i / 11) * PLOT_W;
  const monthIndex = (m: string) => data.monthLabels.indexOf(m);
 
  return (
    <ChartFrame
      title="Year-over-Year % Change by Month"
      ticks={ticks}
      yCoord={yCoord}
      legend={labels.map((label, i) => (
        <LegendDot key={label} color={FY_COLORS[(i + 1) % FY_COLORS.length]} label={label} />
      ))}
    >
      <line x1={PAD_L} y1={yCoord(0)} x2={PAD_L + PLOT_W} y2={yCoord(0)} stroke="#6B7280" strokeWidth="1" />
      {labels.map((label, i) => {
        const color = FY_COLORS[(i + 1) % FY_COLORS.length];
        const pts = yoy[label];
        const actual = pts.filter((p) => !p.forecast);
        const forecast = pts.filter((p) => p.forecast);
        const actualPath = actual.map((p, idx) => `${idx === 0 ? "M" : "L"} ${xCoord(monthIndex(p.month))} ${yCoord(p.pctChange)}`).join(" ");
        const bridge = [...actual.slice(-1), ...forecast];
        const bridgePath = bridge.map((p, idx) => `${idx === 0 ? "M" : "L"} ${xCoord(monthIndex(p.month))} ${yCoord(p.pctChange)}`).join(" ");
        return (
          <g key={label}>
            <path d={actualPath} stroke={color} strokeWidth="2.5" fill="none" strokeLinejoin="round" />
            {forecast.length > 0 && <path d={bridgePath} stroke={color} strokeWidth="2" fill="none" strokeDasharray="6 4" opacity={0.85} />}
            {actual.map((p) => (
              <circle key={p.month} cx={xCoord(monthIndex(p.month))} cy={yCoord(p.pctChange)} r={3.5} fill={color} stroke="white" strokeWidth="1.5">
                <title>{`${label} ${p.month}: ${p.pctChange > 0 ? "+" : ""}${p.pctChange.toFixed(1)}%`}</title>
              </circle>
            ))}
            {forecast.map((p) => (
              <path
                key={p.month}
                d={`M ${xCoord(monthIndex(p.month)) - 4} ${yCoord(p.pctChange) + 4} L ${xCoord(monthIndex(p.month))} ${yCoord(p.pctChange) - 4} L ${xCoord(monthIndex(p.month)) + 4} ${yCoord(p.pctChange) + 4} Z`}
                fill={color}
              >
                <title>{`${label} ${p.month} (forecast): ${p.pctChange > 0 ? "+" : ""}${p.pctChange.toFixed(1)}%`}</title>
              </path>
            ))}
          </g>
        );
      })}
      {data.monthLabels.map((m, i) => (
        <text key={m} x={xCoord(i)} y={PAD_T + PLOT_H + 16} textAnchor="middle" fontSize="9" fill="#6B7280">
          {m}
        </text>
      ))}
    </ChartFrame>
  );
}
 
// ── Summary cards ──────────────────────────────────────────────────────────
 
function SummaryCards({ data }: { data: TimeSeriesResponse }) {
  const latestOverlay = data.series.overlay[data.latestFy] || [];
  const lastReported = [...latestOverlay].reverse().find((p) => !p.forecast);
  const nextForecast = latestOverlay.find((p) => p.forecast);
  const latestYoyKey = Object.keys(data.series.yoy).slice(-1)[0];
  const latestYoyPts = latestYoyKey ? data.series.yoy[latestYoyKey] : [];
  const lastYoy = [...latestYoyPts].reverse().find((p) => !p.forecast);
 
  const cards = [
    {
      label: `Latest Reported Month (${data.latestFy})`,
      value: lastReported ? `${lastReported.month}: ${Math.round(lastReported.total).toLocaleString()}` : "—",
    },
    {
      label: "YoY % Change (latest month)",
      value: lastYoy ? `${lastYoy.pctChange > 0 ? "+" : ""}${lastYoy.pctChange.toFixed(1)}%` : "—",
    },
    {
      label: "Next Month Forecast",
      value: nextForecast ? `${nextForecast.month}: ~${Math.round(nextForecast.total).toLocaleString()}` : "No forecast available",
    },
  ];
 
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">{c.label}</p>
          <p className="text-lg font-bold text-gray-900">{c.value}</p>
        </div>
      ))}
    </div>
  );
}
 
// ── Page ─────────────────────────────────────────────────────────────────────
 
export default function MonthlyAnalytics({ onBackHome, initialBranch = "", onBranchChange }: MonthlyAnalyticsProps) {
  const [branches, setBranches] = useState<string[]>([]);
  const [department, setDepartment] = useState<string>(initialBranch);
  const [data, setData] = useState<TimeSeriesResponse | null>(null);
  const [isLoadingBranches, setIsLoadingBranches] = useState(true);
  const [isLoadingSeries, setIsLoadingSeries] = useState(false);
  const [error, setError] = useState<string | null>(null);
 
  // Load branch list once (reuses the circulation endpoint's branch list)
  useEffect(() => {
    const loadBranches = async () => {
      setIsLoadingBranches(true);
      try {
        const res = await apiClient.getCirculationData();
        const list = (res.data as any)?.branches ?? [];
        setBranches(list);
        const preferred = initialBranch && list.includes(initialBranch)
          ? initialBranch
          : (list.length > 0 ? list[0] : "");
        if (preferred) setDepartment(preferred);
      } catch (err) {
        console.error("Failed to load branch list:", err);
      } finally {
        setIsLoadingBranches(false);
      }
    };
    loadBranches();
  }, []);
 
  // Fetch time series whenever the selected department changes
  useEffect(() => {
    if (!department) return;
    const loadSeries = async () => {
      setIsLoadingSeries(true);
      setError(null);
      try {
        const res = await apiClient.getTimeSeriesData(department);
        if (res.success && res.data) {
          setData(res.data);
        } else {
          setError(res.error?.message || "Failed to load time series data");
        }
      } catch (err) {
        console.error("Error fetching time series data:", err);
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setIsLoadingSeries(false);
      }
    };
    loadSeries();
  }, [department]);
 
  const isLoading = isLoadingBranches || isLoadingSeries;
 
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <button
          onClick={onBackHome}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>
      </div>
 
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Monthly Analytics</h1>
      <p className="text-gray-500 mb-6">
        Multi-year circulation trends, forecasts, and year-over-year comparisons by department.
      </p>
 
      <div className="mb-6">
        <BranchSelector
          branches={branches}
          selectedBranch={department || "Loading..."}
          onBranchChange={(b) => { setDepartment(b); onBranchChange?.(b); }}
          isLoading={isLoadingBranches}
        />
      </div>
 
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 mb-6">
          <p className="font-semibold">Failed to load time series data</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}
 
      {isLoading && !error && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gray-200 rounded-lg h-20 animate-pulse" />
            <div className="bg-gray-200 rounded-lg h-20 animate-pulse" />
            <div className="bg-gray-200 rounded-lg h-20 animate-pulse" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-200 rounded-lg h-64 animate-pulse" />
            <div className="bg-gray-200 rounded-lg h-64 animate-pulse" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-200 rounded-lg h-64 animate-pulse" />
            <div className="bg-gray-200 rounded-lg h-64 animate-pulse" />
          </div>
        </div>
      )}
 
      {!isLoading && !error && data && (
        <div className="space-y-6">
          <SummaryCards data={data} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <OverlayChart data={data} />
            <AnnualBarChart data={data} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TimelineChart data={data} />
            <YoyChart data={data} />
          </div>
        </div>
      )}
 
      {!isLoading && !error && !data && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-700">
          <p className="font-semibold">No data available</p>
          <p className="text-sm mt-1">Select a department to view its time series.</p>
        </div>
      )}
    </div>
  );
}
 
 
