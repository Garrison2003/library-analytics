// src/components/CirculationTrends.tsx
import React, { useMemo } from "react";
import type { CirculationDataPoint } from "../types/index";

/**
 * CirculationTrends Component
 *
 * Displays two line graphs showing circulation trends for:
 * - Juvenile Fiction (blue line)
 * - Young Adult (green line)
 *
 * X-Axis: 12 months (May 2025 - April 2026)
 * Y-Axis: Circulation numbers (400-1400)
 */
const CirculationTrends: React.FC = () => {
  // Sample data for Juvenile Fiction
  const juvenileData: CirculationDataPoint[] = useMemo(
    () => [
      {
        category: "Juvenile Fiction",
        month: "May 2025",
        year: 2025,
        circulation: 600,
      },
      {
        category: "Juvenile Fiction",
        month: "Jun 2025",
        year: 2025,
        circulation: 750,
      },
      {
        category: "Juvenile Fiction",
        month: "Jul 2025",
        year: 2025,
        circulation: 820,
      },
      {
        category: "Juvenile Fiction",
        month: "Aug 2025",
        year: 2025,
        circulation: 795,
      },
      {
        category: "Juvenile Fiction",
        month: "Sep 2025",
        year: 2025,
        circulation: 880,
      },
      {
        category: "Juvenile Fiction",
        month: "Oct 2025",
        year: 2025,
        circulation: 920,
      },
      {
        category: "Juvenile Fiction",
        month: "Nov 2025",
        year: 2025,
        circulation: 950,
      },
      {
        category: "Juvenile Fiction",
        month: "Dec 2025",
        year: 2025,
        circulation: 1050,
      },
      {
        category: "Juvenile Fiction",
        month: "Jan 2026",
        year: 2026,
        circulation: 1100,
      },
      {
        category: "Juvenile Fiction",
        month: "Feb 2026",
        year: 2026,
        circulation: 1150,
      },
      {
        category: "Juvenile Fiction",
        month: "Mar 2026",
        year: 2026,
        circulation: 1200,
      },
      {
        category: "Juvenile Fiction",
        month: "Apr 2026",
        year: 2026,
        circulation: 1300,
      },
    ],
    [],
  );

  // Sample data for Young Adult
  const youngAdultData: CirculationDataPoint[] = useMemo(
    () => [
      {
        category: "Young Adult",
        month: "May 2025",
        year: 2025,
        circulation: 450,
      },
      {
        category: "Young Adult",
        month: "Jun 2025",
        year: 2025,
        circulation: 580,
      },
      {
        category: "Young Adult",
        month: "Jul 2025",
        year: 2025,
        circulation: 650,
      },
      {
        category: "Young Adult",
        month: "Aug 2025",
        year: 2025,
        circulation: 720,
      },
      {
        category: "Young Adult",
        month: "Sep 2025",
        year: 2025,
        circulation: 800,
      },
      {
        category: "Young Adult",
        month: "Oct 2025",
        year: 2025,
        circulation: 850,
      },
      {
        category: "Young Adult",
        month: "Nov 2025",
        year: 2025,
        circulation: 920,
      },
      {
        category: "Young Adult",
        month: "Dec 2025",
        year: 2025,
        circulation: 1000,
      },
      {
        category: "Young Adult",
        month: "Jan 2026",
        year: 2026,
        circulation: 1080,
      },
      {
        category: "Young Adult",
        month: "Feb 2026",
        year: 2026,
        circulation: 1150,
      },
      {
        category: "Young Adult",
        month: "Mar 2026",
        year: 2026,
        circulation: 1250,
      },
      {
        category: "Young Adult",
        month: "Apr 2026",
        year: 2026,
        circulation: 1350,
      },
    ],
    [],
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Juvenile Fiction Graph */}
      <LineGraph
        title="Juvenile Fiction"
        data={juvenileData}
        lineColor="#0D94E8"
      />

      {/* Young Adult Graph */}
      <LineGraph
        title="Young Adult"
        data={youngAdultData}
        lineColor="#38A169"
      />
    </div>
  );
};

