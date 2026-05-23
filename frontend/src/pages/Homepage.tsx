// src/pages/Homepage.tsx
import React, { useState } from "react";
import { Calendar, BarChart3, Upload } from "lucide-react";
import CirculationTrends from "../components/CirculationTrends";
import QuickAccessCard from "../components/QuickAccessCard";
import QuestionsSection from "../components/QuestionsSection";

interface HomepageProps {
  onMonthlyClick: () => void;
  onDailyClick: () => void;
  onUploadClick: () => void;
}

/**
 * Homepage Component
 *
 * Main landing page displaying:
 * - Hero section with welcome message
 * - Quick access navigation cards
 * - Circulation trends graphs
 * - Questions input for MCP server integration
 */
const Homepage: React.FC<HomepageProps> = ({
  onMonthlyClick,
  onDailyClick,
  onUploadClick,
}) => {
  const [isLoadingQuestion, setIsLoadingQuestion] = useState<boolean>(false);

  /**
   * Handle question submission
   * Sends question to MCP server and displays response
   */
  const handleQuestionSubmit = async (question: string): Promise<void> => {
    setIsLoadingQuestion(true);
    try {
      // TODO: Implement MCP server integration
      // const response = await mcpClient.askQuestion(question);
      // Handle response
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

      {/* Quick Access Section */}
      <section className="py-16 px-8 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">
            Quick Access
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <QuickAccessCard
              icon={<Calendar className="w-8 h-8" />}
              title="Monthly View"
              description="Analyze trends and patterns over months"
              color="blue"
              onClick={onMonthlyClick}
            />

            <QuickAccessCard
              icon={<BarChart3 className="w-8 h-8" />}
              title="Daily View"
              description="Track daily performance metrics"
              color="green"
              onClick={onDailyClick}
            />

            <QuickAccessCard
              icon={<Upload className="w-8 h-8" />}
              title="Upload File"
              description="Import your data for analysis"
              color="orange"
              onClick={onUploadClick}
            />
          </div>
        </div>
      </section>

      {/* Circulation Trends Section */}
      <section className="py-16 px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">At a Glance</h2>
          <CirculationTrends />
        </div>
      </section>

      {/* Questions Section */}
      <section className="py-16 px-8 bg-gray-50">
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
