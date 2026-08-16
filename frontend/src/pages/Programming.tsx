import React, { useEffect, useState } from "react";
import { apiClient } from "../services/api";
import type { Answer } from "../types/index";
import BranchSelector from "../components/BranchSelector";
import ProgrammingCharts from "../components/ProgrammingCharts";
import ProgrammingQuery from "../components/ProgrammingQuery";
import ProgrammingStatsTable from "../components/ProgrammingStatsTable";
import QuestionsSection from "../components/QuestionsSection";

interface ProgrammingProps {
  initialBranch?: string;
  onBranchChange?: (branch: string) => void;
}

const Programming: React.FC<ProgrammingProps> = ({ initialBranch = "", onBranchChange }) => {
  const [selectedBranch, setSelectedBranch] = useState<string>(initialBranch);
  const [branches, setBranches] = useState<string[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(true);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState<boolean>(false);
  const [questionAnswer, setQuestionAnswer] = useState<Answer | null>(null);

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const json = await apiClient.getCirculationData();
        if (json.success && json.data?.branches) {
          const branchList = json.data.branches;
          setBranches(branchList);
          const preferred = initialBranch && branchList.includes(initialBranch)
            ? initialBranch
            : (branchList.length > 0 ? branchList[0] : "System");
          setSelectedBranch(preferred);
          onBranchChange?.(preferred);
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
          <h1 className="text-4xl font-bold text-blue-900 mb-3">Programming</h1>
          <p className="text-gray-700 text-lg">
            Explore programming attendance and event totals across branches.
          </p>
        </div>
      </section>

      {/* Branch Selector */}
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

      {/* Programming Charts */}
      <section className="py-16 px-8 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">
            Programming for {selectedBranch}
          </h2>
          <div className="space-y-8">
            <ProgrammingCharts selectedBranch={selectedBranch} />
          </div>
        </div>
      </section>

      {/* Monthly Stats Table */}
      <section className="py-12 px-8 bg-white border-t border-gray-200">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Monthly Stats
          </h2>
          <p className="text-gray-600 mb-6">
            Month-by-month attendance and programs for {selectedBranch}. Arrows
            show change vs. the prior month.
          </p>
          <ProgrammingStatsTable selectedBranch={selectedBranch} />
        </div>
      </section>

      {/* Query Sessions */}
      <section className="py-16 px-8 bg-gray-50 border-t border-gray-200">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Query Sessions
          </h2>
          <p className="text-gray-600 mb-6">
            Search individual program sessions by branch, facilitator, program
            name, date range, or report type.
          </p>
          <ProgrammingQuery branches={branches} selectedBranch={selectedBranch} />
        </div>
      </section>

      {/* Questions Section */}
      <section className="py-16 px-8 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Questions</h2>
          <p className="text-gray-600 mb-6">
            Ask anything about programming data. This will be answered by an
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

export default Programming;
