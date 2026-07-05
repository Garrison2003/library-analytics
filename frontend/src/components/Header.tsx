// src/components/Header.tsx
import React from "react";
import { BarChart3, Menu } from "lucide-react";

interface HeaderProps {
  onLogoClick: () => void;
}

/**
 * Header Component
 *
 * Main navigation header with logo and branding
 */
const Header: React.FC<HeaderProps> = ({ onLogoClick }) => {
  return (
    <header className="bg-blue-900 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logo and Title */}
        <button
          onClick={onLogoClick}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <BarChart3 className="w-8 h-8" />
          <div>
            <h1 className="text-xl font-bold">Library Analytics</h1>
            <p className="text-xs text-blue-200">Powerful Library Data Management &amp; Analytics</p>
          </div>
        </button>

        {/* Navigation Links (Future) */}
        <nav className="hidden md:flex items-center gap-6">
          <a href="#" className="hover:text-blue-200 transition-colors">
            Dashboard
          </a>
          <a href="#" className="hover:text-blue-200 transition-colors">
            Analytics
          </a>
          <a href="#" className="hover:text-blue-200 transition-colors">
            Settings
          </a>
        </nav>

        {/* Mobile Menu Button (Future) */}
        <button className="md:hidden p-2 hover:bg-blue-800 rounded-lg">
          <Menu className="w-6 h-6" />
        </button>
      </div>
    </header>
  );
};

export default Header;
