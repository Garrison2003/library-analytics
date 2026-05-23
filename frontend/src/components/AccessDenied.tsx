// src/components/AccessDenied.tsx
import { AlertCircle } from "lucide-react";

/**
 * AccessDenied Component
 * 
 * Displays an error message when authentication fails
 * or when there is an issue with the Auth0 configuration
 */
const AccessDenied: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-2xl p-8">
        {/* Error Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
        </div>

        {/* Error Message */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Access Denied
          </h1>
          <p className="text-gray-600 mb-6">
            We encountered an issue during authentication. Please check your Auth0 configuration or try again.
          </p>
        </div>

        {/* Troubleshooting Steps */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Troubleshooting:
          </h2>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex gap-2">
              <span className="text-red-600 font-bold">1.</span>
              <span>Verify VITE_AUTH0_DOMAIN is set correctly</span>
            </li>
            <li className="flex gap-2">
              <span className="text-red-600 font-bold">2.</span>
              <span>Verify VITE_AUTH0_CLIENT_ID is set correctly</span>
            </li>
            <li className="flex gap-2">
              <span className="text-red-600 font-bold">3.</span>
              <span>Check Auth0 dashboard for allowed callback URLs</span>
            </li>
            <li className="flex gap-2">
              <span className="text-red-600 font-bold">4.</span>
              <span>Ensure your network connection is stable</span>
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => window.location.reload()}
            className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            Try Again
          </button>
          <button
            onClick={() => (window.location.href = "/")}
            className="w-full px-4 py-2 bg-gray-100 text-gray-900 font-medium rounded-lg hover:bg-gray-200 transition-colors duration-200"
          >
            Go Home
          </button>
        </div>

        {/* Help Text */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Need help?{" "}
            <a
              href="https://auth0.com/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              View Auth0 documentation
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AccessDenied;
