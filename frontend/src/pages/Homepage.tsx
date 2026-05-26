// src/pages/Homepage.tsx
import React, { useState } from "react";
import CirculationTrends from "../components/CirculationTrends";
import ProgrammingCharts from "../components/ProgrammingCharts";
import QuestionsSection from "../components/QuestionsSection";

/**
 * Homepage Component
 *
 * Dashboard view displaying:
 * - Hero section
 * - Circulation trends (5 line graphs)
 * - Programming charts (2 bar charts)
 * - Questions input for MCP server
 *
 * Navigation to Monthly, Daily, and Upload pages
 * is handled by TabNavigation in the parent App component.
 */
const Homepage: React.FC = () => {
  const [isLoadingQuestion, setIsLoadingQuestion] = useState<boolean>(false);

  const handleQuestionSubmit = async (question: string): Promise<void> => {
    setIsLoadingQuestion(true);
    try {
      // TODO: Connect to MCP server
      console.log("Question submitted:", question);
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

      {/* Circulation Trends Section (5 Line Graphs) */}
      <section className="py-16 px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">At a Glance</h2>
          <CirculationTrends />
        </div>
      </section>

      {/* Programming Charts Section (2 Bar Charts) */}
      <section className="py-16 px-8 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Programming</h2>
          <ProgrammingCharts />
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
          />
        </div>
      </section>
    </div>
  );
};

export default Homepage;
