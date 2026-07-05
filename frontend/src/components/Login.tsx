// src/components/Login.tsx
import { useAuth0 } from "@auth0/auth0-react";
import { BarChart3 } from "lucide-react";

/**
 * Login Component
 *
 * Displays a login screen for unauthenticated users
 * Users can log in using Auth0 (supports Chrome profile/social login)
 */
const Login: React.FC = () => {
  const { loginWithRedirect } = useAuth0();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-2xl p-8">
        {/* Logo Section */}
        <div className="flex items-center justify-center mb-8">
          <BarChart3 className="w-10 h-10 text-blue-600 mr-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Library Analytics
            </h1>
            <p className="text-xs text-gray-600">Data Intelligence Platform</p>
          </div>
        </div>

        {/* Welcome Message */}
        <div className="mb-8 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Welcome Back
          </h2>
          <p className="text-gray-600">
            Sign in to access your library circulation analytics and insights
          </p>
        </div>

        {/* Login Button */}
        <button
          onClick={() => loginWithRedirect()}
          className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12.48 10.92h8.85c.20 0 .36.165.36.36v3.366c0 .203-.16.36-.36.36h-8.85c-.2 0-.36-.157-.36-.36v-3.366c0-.195.16-.36.36-.36zM12 20.064c4.4 0 8-3.6 8-8s-3.6-8-8-8-8 3.6-8 8 3.6 8 8 8zm0-14.5c3.59 0 6.5 2.91 6.5 6.5s-2.91 6.5-6.5 6.5-6.5-2.91-6.5-6.5 2.91-6.5 6.5-6.5z" />
          </svg>
          Sign in with Auth0
        </button>

        {/* Features List */}
        <div className="mt-8 pt-8 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-900 mb-4 uppercase tracking-wide">
            Features
          </p>
          <ul className="space-y-3">
            <li className="flex items-center gap-3">
              <div className="flex-shrink-0 w-5 h-5 text-blue-600">✓</div>
              <span className="text-sm text-gray-600">
                Real-time circulation tracking
              </span>
            </li>
            <li className="flex items-center gap-3">
              <div className="flex-shrink-0 w-5 h-5 text-blue-600">✓</div>
              <span className="text-sm text-gray-600">
                Visual analytics and trends
              </span>
            </li>
            <li className="flex items-center gap-3">
              <div className="flex-shrink-0 w-5 h-5 text-blue-600">✓</div>
              <span className="text-sm text-gray-600">AI-powered insights</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="flex-shrink-0 w-5 h-5 text-blue-600">✓</div>
              <span className="text-sm text-gray-600">
                Data import & management
              </span>
            </li>
          </ul>
        </div>

        {/* Security Notice */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Secured with Auth0 • Enterprise-grade security
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
