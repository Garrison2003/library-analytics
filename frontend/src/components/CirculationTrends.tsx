// src/components/CirculationTrends.tsx (UPDATED)

import React, { useEffect, useMemo, useState, useCallback } from "react";
import type { CirculationDataPoint } from "../types/index";

/**
 * CirculationTrends Component (with Branch Support)
 *
 * Displays five line graphs, filtered by selected branch:
 * - Juvenile (blue)        → breakdown: Juvenile Fiction + Juvenile Non-Fiction
 * - Young Adult (green)    → breakdown: Young Adult Fiction + Young Adult Non-Fiction
 * - Adult (purple)         → breakdown: Adult Fiction + Adult Non-Fiction
 * - Non-Print (teal)       → breakdown: Audio + Visual
 * - Total Circulation (coral) → breakdown: Total Books + Total NonPrint
 *
 * Features:
 * - Dynamic y-axis labels that adjust per branch/dataset
 * - Hover tooltip showing sub-category breakdown per data point
 *
 * Fetches from GET /circulation?branch={name}
 */

interface LineGraphProps {
  title: string;
  data: CirculationDataPoint[];
  lineColor: string;
}

interface CirculationTrendsProps {
  selectedBranch?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Compute a "nice" tick interval for the y-axis. */
function niceInterval(range: number, targetTicks: number): number {
  const rough = range / targetTicks;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const residual = rough / magnitude;
  let nice: number;
  if (residual <= 1.5) nice = 1;
  else if (residual <= 3) nice = 2;
  else if (residual <= 7) nice = 5;
  else nice = 10;
  return nice * magnitude;
}

/** Format large numbers for y-axis labels (e.g. 1200 → "1.2K", 45000 → "45K"). */
function formatYLabel(value: number): string {
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 1_000_000)
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return value.toLocaleString();
}

/** Format numbers for the tooltip (with comma separators). */
function formatTooltipValue(value: number): string {
  return value.toLocaleString();
}

// ── LineGraph ────────────────────────────────────────────────────────────────

