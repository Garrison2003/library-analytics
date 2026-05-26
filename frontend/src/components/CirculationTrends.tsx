// src/components/CirculationTrends.tsx
import React, { useMemo } from "react";
import type { CirculationDataPoint } from "../types/index";

/**
 * CirculationTrends Component
 *
 * Displays five line graphs:
 * - Juvenile Fiction (blue)
 * - Young Adult (green)
 * - Adult (purple)
 * - Non-Print (teal)
 * - Total Circulation (coral)
 */

interface LineGraphProps {
  title: string;
  data: CirculationDataPoint[];
  lineColor: string;
}

const LineGraph: React.FC<LineGraphProps> = ({ title, data, lineColor }) => {
  const months = data.map((d) => d.month);
  const values = data.map((d) => d.circulation);

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const yMin = Math.floor((minValue - 50) / 100) * 100;
  const yMax = Math.ceil((maxValue + 50) / 100) * 100;
  const yRange = yMax - yMin;

  const chartHeight = 220;
  const chartWidth = 535;
  const leftPad = 25;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h3 className="text-base font-bold text-gray-900 mb-4">{title}</h3>
      <div className="relative bg-gray-50 rounded p-3">
        <svg
          viewBox={`0 0 ${chartWidth + 50} ${chartHeight + 50}`}
          className="w-full h-auto"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Y-Axis */}
          <line
            x1={leftPad}
            y1="0"
            x2={leftPad}
            y2={chartHeight}
            stroke="#374151"
            strokeWidth="2"
          />
          {/* X-Axis */}
          <line
            x1={leftPad}
            y1={chartHeight}
            x2={chartWidth + leftPad}
            y2={chartHeight}
            stroke="#374151"
            strokeWidth="2"
          />

          {/* Grid lines */}
          {[0, 1, 2, 3, 4].map((i) => (
            <line
              key={`grid-${i}`}
              x1={leftPad}
              y1={(i / 4) * chartHeight}
              x2={chartWidth + leftPad}
              y2={(i / 4) * chartHeight}
              stroke="#E5E7EB"
              strokeWidth="1"
            />
          ))}

          {/* Y-Axis Labels */}
          {[0, 4].map((i) => (
            <text
              key={`y-${i}`}
              x={leftPad - 5}
              y={(i / 4) * chartHeight + 4}
              textAnchor="end"
              fontSize="9"
              fill="#9CA3AF"
            >
              {Math.round(yMax - (i / 4) * yRange)}
            </text>
          ))}

          {/* X-Axis Labels */}
          {months.map((month, i) => {
            if (i % 3 === 0) {
              const xPos = leftPad + (i / (months.length - 1)) * chartWidth;
              return (
                <text
                  key={`x-${i}`}
                  x={xPos}
                  y={chartHeight + 18}
                  textAnchor="middle"
                  fontSize="8"
                  fill="#9CA3AF"
                >
                  {month}
                </text>
              );
            }
            return null;
          })}

          {/* Lines and Points */}
          {values.map((value, i) => {
            const xPos = leftPad + (i / (values.length - 1)) * chartWidth;
            const yPos = chartHeight - ((value - yMin) / yRange) * chartHeight;
            return (
              <g key={`p-${i}`}>
                {i < values.length - 1 && (
                  <line
                    x1={xPos}
                    y1={yPos}
                    x2={leftPad + ((i + 1) / (values.length - 1)) * chartWidth}
                    y2={
                      chartHeight -
                      ((values[i + 1] - yMin) / yRange) * chartHeight
                    }
                    stroke={lineColor}
                    strokeWidth="2"
                  />
                )}
                <circle cx={xPos} cy={yPos} r="4" fill={lineColor} />
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex justify-between mt-3">
        <span className="text-xs text-gray-500">Month</span>
        <span className="text-xs text-gray-500">Circulation</span>
      </div>
    </div>
  );
};

const CirculationTrends: React.FC = () => {
  const months = [
    "May 2025",
    "Jun 2025",
    "Jul 2025",
    "Aug 2025",
    "Sep 2025",
    "Oct 2025",
    "Nov 2025",
    "Dec 2025",
    "Jan 2026",
    "Feb 2026",
    "Mar 2026",
    "Apr 2026",
  ];

  const makeData = (
    category: string,
    values: number[],
  ): CirculationDataPoint[] =>
    months.map((month, i) => ({
      category,
      month,
      year: month.includes("2025") ? 2025 : 2026,
      circulation: values[i],
    }));

  const juvenileData = useMemo(
    () =>
      makeData(
        "Juvenile Fiction",
        [600, 750, 820, 795, 880, 920, 950, 1050, 1100, 1150, 1200, 1300],
      ),
    [],
  );
  const youngAdultData = useMemo(
    () =>
      makeData(
        "Young Adult",
        [450, 580, 650, 720, 800, 850, 920, 1000, 1080, 1150, 1250, 1350],
      ),
    [],
  );
  const adultData = useMemo(
    () =>
      makeData(
        "Adult",
        [
          1200, 1350, 1400, 1320, 1450, 1500, 1550, 1620, 1700, 1750, 1800,
          1900,
        ],
      ),
    [],
  );
  const nonPrintData = useMemo(
    () =>
      makeData(
        "Non-Print",
        [200, 250, 280, 310, 350, 380, 420, 460, 500, 540, 580, 620],
      ),
    [],
  );
  const totalData = useMemo(
    () =>
      makeData(
        "Total Circulation",
        [
          2450, 2930, 3150, 3145, 3480, 3650, 3840, 4130, 4380, 4590, 4830,
          5170,
        ],
      ),
    [],
  );

  return (
    <div className="space-y-6">
      {/* Row 1: Juvenile Fiction + Young Adult */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LineGraph
          title="Juvenile Fiction"
          data={juvenileData}
          lineColor="#0D94E8"
        />
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
