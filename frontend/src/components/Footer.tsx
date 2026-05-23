// src/components/Footer.tsx
import React from "react";

/**
 * Footer Component
 *
 * Application footer with copyright and links
 */
const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-blue-900 text-white mt-16">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          {/* Copyright */}
          <p className="text-sm text-blue-200">
            © {currentYear} Library Analytics. All rights reserved.
          </p>

          {/* Footer Links */}
          <div className="flex gap-6 text-sm">
            <a
              href="#"
              className="text-blue-200 hover:text-white transition-colors"
            >
              Privacy Policy
            </a>
            <a
              href="#"
              className="text-blue-200 hover:text-white transition-colors"
            >
              Terms of Service
            </a>
            <a
              href="#"
              className="text-blue-200 hover:text-white transition-colors"
            >
              Contact Support
            </a>
            <a
              href="#"
              className="text-blue-200 hover:text-white transition-colors"
            >
              Documentation
            </a>
          </div>
        </div>

        {/* Version Info */}
        <div className="mt-4 pt-4 border-t border-blue-800">
          <p className="text-xs text-blue-200 text-center">
            Version 1.0.0 | Last Updated: May 2025
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
