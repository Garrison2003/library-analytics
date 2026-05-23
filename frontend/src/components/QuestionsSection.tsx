// src/components/QuestionsSection.tsx
import React, { useState, useRef } from "react";
import { Send, Loader } from "lucide-react";

interface QuestionsProps {
  onSubmit: (question: string) => Promise<void>;
  isLoading?: boolean;
}

/**
 * QuestionsSection Component
 *
 * Provides an input area for users to ask questions about their library data.
 * Integrates with MCP server for AI-powered responses.
 *
 * Features:
 * - Text input with placeholder examples
 * - Submit button with loading state
 * - Suggested questions
 * - Question history (future enhancement)
 */
const QuestionsSection: React.FC<QuestionsProps> = ({
  onSubmit,
  isLoading = false,
}) => {
  const [question, setQuestion] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Suggested questions for users
  const suggestedQuestions: string[] = [
    "What were the circulation trends last month?",
    "Which category had the highest growth?",
    "How does Juvenile Fiction compare to Young Adult?",
    "What is the average daily circulation?",
  ];

  /**
   * Handle form submission
   */
  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    e.preventDefault();

    // Validate input
    if (!question.trim()) {
      setError("Please enter a question");
      return;
    }

    if (question.trim().length < 5) {
      setError("Question must be at least 5 characters long");
      return;
    }

    setError(null);

    try {
      await onSubmit(question.trim());
      setQuestion("");

      // Focus back on input for better UX
      if (inputRef.current) {
        inputRef.current.focus();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to submit question",
      );
    }
  };

  /**
   * Handle suggested question click
   */
  const handleSuggestedQuestion = (suggestedQuestion: string): void => {
    setQuestion(suggestedQuestion);
    setError(null);

    // Focus on input
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Input Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Text Area */}
        <div className="relative">
          <textarea
            ref={inputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Type your question here... (e.g., 'What were the circulation trends last month?' or 'Which category had the highest growth?')"
            className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors resize-none ${
              error ? "border-red-500" : "border-gray-300"
            }`}
            rows={4}
            maxLength={500}
            disabled={isLoading}
          />

          {/* Character count */}
          <div className="absolute bottom-2 right-2 text-xs text-gray-500">
            {question.length}/500
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
            {error}
          </div>
        )}

        {/* Submit button */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setQuestion("");
              setError(null);
            }}
            disabled={isLoading || !question}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Clear
          </button>

          <button
            type="submit"
            disabled={isLoading || !question.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 font-medium"
          >
            {isLoading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Asking...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Ask Question
              </>
            )}
          </button>
        </div>
      </form>

      {/* Suggested Questions */}
      {!isLoading && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-sm font-medium text-gray-700 mb-3">
            Try asking about:
          </p>

          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestedQuestion(suggestion)}
                className="text-sm px-3 py-2 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center gap-3 text-blue-600">
            <Loader className="w-5 h-5 animate-spin" />
            <span className="text-sm">
              Analyzing your data and preparing a response...
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionsSection;
