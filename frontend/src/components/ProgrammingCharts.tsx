// src/components/ProgrammingCharts.tsx
import React, { useEffect, useState } from "react";

/**
 * ProgrammingCharts Component
 *
 * Displays two bar charts for programming statistics:
 * 1. In-Person Attendance
 * 2. Total Programs
 *
 * Fetches data from /programming API based on selectedBranch.
 * Shows "No current data for {branch}" if no data available.
 */

interface ProgrammingData {
  branch: string;
  branchName: string;
  months: string[];
  attendance: number[];
  programs: number[];
  dataFound: boolean;
  lastUpdated: string;
}

function fiscalYearSubtitle(): string {
  const now = new Date();
  // July (month index 6) starts a new fiscal year
  const currentFYEnd = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
  const prevFYEnd = currentFYEnd - 1;
  return `FY${String(prevFYEnd).slice(-2)} – FY${String(currentFYEnd).slice(-2)}`;
}

interface BarChartProps {
  title: string;
  data: number[];
  months: string[];
  colors: string[];
  noDataMessage?: string;
}

const BarChart: React.FC<BarChartProps> = ({
  title,
  data,
  months,
  colors,
  noDataMessage,
}) => {
  // Show no-data state
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-1 text-center">
          {title}
        </h3>
        <p className="text-xs text-gray-500 mb-4 text-center">
          {fiscalYearSubtitle()} &nbsp;(Fiscal Year: July 1 – June 30)
        </p>
        <div className="h-64 flex items-center justify-center text-gray-400">
          {noDataMessage || "No data available"}
        </div>
      </div>
    );
  }

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
        {fiscalYearSubtitle()} &nbsp;(Fiscal Year: July 1 – June 30)
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

// Mirrors BRANCH_CODE_MAP in programming_lambda.py
const BRANCH_NAME_TO_CODE: Record<string, string> = {
  Imaginon: "IMG",
  Main: "MAI",
  "Plaza Midwood": "PLZ",
  Northlake: "NOR",
  Charlotte: "CHS",
  Spangler: "SPA",
  Carmel: "CAR",
  Community: "COM",
  East: "EAS",
  West: "WES",
};

interface ProgrammingChartsProps {
  selectedBranch?: string;
}

const ProgrammingCharts: React.FC<ProgrammingChartsProps> = ({
  selectedBranch = "",
}) => {
  const [data, setData] = useState<ProgrammingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    const fetchProgrammingData = async () => {
      if (!selectedBranch) {
        setData(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const apiUrl = import.meta.env.VITE_API_URL;
        if (!apiUrl) {
          setError("API URL not configured");
          setLoading(false);
          return;
        }

        // Extract 3-letter branch code (e.g., "Imaginon" → "IMG")
        // For now, we'll pass the branch as-is; the backend expects the code
        const branchCode = BRANCH_NAME_TO_CODE[selectedBranch] ?? selectedBranch;

        const response = await fetch(
          `${apiUrl}/programming?branch=${encodeURIComponent(branchCode)}`,
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const json = await response.json();
        if (json.success && json.data) {
          setData(json.data);
        } else {
          setError(json.error?.message || "Failed to fetch data");
        }
      } catch (err) {
        console.error("Error fetching programming data:", err);
        setError("Failed to load programming data");
      } finally {
        setLoading(false);
      }
    };

    fetchProgrammingData();
  }, [selectedBranch]);

  // Determine no-data message
  const noDataMessage =
    data && !data.dataFound
      ? `No current data for ${data.branchName || selectedBranch}`
      : "Loading...";

  // Show loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 h-96 flex items-center justify-center">
          <div className="text-gray-500">Loading programming data...</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6 h-96 flex items-center justify-center">
          <div className="text-gray-500">Loading programming data...</div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-red-200 p-6">
          <p className="text-red-600">Error: {error}</p>
        </div>
      </div>
    );
  }

  // Render charts
  return (
    <div className="space-y-6">
      <BarChart
        title="In-Person Attendance"
        data={data?.attendance || []}
        months={data?.months || []}
        colors={barColors}
        noDataMessage={noDataMessage}
      />
      <BarChart
        title="Total Programs"
        data={data?.programs || []}
        months={data?.months || []}
        colors={barColors}
        noDataMessage={noDataMessage}
      />
    </div>
  );
};

export default ProgrammingCharts;
