import React, { useEffect, useState } from "react";
import { apiClient } from "../services/api";

const BRANCH_NAME_TO_CODE: Record<string, string> = {
  "Allegra Westbrooks Regional": "ALW",
  Carmel: "CAR",
  Charlotte: "CHS",
  Community: "COM",
  Cornelius: "COR",
  Davidson: "DAV",
  East: "EAS",
  "Hickory Grove": "HCG",
  Imaginon: "IMG",
  "Independence Regional": "INR",
  "Library Admin Center": "LAC",
  Main: "MAI",
  "Main - Founders Hall": "MAI",
  "Main Founders Hall": "MAI",
  Matthews: "MAT",
  "Mint Hill": "MNH",
  "Mobile Library": "MOB",
  "Mountain Island": "MTI",
  "Myers Park": "MYP",
  "North County Regional": "NCR",
  Northlake: "NOR",
  Pineville: "PIN",
  "Plaza Midwood": "PLZ",
  "Plaza-Midwood": "PLZ",
  "South Boulevard": "SBL",
  "South County Regional": "SCR",
  "Sugar Creek": "SGC",
  Spangler: "SPA",
  "SouthPark Regional": "SPK",
  "SouthPark Regional Library": "SPK",
  "Steele Creek": "STC",
  "University City Regional": "UCR",
  "West Boulevard": "WBL",
  West: "WES",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const FETCH_MONTHS = 60;
const DEFAULT_VISIBLE = 24;

interface RawDataItem {
  year_month: string;
  attendance: number;
  programs: number;
  virtual_attendance: number;
}

interface DataRow extends RawDataItem {
  year: number;
  month: number;
  monthLabel: string;
  programsDelta: number | null;
  attendanceDelta: number | null;
}

function isAdjacentMonth(current: string, prev: string): boolean {
  const [cy, cm] = current.split("-").map(Number);
  const [py, pm] = prev.split("-").map(Number);
  if (cy === py) return cm - pm === 1;
  return cy - py === 1 && cm === 1 && pm === 12;
}

const DeltaBadge: React.FC<{ value: number | null }> = ({ value }) => {
  if (value === null) return <span className="text-gray-300">—</span>;
  if (value === 0) return <span className="text-gray-400 text-xs">0</span>;
  const positive = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${positive ? "text-green-600" : "text-red-500"}`}
    >
      {positive ? "↑" : "↓"} {Math.abs(value).toLocaleString()}
    </span>
  );
};

interface ProgrammingStatsTableProps {
  selectedBranch: string;
}

const ProgrammingStatsTable: React.FC<ProgrammingStatsTableProps> = ({
  selectedBranch,
}) => {
  const [rows, setRows] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [showVirtual, setShowVirtual] = useState(false);

  useEffect(() => {
    if (!selectedBranch) return;
    const branchCode = BRANCH_NAME_TO_CODE[selectedBranch];
    if (!branchCode) {
      setRows([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    apiClient
      .getProgrammingData(branchCode, FETCH_MONTHS)
      .then((result) => {
        if (cancelled) return;
        const raw: RawDataItem[] = result?.data?.data ?? [];
        const parsed: DataRow[] = raw.map((item, i) => {
          const prev = raw[i + 1];
          const adjacent = prev ? isAdjacentMonth(item.year_month, prev.year_month) : false;
          const [yearStr, monthStr] = item.year_month.split("-");
          return {
            ...item,
            year: parseInt(yearStr, 10),
            month: parseInt(monthStr, 10),
            monthLabel: MONTH_NAMES[parseInt(monthStr, 10) - 1],
            programsDelta: adjacent ? item.programs - prev.programs : null,
            attendanceDelta: adjacent ? item.attendance - prev.attendance : null,
          };
        });
        setRows(parsed);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load monthly stats.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedBranch]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-8 bg-gray-100 rounded animate-pulse"
            style={{ opacity: 1 - i * 0.12 }}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-red-500 text-sm">{error}</p>;
  }

  if (rows.length === 0) {
    return (
      <p className="text-gray-400 text-sm">
        No monthly data available for {selectedBranch}.
      </p>
    );
  }

  const visibleRows = showAll ? rows : rows.slice(0, DEFAULT_VISIBLE);

  // Group visible rows by year (newest year first)
  const yearMap: Record<number, DataRow[]> = {};
  for (const row of visibleRows) {
    if (!yearMap[row.year]) yearMap[row.year] = [];
    yearMap[row.year].push(row);
  }
  const years = Object.keys(yearMap)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setShowVirtual((v) => !v)}
          className="text-xs text-blue-600 hover:text-blue-800 underline"
        >
          {showVirtual ? "Hide" : "Show"} Virtual Attendance
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-2.5 font-semibold text-gray-700 w-36">
                Month
              </th>
              <th className="text-right px-4 py-2.5 font-semibold text-gray-700">
                Attendance
              </th>
              <th className="text-right px-4 py-2.5 font-semibold text-gray-700">
                Programs
              </th>
              {showVirtual && (
                <th className="text-right px-4 py-2.5 font-semibold text-gray-700">
                  Virtual
                </th>
              )}
              <th className="text-right px-4 py-2.5 font-semibold text-gray-700">
                Δ Programs
              </th>
              <th className="text-right px-4 py-2.5 font-semibold text-gray-700">
                Δ Attendance
              </th>
            </tr>
          </thead>
          <tbody>
            {years.map((year) => (
              <React.Fragment key={year}>
                <tr className="bg-blue-50 border-y border-blue-100">
                  <td
                    colSpan={showVirtual ? 6 : 5}
                    className="px-4 py-1.5 text-xs font-bold text-blue-700 tracking-wide uppercase"
                  >
                    {year}
                  </td>
                </tr>
                {yearMap[year].map((row) => (
                  <tr
                    key={row.year_month}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-2 text-gray-700">{row.monthLabel}</td>
                    <td className="px-4 py-2 text-right text-gray-900 tabular-nums">
                      {row.attendance.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-900 tabular-nums">
                      {row.programs.toLocaleString()}
                    </td>
                    {showVirtual && (
                      <td className="px-4 py-2 text-right text-gray-900 tabular-nums">
                        {row.virtual_attendance.toLocaleString()}
                      </td>
                    )}
                    <td className="px-4 py-2 text-right">
                      <DeltaBadge value={row.programsDelta} />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <DeltaBadge value={row.attendanceDelta} />
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length > DEFAULT_VISIBLE && (
        <button
          onClick={() => setShowAll((s) => !s)}
          className="mt-3 text-xs text-blue-600 hover:text-blue-800 underline"
        >
          {showAll
            ? `Show less (last ${DEFAULT_VISIBLE} months)`
            : `Show all ${rows.length} months`}
        </button>
      )}
    </div>
  );
};

export default ProgrammingStatsTable;
