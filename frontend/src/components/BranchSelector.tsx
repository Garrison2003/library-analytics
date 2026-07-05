// src/components/BranchSelector.tsx (UPDATED - Defaults to First Branch)

import React, { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

interface BranchSelectorProps {
  branches: string[];
  selectedBranch: string;
  onBranchChange: (branch: string) => void;
  isLoading?: boolean;
}

/**
 * BranchSelector Component
 *
 * Displays a scrollable dropdown to select a library branch.
 * - Default selection: First branch in the list (or "System" if empty)
 * - Scrollable list for 20+ branches
 * - Smooth selection with visual feedback
 */
const BranchSelector: React.FC<BranchSelectorProps> = ({
  branches,
  selectedBranch,
  onBranchChange,
  isLoading = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (branch: string) => {
    onBranchChange(branch);
    setIsOpen(false);
  };

  // All branches (no "System" prefix - branches are from Excel directly)
  const allOptions = branches.length > 0 ? branches : ["No branches available"];

  return (
    <div ref={dropdownRef} className="relative inline-block w-full max-w-xs">
      {/* Label */}
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        Select Branch
      </label>

      {/* Dropdown Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading || branches.length === 0}
        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg shadow-sm
                   flex items-center justify-between hover:border-blue-500 hover:shadow-md
                   transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="text-gray-900 font-medium">{selectedBranch}</span>
        <ChevronDown
          className={`w-5 h-5 text-gray-600 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300
                     rounded-lg shadow-lg z-50 overflow-hidden"
        >
          {/* Scrollable List */}
          <ul
            className="max-h-96 overflow-y-auto"
            role="listbox"
            aria-label="Branch options"
          >
            {allOptions.map((branch, index) => (
              <li key={index}>
                <button
                  onClick={() => handleSelect(branch)}
                  className={`w-full text-left px-4 py-2.5 transition-colors duration-150
                    ${
                      selectedBranch === branch
                        ? "bg-blue-100 text-blue-900 border-l-4 border-blue-600"
                        : "text-gray-700 hover:bg-gray-100 border-l-4 border-transparent"
                    }
                    focus:outline-none focus:bg-blue-50`}
                  role="option"
                  aria-selected={selectedBranch === branch}
                >
                  {branch}
                </button>
              </li>
            ))}
          </ul>

          {/* Empty State */}
          {allOptions.length === 1 &&
            allOptions[0] === "No branches available" && (
              <div className="px-4 py-3 text-center text-gray-500 text-sm">
                No branches available
              </div>
            )}
        </div>
      )}

      {/* Helper Text */}
      <p className="mt-1 text-xs text-gray-500">
        {branches.length > 0
          ? `${branches.length} branches available`
          : "Loading branches..."}
      </p>
    </div>
  );
};

export default BranchSelector;
