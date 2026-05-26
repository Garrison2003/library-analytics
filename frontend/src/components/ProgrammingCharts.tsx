// src/components/ProgrammingCharts.tsx
import React from "react";

/**
 * ProgrammingCharts Component
 *
 * Displays two bar charts for the fiscal year (July 1 – June 30):
 * 1. FY25-FY26 In-Person Attendance
 * 2. Total Programs FY25-FY26
 *
 * Bar labels use MM/YY format starting from 07/24 (July 2024).
 */

interface BarChartProps {
  title: string;
  data: number[];
  months: string[];
  colors: string[];
}

const BarChart: React.FC<BarChartProps> = ({ title, data, months, colors }) => {
  const maxValue = Math.max(...data);
  const chartHeight = 250;
  const chartWidth = 900;
  const barWidth = 40;
  const gap = (chartWidth - data.length * barWidth) / (data.length + 1);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-1 text-center">
        {title}
      </h3>
      <p className="text-xs text-gray-500 mb-4 text-center">
        FY25 – FY26 &nbsp;(Fiscal Year: July 1 – June 30)
      </p>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartWidth + 20} ${chartHeight + 45}`}
          className="w-full h-auto min-w-[700px]"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* X-Axis */}
          <line
            x1="10"
            y1={chartHeight}
            x2={chartWidth + 10}
            y2={chartHeight}
            stroke="#374151"
            strokeWidth="2"
          />

          {/* Bars */}
          {data.map((value, i) => {
            const barH =
              maxValue > 0 ? (value / maxValue) * (chartHeight - 30) : 0;
            const bx = 10 + gap + i * (barWidth + gap);
            const by = chartHeight - barH;

            return (
              <g key={`bar-${i}`}>
                {/* Bar */}
                <rect
                  x={bx}
                  y={by}
                  width={barWidth}
                  height={Math.max(barH, 1)}
                  fill={colors[i % colors.length]}
                  rx="2"
                />

                {/* Value label above bar */}
                <text
                  x={bx + barWidth / 2}
                  y={by - 5}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="bold"
                  fill="#374151"
                >
                  {value}
                </text>

                {/* MM/YY label below bar */}
                <text
                  x={bx + barWidth / 2}
                  y={chartHeight + 16}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="500"
                  fill="#374151"
                >
                  {months[i]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

const ProgrammingCharts: React.FC = () => {
  // MM/YY format — Fiscal year July 1 to June 30
  const barMonths = [
    "07/24",
    "08/24",
    "09/24",
    "10/24",
    "11/24",
    "12/24",
    "01/25",
    "02/25",
    "03/25",
    "04/25",
    "05/25",
    "06/25",
    "07/25",
    "08/25",
    "09/25",
    "10/25",
    "11/25",
    "12/25",
  ];

  const attendanceData = [
    340, 300, 261, 212, 235, 335, 617, 452, 566, 224, 537, 784, 758, 418, 457,
    652, 0, 0,
  ];
  const programsData = [
    52, 27, 50, 25, 23, 29, 51, 46, 61, 33, 26, 34, 44, 30, 35, 49, 0, 0,
  ];

  const barColors = [
    "#5990C8",
    "#C27D38",
    "#A6A6A6",
    "#D99933",
    "#8CBADF",
    "#599059",
    "#334D8C",
    "#337380",
    "#BF5933",
    "#738C59",
    "#4073B3",
    "#B3A633",
    "#5990C8",
    "#C27D38",
    "#A6A6A6",
    "#D99933",
    "#8CBADF",
    "#599059",
  ];

  return (
    <div className="space-y-6">
      <BarChart
        title="In-Person Attendance"
        data={attendanceData}
        months={barMonths}
        colors={barColors}
      />
      <BarChart
        title="Total Programs"
        data={programsData}
        months={barMonths}
        colors={barColors}
      />
    </div>
  );
};

export default ProgrammingCharts;
