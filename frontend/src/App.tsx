// src/App.tsx
import { useState } from "react";
import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import { apiClient } from "./services/api";
import Homepage from "./pages/Homepage";
import MonthlyAnalytics from "./pages/MonthlyAnalytics";
import DailyAnalytics from "./pages/DailyAnalytics";
import Programming from "./pages/Programming";
import Upload from "./components/Upload";
import Header from "./components/Header";
import Footer from "./components/Footer";
import TabNavigation from "./components/TabNavigation";
import Login from "./components/Login";
import UserProfile from "./components/UserProfile";
import AccessDenied from "./components/AccessDenied";
import type { TabId } from "./components/TabNavigation";
import "./App.css";

const auth0Domain = import.meta.env.VITE_AUTH0_DOMAIN || "";
const auth0ClientId = import.meta.env.VITE_AUTH0_CLIENT_ID || "";
const auth0Audience = import.meta.env.VITE_AUTH0_AUDIENCE as string | undefined;

/**
 * AppContent Component
 *
 * Handles authentication states and tab-based page routing.
 * Navigation is via a horizontal tab bar (Dashboard, Monthly, Daily, Upload).
 */
function AppContent() {
  const { isLoading, isAuthenticated, error, user, getAccessTokenSilently } = useAuth0();
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [sharedBranch, setSharedBranch] = useState<string>("");

  // Must be set in render (not useEffect) so children's useEffect hooks see it on first mount.
  if (isAuthenticated) {
    apiClient.setTokenGetter(() =>
      getAccessTokenSilently({
        authorizationParams: { audience: auth0Audience },
      }),
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="mb-4">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
          <p className="text-gray-600">Loading Library Analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return <AccessDenied />;
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  /**
   * Handle tab changes — scroll to top on navigation
   */
  const handleTabChange = (tab: TabId): void => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /**
   * Render page content based on active tab
   */
  const renderPage = (): React.ReactNode => {
    switch (activeTab) {
      case "monthly":
        return (
          <MonthlyAnalytics
            onBackHome={() => handleTabChange("dashboard")}
            initialBranch={sharedBranch}
            onBranchChange={setSharedBranch}
          />
        );
      case "daily":
        return (
          <DailyAnalytics onBackHome={() => handleTabChange("dashboard")} />
        );
      case "programming":
        return <Programming initialBranch={sharedBranch} onBranchChange={setSharedBranch} />;
      case "upload":
        return <Upload onBackHome={() => handleTabChange("dashboard")} />;
      case "dashboard":
      default:
        return <Homepage initialBranch={sharedBranch} onBranchChange={setSharedBranch} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header onLogoClick={() => handleTabChange("dashboard")} />

      {/* User Profile Bar */}
      {user && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <UserProfile user={user} />
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Main Content */}
      <main className="flex-grow">{renderPage()}</main>

      <Footer />
    </div>
  );
}

/**
 * App Component — Root with Auth0Provider
 */
function App() {
  return (
    <Auth0Provider
      domain={auth0Domain}
      clientId={auth0ClientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        ...(auth0Audience && { audience: auth0Audience }),
        scope: "openid profile email",
      }}
    >
      <AppContent />
    </Auth0Provider>
  );
}

export default App;