/**
 * LineGraph Component - Internal
 * Renders a single line graph with circulation data
 */
interface LineGraphProps {
  title: string;
  data: CirculationDataPoint[];
  lineColor: string;
}

const LineGraph: React.FC<LineGraphProps> = ({ title, data, lineColor }) => {
  const months = data.map((d) => d.month);
  const values = data.map((d) => d.circulation);

  // Calculate Y-axis range
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const yMin = Math.floor((minValue - 50) / 100) * 100;
  const yMax = Math.ceil((maxValue + 50) / 100) * 100;
  const yRange = yMax - yMin;

  // Chart dimensions
  const chartHeight = 250;
  const chartWidth = 570;
  const yAxisStart = 30;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-6">{title}</h3>

      {/* Chart Container */}
      <div className="relative bg-gray-50 rounded p-4">
        <svg
          viewBox={`0 0 ${chartWidth + 60} ${chartHeight + 60}`}
          className="w-full h-auto"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Y-Axis */}
          <line
            x1={yAxisStart}
            y1="0"
            x2={yAxisStart}
            y2={chartHeight}
            stroke="#1F2937"
            strokeWidth="2"
          />

          {/* X-Axis */}
          <line
            x1={yAxisStart}
            y1={chartHeight}
            x2={chartWidth + yAxisStart}
            y2={chartHeight}
            stroke="#1F2937"
            strokeWidth="2"
          />

          {/* Grid lines */}
          {[0, 1, 2, 3, 4].map((i) => {
            const yPos = (i / 4) * chartHeight;
            return (
              <line
                key={`grid-${i}`}
                x1={yAxisStart}
                y1={yPos}
                x2={chartWidth + yAxisStart}
                y2={yPos}
                stroke="#E5E7EB"
                strokeWidth="1"
              />
            );
          })}

          {/* Y-Axis Labels */}
          {[0, 4].map((i) => {
            const yPos = (i / 4) * chartHeight;
            const value = yMax - (i / 4) * yRange;
            return (
              <text
                key={`y-label-${i}`}
                x={yAxisStart - 5}
                y={yPos + 5}
                textAnchor="end"
                fontSize="10"
                fill="#6B7280"
              >
                {Math.round(value)}
              </text>
            );
          })}

          {/* X-Axis Labels */}
          {months.map((month, i) => {
            if (i % 2 === 0) {
              const xPos = yAxisStart + (i / (months.length - 1)) * chartWidth;
              return (
                <text
                  key={`x-label-${i}`}
                  x={xPos}
                  y={chartHeight + 20}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#6B7280"
                >
                  {month}
                </text>
              );
            }
            return null;
          })}

          {/* Data points and connecting lines */}
          {values.map((value, i) => {
            const xPos = yAxisStart + (i / (values.length - 1)) * chartWidth;
            const normalizedY = (value - yMin) / yRange;
            const yPos = chartHeight - normalizedY * chartHeight;

            return (
              <g key={`point-${i}`}>
                {/* Connecting line to next point */}
                {i < values.length - 1 && (
                  <line
                    x1={xPos}
                    y1={yPos}
                    x2={
                      yAxisStart + ((i + 1) / (values.length - 1)) * chartWidth
                    }
                    y2={
                      chartHeight -
                      ((values[i + 1] - yMin) / yRange) * chartHeight
                    }
                    stroke={lineColor}
                    strokeWidth="2"
                  />
                )}

                {/* Data point circle */}
                <circle cx={xPos} cy={yPos} r="4" fill={lineColor} />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Axis Labels */}
      <div className="flex justify-between mt-4">
        <div className="text-xs text-gray-600">Month</div>
        <div className="text-xs text-gray-600">Circulation</div>
      </div>
    </div>
  );
};

export default CirculationTrends;
