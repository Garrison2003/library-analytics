// src/components/TabNavigation.tsx
import React from "react";

export type TabId = "dashboard" | "monthly" | "daily" | "upload";

interface Tab {
  id: TabId;
  label: string;
}

interface TabNavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const tabs: Tab[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "monthly", label: "Monthly View" },
  { id: "daily", label: "Daily View" },
  { id: "upload", label: "Upload" },
];

/**
 * TabNavigation Component
 *
 * Horizontal tab bar for navigating between pages.
 * Replaces the previous Quick Access cards.
 */
const TabNavigation: React.FC<TabNavigationProps> = ({
  activeTab,
  onTabChange,
}) => {
  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-8">
        <div className="flex gap-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`
                  relative px-5 py-4 text-sm font-medium transition-colors duration-200
                  ${
                    isActive
                      ? "text-blue-600"
                      : "text-gray-500 hover:text-gray-700"
                  }
                `}
              >
                {tab.label}

                {/* Active indicator */}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-blue-600 rounded-t" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default TabNavigation;
