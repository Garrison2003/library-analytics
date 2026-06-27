import React, { useState, useEffect, useCallback, useRef } from "react";
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

// ── Collapsible multi-select dropdown ────────────────────────────────────────

interface MultiSelectDropdownProps {
  label: string;
  items: string[];
  selected: string[];
  loading: boolean;
  open: boolean;
  onToggleOpen: () => void;
  onToggleItem: (item: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  placeholder: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  label,
  items,
  selected,
  loading,
  open,
  onToggleOpen,
  onToggleItem,
  onSelectAll,
  onClearAll,
  placeholder,
  containerRef,
}) => {
  const triggerLabel =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? selected[0]
        : `${selected.length} selected`;

  const triggerClass =
    "w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-left flex justify-between items-center bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {selected.length > 0 && (
          <span className="ml-2 text-xs font-normal text-blue-600">
            {selected.length} selected
          </span>
        )}
      </label>

      <button
        type="button"
        className={triggerClass}
        onClick={onToggleOpen}
        disabled={loading || (!open && items.length === 0)}
      >
        <span className={selected.length === 0 ? "text-gray-400" : "text-gray-900"}>
          {loading ? "Loading…" : items.length === 0 ? "No options available" : triggerLabel}
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && items.length > 0 && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
            <span className="text-xs text-gray-500">{items.length} options</span>
            <div className="flex gap-2 text-xs text-blue-600">
              <button type="button" className="hover:underline" onClick={onSelectAll}>
                All
              </button>
              <span className="text-gray-300">|</span>
              <button type="button" className="hover:underline" onClick={onClearAll}>
                None
              </button>
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {items.map((item) => (
              <label
                key={item}
                className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-gray-50 select-none"
              >
                <input
                  type="checkbox"
                  className="accent-blue-600"
                  checked={selected.includes(item)}
                  onChange={() => onToggleItem(item)}
                />
                <span className="text-sm text-gray-700">{item}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const ProgrammingQuery: React.FC<ProgrammingQueryProps> = ({
  branches,
  selectedBranch,
}) => {
  const [internalBranch, setInternalBranch] = useState<string>(selectedBranch);

  const [facilitatorList, setFacilitatorList] = useState<string[]>([]);
  const [loadingFacilitators, setLoadingFacilitators] = useState(false);
  const [selectedFacilitators, setSelectedFacilitators] = useState<string[]>([]);
  const [facilitatorOpen, setFacilitatorOpen] = useState(false);

  const [programNameList, setProgramNameList] = useState<string[]>([]);
  const [loadingProgramNames, setLoadingProgramNames] = useState(false);
  const [selectedProgramNames, setSelectedProgramNames] = useState<string[]>([]);
  const [programNameOpen, setProgramNameOpen] = useState(false);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [reportType, setReportType] = useState("");

  const [sessions, setSessions] = useState<ProgramSession[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasQueried, setHasQueried] = useState(false);

  const facilitatorRef = useRef<HTMLDivElement>(null);
  const programNameRef = useRef<HTMLDivElement>(null);

  const canSubmit = !!(internalBranch || selectedProgramNames.length > 0 || selectedFacilitators.length > 0);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (facilitatorRef.current && !facilitatorRef.current.contains(e.target as Node)) {
        setFacilitatorOpen(false);
      }
      if (programNameRef.current && !programNameRef.current.contains(e.target as Node)) {
        setProgramNameOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchFacilitators = useCallback(async (branchCode: string) => {
    setLoadingFacilitators(true);
    try {
      const result = await apiClient.getProgrammingFacilitators(branchCode);
      setFacilitatorList(result.success && result.data ? result.data.facilitators : []);
    } catch {
      setFacilitatorList([]);
    } finally {
      setLoadingFacilitators(false);
    }
  }, []);

  const fetchProgramNames = useCallback(async (branchCode: string) => {
    setLoadingProgramNames(true);
    try {
      const result = await apiClient.getProgrammingProgramNames(branchCode);
      setProgramNameList(result.success && result.data ? result.data.program_names : []);
    } catch {
      setProgramNameList([]);
    } finally {
      setLoadingProgramNames(false);
    }
  }, []);

  // Sync from page-level branch selector
  useEffect(() => {
    setInternalBranch(selectedBranch);
    setSelectedFacilitators([]);
    setSelectedProgramNames([]);
    setDateFrom("");
    setDateTo("");
    setReportType("");
    setFacilitatorOpen(false);
    setProgramNameOpen(false);
    setSessions(null);
    setHasQueried(false);
    setError(null);
    const code = BRANCH_NAME_TO_CODE[selectedBranch];
    if (code) {
      fetchFacilitators(code);
      fetchProgramNames(code);
    } else {
      setFacilitatorList([]);
      setProgramNameList([]);
    }
  }, [selectedBranch, fetchFacilitators, fetchProgramNames]);

  const handleBranchChange = (branch: string) => {
    setInternalBranch(branch);
    setSelectedFacilitators([]);
    setSelectedProgramNames([]);
    setDateFrom("");
    setDateTo("");
    setReportType("");
    setFacilitatorOpen(false);
    setProgramNameOpen(false);
    setSessions(null);
    setHasQueried(false);
    setError(null);
    const code = BRANCH_NAME_TO_CODE[branch];
    if (code) {
      fetchFacilitators(code);
      fetchProgramNames(code);
    } else {
      setFacilitatorList([]);
      setProgramNameList([]);
    }
  };

  // Merge + deduplicate results from parallel queries
  const mergeResults = (results: Awaited<ReturnType<typeof apiClient.getProgrammingSessions>>[]) => {
    const seen = new Set<string>();
    const merged: ProgramSession[] = [];
    for (const r of results) {
      if (r.success && r.data) {
        for (const s of r.data.sessions) {
          const key = `${s.program_date}|${s.program_name}|${s.primary_facilitator}|${s.branch_code}`;
          if (!seen.has(key)) {
            seen.add(key);
            merged.push(s);
          }
        }
      }
    }
    merged.sort((a, b) => b.program_date.localeCompare(a.program_date));
    return merged;
  };

  const handleSearch = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setHasQueried(true);
    setFacilitatorOpen(false);
    setProgramNameOpen(false);

    const branchCode = BRANCH_NAME_TO_CODE[internalBranch];
    const base: ProgramSessionFilters = {
      branch: branchCode,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      reportType: reportType || undefined,
    };

    try {
      // Build query list: N facilitators × M programs (or branch-only)
      let queryList: ProgramSessionFilters[];
      if (selectedFacilitators.length > 0 && selectedProgramNames.length > 0) {
        queryList = selectedFacilitators.flatMap((f) =>
          selectedProgramNames.map((p) => ({ ...base, facilitator: f, programName: p })),
        );
      } else if (selectedFacilitators.length > 0) {
        queryList = selectedFacilitators.map((f) => ({ ...base, facilitator: f }));
      } else if (selectedProgramNames.length > 0) {
        queryList = selectedProgramNames.map((p) => ({ ...base, programName: p }));
      } else {
        queryList = [base];
      }

      if (queryList.length === 1) {
        const result = await apiClient.getProgrammingSessions(queryList[0]);
        if (result.success && result.data) {
          setSessions(result.data.sessions);
          setTotal(result.data.count);
        } else {
          setError(result.error?.message ?? "Query failed");
          setSessions([]);
        }
      } else {
        const results = await Promise.all(
          queryList.map((f) => apiClient.getProgrammingSessions(f)),
        );
        const merged = mergeResults(results);
        setSessions(merged);
        setTotal(merged.length);
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
    setSelectedProgramNames([]);
    setDateFrom("");
    setDateTo("");
    setReportType("");
    setError(null);
    setFacilitatorOpen(false);
    setProgramNameOpen(false);
    setSessions(null);
    setTotal(0);
    setHasQueried(false);
  };

  const inputClass =
    "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

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

          {/* Facilitator collapsible multi-select */}
          <MultiSelectDropdown
            label="Facilitator"
            items={facilitatorList}
            selected={selectedFacilitators}
            loading={loadingFacilitators}
            open={facilitatorOpen}
            onToggleOpen={() => setFacilitatorOpen((o) => !o)}
            onToggleItem={(f) =>
              setSelectedFacilitators((prev) =>
                prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
              )
            }
            onSelectAll={() => setSelectedFacilitators([...facilitatorList])}
            onClearAll={() => setSelectedFacilitators([])}
            placeholder="Select facilitators…"
            containerRef={facilitatorRef}
          />

          {/* Program Name collapsible multi-select */}
          <MultiSelectDropdown
            label="Program Name"
            items={programNameList}
            selected={selectedProgramNames}
            loading={loadingProgramNames}
            open={programNameOpen}
            onToggleOpen={() => setProgramNameOpen((o) => !o)}
            onToggleItem={(p) =>
              setSelectedProgramNames((prev) =>
                prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
              )
            }
            onSelectAll={() => setSelectedProgramNames([...programNameList])}
            onClearAll={() => setSelectedProgramNames([])}
            placeholder="Select programs…"
            containerRef={programNameRef}
          />

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
              Select a branch to filter sessions.
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

      {/* Loading skeleton */}
      {loading && (
        <div className="animate-pulse space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded" />
          ))}
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
                      <td className="px-4 py-3 text-gray-900">{s.program_name}</td>
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
