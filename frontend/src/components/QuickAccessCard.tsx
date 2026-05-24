// src/components/QuickAccessCard.tsx
import React from "react";

interface QuickAccessCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: "blue" | "green" | "orange";
  onClick: () => void;
}

/**
 * QuickAccessCard Component
 *
 * Clickable card for quick navigation to main features
 */
const QuickAccessCard: React.FC<QuickAccessCardProps> = ({
  icon,
  title,
  description,
  color,
  onClick,
}) => {
  const colorClasses = {
    blue: "hover:border-blue-500 hover:bg-blue-50",
    green: "hover:border-green-500 hover:bg-green-50",
    orange: "hover:border-orange-500 hover:bg-orange-50",
  };

  const iconColorClasses = {
    blue: "text-blue-600",
    green: "text-green-600",
    orange: "text-orange-600",
  };

  const arrowColorClasses = {
    blue: "text-blue-500",
    green: "text-green-500",
    orange: "text-orange-500",
  };

  return (
    <button
      onClick={onClick}
      className={`
        w-full p-6 rounded-lg border border-gray-200 bg-white
        text-left transition-all duration-200 cursor-pointer
        ${colorClasses[color]} shadow-sm hover:shadow-md
      `}
    >
      {/* Icon */}
      <div className={`${iconColorClasses[color]} mb-4`}>{icon}</div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>

      {/* Description */}
      <p className="text-sm text-gray-600">{description}</p>

      {/* Arrow */}
      <div className={`mt-4 text-right ${arrowColorClasses[color]}`}>→</div>
    </button>
  );
};

export default QuickAccessCard;