const LineGraph: React.FC<LineGraphProps> = ({ title, data, lineColor }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const handleMouseEnter = useCallback((index: number) => {
    setHoveredIndex(index);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredIndex(null);
  }, []);

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-base font-bold text-gray-900 mb-4">{title}</h3>
        <div className="h-48 flex items-center justify-center text-gray-500">
          No data available
        </div>
      </div>
    );
  }

  const months = data.map((d) => d.month);
  const values = data.map((d) => d.circulation);

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  // Compute nice y-axis bounds
  const interval = niceInterval(maxValue - minValue || 1, 4);
  const yMin = Math.floor(minValue / interval) * interval;
  const yMax = Math.ceil(maxValue / interval) * interval;
  const yRange = yMax - yMin || 1;

  // Build tick values
  const ticks: number[] = [];
  for (let v = yMin; v <= yMax; v += interval) {
    ticks.push(Math.round(v));
  }

  const chartHeight = 220;
  const chartWidth = 535;
  const leftPad = 60; // wider to accommodate y-axis labels
  const rightPad = 20;
  const topPad = 10;
  const bottomPad = 40;
  const plotHeight = chartHeight - topPad - bottomPad;
  const plotWidth = chartWidth - leftPad - rightPad;

  // Map value → y-coordinate
  const yCoord = (val: number) =>
    topPad + plotHeight - ((val - yMin) / yRange) * plotHeight;

  // Calculate plot points
  const points = values.map((val, i) => {
    const x = leftPad + (i / Math.max(values.length - 1, 1)) * plotWidth;
    const y = yCoord(val);
    return { x, y, value: val };
  });

  const pathData = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  // Tooltip positioning helper – keep tooltip inside the SVG viewport
  const svgTotalWidth = chartWidth + 50;
  const svgTotalHeight = chartHeight + 60;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h3 className="text-base font-bold text-gray-900 mb-4">{title}</h3>
      <div className="relative bg-gray-50 rounded p-3">
        <svg
          viewBox={`0 0 ${svgTotalWidth} ${svgTotalHeight}`}
          className="w-full h-auto"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* SVG filter for tooltip drop-shadow */}
          <defs>
            <filter
              id={`tooltip-shadow-${title.replace(/\s+/g, "-")}`}
              x="-10%"
              y="-10%"
              width="130%"
              height="130%"
            >
              <feDropShadow
                dx="0"
                dy="2"
                stdDeviation="3"
                floodOpacity="0.12"
              />
            </filter>
          </defs>

          {/* Y-Axis line */}
          <line
            x1={leftPad}
            y1={topPad}
            x2={leftPad}
            y2={topPad + plotHeight}
            stroke="#374151"
            strokeWidth="2"
          />

          {/* X-Axis line */}
          <line
            x1={leftPad}
            y1={topPad + plotHeight}
            x2={leftPad + plotWidth}
            y2={topPad + plotHeight}
            stroke="#374151"
            strokeWidth="2"
          />

          {/* Grid lines + Y-Axis tick labels */}
          {ticks.map((tickVal) => {
            const y = yCoord(tickVal);
            return (
              <g key={`tick-${tickVal}`}>
                {/* Horizontal grid line */}
                <line
                  x1={leftPad}
                  y1={y}
                  x2={leftPad + plotWidth}
                  y2={y}
                  stroke="#E5E7EB"
                  strokeWidth="1"
                />
                {/* Y-axis label */}
                <text
                  x={leftPad - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="#6B7280"
                  data-testid="y-axis-label"
                >
                  {formatYLabel(tickVal)}
                </text>
              </g>
            );
          })}

          {/* Line path */}
          <path
            d={pathData}
            stroke={lineColor}
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points (circles) with hover interaction */}
          {points.map((p, i) => (
            <g
              key={`point-${i}`}
              onMouseEnter={() => handleMouseEnter(i)}
              onMouseLeave={handleMouseLeave}
              style={{ cursor: "pointer" }}
            >
              {/* Invisible larger hit area for easier hover */}
              <circle cx={p.x} cy={p.y} r="12" fill="transparent" />
              {/* Visible dot */}
              <circle
                cx={p.x}
                cy={p.y}
                r={hoveredIndex === i ? 7 : 4}
                fill={lineColor}
                stroke="white"
                strokeWidth={hoveredIndex === i ? 3 : 2}
                style={{
                  transition: "r 0.15s ease, stroke-width 0.15s ease",
                  filter:
                    hoveredIndex === i
                      ? "drop-shadow(0 0 4px rgba(0,0,0,0.25))"
                      : "none",
                }}
              />
            </g>
          ))}

          {/* Month labels */}
          {months.map((month, i) => (
            <text
              key={`label-${i}`}
              x={leftPad + (i / Math.max(months.length - 1, 1)) * plotWidth}
              y={topPad + plotHeight + 25}
              textAnchor="middle"
              fontSize="11"
              fill="#6B7280"
            >
              {month}
            </text>
          ))}

          {/* ── Hover Tooltip ────────────────────────────────────────── */}
          {hoveredIndex !== null &&
            (() => {
              const pt = points[hoveredIndex];
              const dp = data[hoveredIndex];
              const breakdown = dp.breakdown;

              // Build tooltip lines
              const lines: { label: string; value: string }[] = [];
              if (breakdown && Object.keys(breakdown).length > 0) {
                Object.entries(breakdown).forEach(([key, val]) => {
                  lines.push({ label: key, value: formatTooltipValue(val) });
                });
                lines.push({
                  label: "Total",
                  value: formatTooltipValue(dp.circulation),
                });
              } else {
                lines.push({
                  label: title,
                  value: formatTooltipValue(dp.circulation),
                });
              }

              const tooltipWidth = 185;
              const lineHeight = 18;
              const headerHeight = 24;
              const tooltipPadding = 10;
              const tooltipHeight =
                headerHeight + lines.length * lineHeight + tooltipPadding * 2;
              const arrowSize = 6;

              // Position: prefer above the point; flip below if too close to top
              let tooltipX = pt.x - tooltipWidth / 2;
              let tooltipY = pt.y - tooltipHeight - arrowSize - 8;
              let arrowDirection: "down" | "up" = "down";

              if (tooltipY < 0) {
                tooltipY = pt.y + arrowSize + 12;
                arrowDirection = "up";
              }

              // Clamp horizontal
              if (tooltipX < 4) tooltipX = 4;
              if (tooltipX + tooltipWidth > svgTotalWidth - 4)
                tooltipX = svgTotalWidth - tooltipWidth - 4;

              // Arrow x (always centered on the data point)
              const arrowX = pt.x;

              return (
                <g
                  data-testid="circulation-tooltip"
                  style={{ pointerEvents: "none" }}
                >
                  {/* Tooltip shadow */}
                  <rect
                    x={tooltipX}
                    y={tooltipY}
                    width={tooltipWidth}
                    height={tooltipHeight}
                    rx="6"
                    ry="6"
                    fill="white"
                    stroke="#D1D5DB"
                    strokeWidth="1"
                    filter={`url(#tooltip-shadow-${title.replace(/\s+/g, "-")})`}
                  />

                  {/* Arrow */}
                  {arrowDirection === "down" ? (
                    <polygon
                      points={`${arrowX - arrowSize},${tooltipY + tooltipHeight} ${arrowX + arrowSize},${tooltipY + tooltipHeight} ${arrowX},${tooltipY + tooltipHeight + arrowSize}`}
                      fill="white"
                      stroke="#D1D5DB"
                      strokeWidth="1"
                    />
                  ) : (
                    <polygon
                      points={`${arrowX - arrowSize},${tooltipY} ${arrowX + arrowSize},${tooltipY} ${arrowX},${tooltipY - arrowSize}`}
                      fill="white"
                      stroke="#D1D5DB"
                      strokeWidth="1"
                    />
                  )}
                  {/* Cover the arrow's inner border line */}
                  <line
                    x1={arrowX - arrowSize + 1}
                    y1={
                      arrowDirection === "down"
                        ? tooltipY + tooltipHeight
                        : tooltipY
                    }
                    x2={arrowX + arrowSize - 1}
                    y2={
                      arrowDirection === "down"
                        ? tooltipY + tooltipHeight
                        : tooltipY
                    }
                    stroke="white"
                    strokeWidth="2"
                  />

                  {/* Header: month label */}
                  <text
                    x={tooltipX + tooltipPadding}
                    y={tooltipY + tooltipPadding + 13}
                    fontSize="11"
                    fontWeight="bold"
                    fill="#1F2937"
                  >
                    {dp.month}
                  </text>

                  {/* Divider */}
                  <line
                    x1={tooltipX + tooltipPadding}
                    y1={tooltipY + headerHeight + tooltipPadding - 2}
                    x2={tooltipX + tooltipWidth - tooltipPadding}
                    y2={tooltipY + headerHeight + tooltipPadding - 2}
                    stroke="#E5E7EB"
                    strokeWidth="1"
                  />

                  {/* Breakdown rows */}
                  {lines.map((line, idx) => {
                    const rowY =
                      tooltipY +
                      headerHeight +
                      tooltipPadding +
                      idx * lineHeight +
                      13;
                    const isTotal = line.label === "Total";
                    return (
                      <g key={`tt-${idx}`}>
                        <text
                          x={tooltipX + tooltipPadding}
                          y={rowY}
                          fontSize="10"
                          fill={isTotal ? "#1F2937" : "#4B5563"}
                          fontWeight={isTotal ? "bold" : "normal"}
                        >
                          {line.label}:
                        </text>
                        <text
                          x={tooltipX + tooltipWidth - tooltipPadding}
                          y={rowY}
                          textAnchor="end"
                          fontSize="10"
                          fill={isTotal ? "#1F2937" : "#4B5563"}
                          fontWeight={isTotal ? "bold" : "normal"}
                        >
                          {line.value}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })()}
        </svg>
      </div>
    </div>
  );
};

// ── CirculationTrends ────────────────────────────────────────────────────────

const CirculationTrends: React.FC<CirculationTrendsProps> = ({
  selectedBranch = "System",
}) => {
  const [allData, setAllData] = useState<CirculationDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data when branch changes
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const apiUrl = import.meta.env.VITE_API_URL;
        if (!apiUrl) {
          throw new Error("API URL not configured");
        }

        const params = new URLSearchParams();
        if (selectedBranch && selectedBranch !== "System") {
          params.append("branch", selectedBranch);
        }

        const response = await fetch(
          `${apiUrl}/circulation?${params.toString()}`,
        );

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const json = await response.json();
        if (json.success && json.data?.data) {
          setAllData(json.data.data);
        } else {
          setError("Invalid response format");
        }
      } catch (err) {
        console.error("Error fetching circulation data:", err);
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedBranch]);

  // Filter data by category
  const juvenileData = useMemo(
    () => allData.filter((d) => d.category === "Juvenile"),
    [allData],
  );
  const youngAdultData = useMemo(
    () => allData.filter((d) => d.category === "Young Adult"),
    [allData],
  );
  const adultData = useMemo(
    () => allData.filter((d) => d.category === "Adult"),
    [allData],
  );
  const nonPrintData = useMemo(
    () => allData.filter((d) => d.category === "Non-Print"),
    [allData],
  );
  const totalData = useMemo(
    () => allData.filter((d) => d.category === "Total Circulation"),
    [allData],
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-200 rounded-lg h-64 animate-pulse" />
          <div className="bg-gray-200 rounded-lg h-64 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-200 rounded-lg h-64 animate-pulse" />
          <div className="bg-gray-200 rounded-lg h-64 animate-pulse" />
        </div>
        <div className="flex justify-center">
          <div className="w-full lg:w-2/3 bg-gray-200 rounded-lg h-64 animate-pulse" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <p className="font-semibold">Failed to load circulation data</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  // Empty state
  if (allData.length === 0) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-700">
        <p className="font-semibold">No data available</p>
        <p className="text-sm mt-1">
          Upload a circulation file to populate the graphs.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Row 1: Juvenile + Young Adult */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LineGraph title="Juvenile" data={juvenileData} lineColor="#0D94E8" />
        <LineGraph
          title="Young Adult"
          data={youngAdultData}
          lineColor="#38A169"
        />
      </div>

      {/* Row 2: Adult + Non-Print */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LineGraph title="Adult" data={adultData} lineColor="#8F44AD" />
        <LineGraph title="Non-Print" data={nonPrintData} lineColor="#26AEAE" />
      </div>

      {/* Row 3: Total Circulation (centered) */}
      <div className="flex justify-center">
        <div className="w-full lg:w-2/3">
          <LineGraph
            title="Total Circulation"
            data={totalData}
            lineColor="#E85940"
          />
        </div>
      </div>
    </div>
  );
};

export default CirculationTrends;
