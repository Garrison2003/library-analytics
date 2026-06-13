import React, { useState, useEffect, useCallback } from "react";
import { apiClient } from "../services/api";
import type { ProgramSession, ProgramSessionFilters } from "../types/index";

// Mirrors BRANCH_NAME_TO_CODE in programmingHistoryAPI lambda
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

interface ProgrammingQueryProps {
  branches: string[];
  selectedBranch: string;
}

const ProgrammingQuery: React.FC<ProgrammingQueryProps> = ({
  branches,
  selectedBranch,
}) => {
  const [internalBranch, setInternalBranch] = useState<string>(selectedBranch);
  const [facilitatorList, setFacilitatorList] = useState<string[]>([]);
  const [loadingFacilitators, setLoadingFacilitators] =
    useState<boolean>(false);
  const [selectedFacilitators, setSelectedFacilitators] = useState<string[]>(
    [],
  );
  const [programName, setProgramName] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [reportType, setReportType] = useState<string>("");

  const [sessions, setSessions] = useState<ProgramSession[] | null>(null);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasQueried, setHasQueried] = useState<boolean>(false);

  const canSubmit = !!(internalBranch || programName.trim());

  const fetchFacilitators = useCallback(async (branchCode: string) => {
    setLoadingFacilitators(true);
    try {
      const result = await apiClient.getProgrammingFacilitators(branchCode);
      if (result.success && result.data) {
        setFacilitatorList(result.data.facilitators);
      } else {
        setFacilitatorList([]);
      }
    } catch {
      setFacilitatorList([]);
    } finally {
      setLoadingFacilitators(false);
    }
  }, []);

  // Sync branch from page-level selector
  useEffect(() => {
    setInternalBranch(selectedBranch);
    setSelectedFacilitators([]);
    setSessions(null);
    setHasQueried(false);
    const code = BRANCH_NAME_TO_CODE[selectedBranch];
    if (code) {
      fetchFacilitators(code);
    } else {
      setFacilitatorList([]);
    }
  }, [selectedBranch, fetchFacilitators]);

  const handleBranchChange = (branch: string) => {
    setInternalBranch(branch);
    setSelectedFacilitators([]);
    setSessions(null);
    setHasQueried(false);
    const code = BRANCH_NAME_TO_CODE[branch];
    if (code) {
      fetchFacilitators(code);
    } else {
      setFacilitatorList([]);
    }
  };

  const toggleFacilitator = (name: string) => {
    setSelectedFacilitators((prev) =>
      prev.includes(name) ? prev.filter((f) => f !== name) : [...prev, name],
    );
  };

  const handleSearch = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setHasQueried(true);

    const branchCode = internalBranch
      ? BRANCH_NAME_TO_CODE[internalBranch]
      : undefined;

    const baseFilters: ProgramSessionFilters = {
      branch: branchCode,
      programName: programName.trim() || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      reportType: reportType || undefined,
    };

    try {
      if (selectedFacilitators.length > 1) {
        // Parallel query per facilitator, merge + deduplicate results
        const results = await Promise.all(
          selectedFacilitators.map((f) =>
            apiClient.getProgrammingSessions({ ...baseFilters, facilitator: f }),
          ),
        );
        const seen = new Set<string>();
        const merged: ProgramSession[] = [];
        for (const result of results) {
          if (result.success && result.data) {
            for (const s of result.data.sessions) {
              const key = `${s.program_date}|${s.program_name}|${s.primary_facilitator}|${s.branch_code}`;
              if (!seen.has(key)) {
                seen.add(key);
                merged.push(s);
              }
            }
          }
        }
        merged.sort((a, b) => b.program_date.localeCompare(a.program_date));
        setSessions(merged);
        setTotal(merged.length);
      } else {
        const filters: ProgramSessionFilters = {
          ...baseFilters,
          facilitator: selectedFacilitators[0] || undefined,
        };
        const result = await apiClient.getProgrammingSessions(filters);
        if (result.success && result.data) {
          setSessions(result.data.sessions);
          setTotal(result.data.count);
        } else {
          setError(result.error?.message ?? "Query failed");
          setSessions([]);
        }
      }
    } catch {
      setError("Failed to load session data. Please try again.");
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSelectedFacilitators([]);
    setProgramName("");
    setDateFrom("");
    setDateTo("");
    setReportType("");
    setSessions(null);
    setTotal(0);
    setError(null);
    setHasQueried(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canSubmit) handleSearch();
  };

  const labelClass = "block text-sm font-medium text-gray-700 mb-1";
  const inputClass =
    "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

  return (
    <div>
      {/* Filter form */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
          {/* Branch */}
          <div>
            <label className={labelClass}>Branch</label>
            <select
              className={inputClass}
              value={internalBranch}
              onChange={(e) => handleBranchChange(e.target.value)}
            >
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Facilitator multi-select */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelClass.replace(" mb-1", "")}>
                Facilitator
                {selectedFacilitators.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-blue-600">
                    {selectedFacilitators.length} selected
                  </span>
                )}
              </label>
              {facilitatorList.length > 0 && (
                <div className="flex gap-2 text-xs text-blue-600">
                  <button
                    type="button"
                    className="hover:underline"
                    onClick={() => setSelectedFacilitators([...facilitatorList])}
                  >
                    All
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    className="hover:underline"
                    onClick={() => setSelectedFacilitators([])}
                  >
                    None
                  </button>
                </div>
              )}
            </div>
            {loadingFacilitators ? (
              <div className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-400 h-10 flex items-center">
                Loading…
              </div>
            ) : facilitatorList.length === 0 ? (
              <div className="border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-400 h-10 flex items-center">
                {internalBranch ? "No facilitators found" : "Select a branch"}
              </div>
            ) : (
              <div className="border border-gray-300 rounded-md overflow-y-auto max-h-40">
                {facilitatorList.map((f) => (
                  <label
                    key={f}
                    className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-gray-50 select-none"
                  >
                    <input
                      type="checkbox"
                      className="accent-blue-600"
                      checked={selectedFacilitators.includes(f)}
                      onChange={() => toggleFacilitator(f)}
                    />
                    <span className="text-sm text-gray-700">{f}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Program Name */}
          <div>
            <label className={labelClass}>Program Name</label>
            <input
              type="text"
              className={inputClass}
              value={programName}
              onChange={(e) => setProgramName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Exact program name"
            />
          </div>

          {/* Date From */}
          <div>
            <label className={labelClass}>Date From</label>
            <input
              type="date"
              className={inputClass}
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>

          {/* Date To */}
          <div>
            <label className={labelClass}>Date To</label>
            <input
              type="date"
              className={inputClass}
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          {/* Report Type */}
          <div>
            <label className={labelClass}>Report Type</label>
            <select
              className={inputClass}
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
            >
              <option value="">All Types</option>
              <option value="in-house">In-House</option>
              <option value="outreach">Outreach</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSearch}
            disabled={!canSubmit || loading}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Searching…" : "Search"}
          </button>
          <button
            onClick={handleClear}
            className="px-5 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
          >
            Clear
          </button>
          {!canSubmit && (
            <p className="text-sm text-amber-600">
              Select a branch or enter a program name to search.
            </p>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {hasQueried && !loading && sessions !== null && (
        <div>
          <p className="text-sm text-gray-600 mb-3">
            {total} {total === 1 ? "session" : "sessions"} found
          </p>

          {sessions.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
              No sessions found matching the selected filters.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {[
                      "Date",
                      "Program Name",
                      "Facilitator",
                      "Branch",
                      "Attendance",
                      "Programs",
                      "Type",
                      "Location",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {sessions.map((s, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                        {s.program_date}
                      </td>
                      <td className="px-4 py-3 text-gray-900">
                        {s.program_name}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                        {s.primary_facilitator}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                        {s.branch_name}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-900">
                        {s.total_attendance.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-900">
                        {s.num_programs}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            s.report_type === "outreach"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {s.report_type || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {s.outreach_site || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProgrammingQuery;
