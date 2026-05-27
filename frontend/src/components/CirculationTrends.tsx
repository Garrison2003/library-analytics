// src/components/CirculationTrends.tsx (UPDATED)

import React, { useEffect, useMemo, useState } from "react";
import type { CirculationDataPoint } from "../types/index";

/**
 * CirculationTrends Component (with Branch Support)
 *
 * Displays five line graphs, filtered by selected branch:
 * - Juvenile Fiction (blue)
 * - Young Adult (green)
 * - Adult (purple)
 * - Non-Print (teal)
 * - Total Circulation (coral)
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

const LineGraph: React.FC<LineGraphProps> = ({ title, data, lineColor }) => {
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
  const yMin = Math.floor((minValue - 50) / 100) * 100;
  const yMax = Math.ceil((maxValue + 50) / 100) * 100;
  const yRange = yMax - yMin;

  const chartHeight = 220;
  const chartWidth = 535;
  const leftPad = 25;
  const bottomPad = 40;

  // Calculate plot points
  const points = values.map((val, i) => {
    const x = leftPad + (i / (values.length - 1)) * (chartWidth - leftPad - 20);
    const y = chartHeight - ((val - yMin) / yRange) * (chartHeight - bottomPad);
    return { x, y, value: val };
  });

  const pathData = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h3 className="text-base font-bold text-gray-900 mb-4">{title}</h3>
      <div className="relative bg-gray-50 rounded p-3">
        <svg
          viewBox={`0 0 ${chartWidth + 50} ${chartHeight + 60}`}
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
            x2={chartWidth + 30}
            y2={chartHeight}
            stroke="#374151"
            strokeWidth="2"
          />

          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map((ratio) => (
            <line
              key={`grid-${ratio}`}
              x1={leftPad}
              y1={chartHeight - ratio * (chartHeight - bottomPad)}
              x2={chartWidth + 30}
              y2={chartHeight - ratio * (chartHeight - bottomPad)}
              stroke="#E5E7EB"
              strokeWidth="1"
            />
          ))}

          {/* Line path */}
          <path
            d={pathData}
            stroke={lineColor}
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points (circles) */}
          {points.map((p, i) => (
            <circle
              key={`point-${i}`}
              cx={p.x}
              cy={p.y}
              r="4"
              fill={lineColor}
              stroke="white"
              strokeWidth="2"
            />
          ))}

          {/* Month labels */}
          {months.map((month, i) => (
            <text
              key={`label-${i}`}
              x={
                leftPad +
                (i / (months.length - 1)) * (chartWidth - leftPad - 20)
              }
              y={chartHeight + 25}
              textAnchor="middle"
              fontSize="11"
              fill="#6B7280"
            >
              {month}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
};

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
          throw new Error(`API error: ${response.statusCode}`);
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
    () => allData.filter((d) => d.category === "Juvenile Fiction"),
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
