import React from "react";

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-blue-900 text-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <p className="text-sm text-blue-200 text-center">
          © {currentYear} Library Analytics. All rights reserved.{" "}
          <span className="mx-1">|</span>
          <a href="#" className="hover:text-white transition-colors">
            Privacy Policy
          </a>
          <span className="mx-1">|</span>
          <a href="#" className="hover:text-white transition-colors">
            Terms of Service
          </a>
        </p>
      </div>
    </footer>
  );
};

export default Footer;
