// src/pages/Homepage.tsx (UPDATED - Default First Branch + Better Layout)

import React, { useEffect, useState } from "react";
import { apiClient } from "../services/api";
import type { Answer } from "../types/index";
import BranchSelector from "../components/BranchSelector";
import CirculationTrends from "../components/CirculationTrends";
import QuestionsSection from "../components/QuestionsSection";

/**
 * Homepage Component (with Branch Support - Defaults to First Branch)
 *
 * Dashboard view displaying:
 * - Hero section
 * - Branch selector (dropdown with scrollable list, defaults to first branch)
 * - Circulation trends (5 line graphs, filtered by branch)
 * - Programming charts (2 bar charts - In-Person Attendance & Total Programs)
 * - Questions input for MCP server
 */
interface HomepageProps {
  onBranchChange?: (branch: string) => void;
}

const Homepage: React.FC<HomepageProps> = ({ onBranchChange }) => {
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [branches, setBranches] = useState<string[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(true);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState<boolean>(false);
  const [questionAnswer, setQuestionAnswer] = useState<Answer | null>(null);

  // Fetch available branches on mount
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const json = await apiClient.getCirculationData();
        if (json.success && json.data?.branches) {
          const branchList = json.data.branches;
          setBranches(branchList);
          const initial = branchList.length > 0 ? branchList[0] : "System";
          setSelectedBranch(initial);
          onBranchChange?.(initial);
        } else {
          setSelectedBranch("System");
          onBranchChange?.("System");
        }
      } catch (error) {
        console.error("Error fetching branches:", error);
        setSelectedBranch("System");
      } finally {
        setIsLoadingBranches(false);
      }
    };

    fetchBranches();
  }, []);

  const handleQuestionSubmit = async (question: string): Promise<void> => {
    setIsLoadingQuestion(true);
    setQuestionAnswer(null);
    try {
      const result = await apiClient.askQuestion(question);
      if (result.success && result.data) {
        setQuestionAnswer(result.data);
      }
    } catch (error) {
      console.error("Error submitting question:", error);
    } finally {
      setIsLoadingQuestion(false);
    }
  };

  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-100 to-blue-50 py-16 px-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-bold text-blue-900 mb-3">
            Welcome to Library Analytics
          </h1>
          <p className="text-gray-700 text-lg">
            Analyze your library's performance with comprehensive analytics,
            detailed reporting, and actionable insights.
          </p>
        </div>
      </section>

      {/* Branch Selector Section */}
      <section className="py-8 px-8 bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto">
          <BranchSelector
            branches={branches}
            selectedBranch={selectedBranch}
            onBranchChange={(b) => { setSelectedBranch(b); onBranchChange?.(b); }}
            isLoading={isLoadingBranches}
          />
        </div>
      </section>

      {/* Circulation Trends Section (5 Line Graphs) */}
      <section className="py-16 px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">At a Glance</h2>
          <p className="text-gray-600 mb-8">
            Circulation trends for {selectedBranch} over the last 12 months
          </p>
          <CirculationTrends selectedBranch={selectedBranch} />
        </div>
      </section>

      {/* Questions Section */}
      <section className="py-16 px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Questions</h2>
          <p className="text-gray-600 mb-6">
            Ask anything about your library data. This will be connected to an
            AI-powered MCP server.
          </p>
          <QuestionsSection
            onSubmit={handleQuestionSubmit}
            isLoading={isLoadingQuestion}
            answer={questionAnswer}
          />
        </div>
      </section>
    </div>
  );
};

export default Homepage;
