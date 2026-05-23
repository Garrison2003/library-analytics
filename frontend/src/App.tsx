// src/App.tsx
import { useState } from "react";
import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import Homepage from "./pages/Homepage";
import MonthlyAnalytics from "./pages/MonthlyAnalytics";
import DailyAnalytics from "./pages/DailyAnalytics";
import Upload from "./pages/Upload";
import Header from "./components/Header";
import Footer from "./components/Footer";
import Login from "./components/Login";
import UserProfile from "./components/UserProfile";
import AccessDenied from "./components/AccessDenied";
import "./App.css";

const auth0Domain = import.meta.env.VITE_AUTH0_DOMAIN || "";
const auth0ClientId = import.meta.env.VITE_AUTH0_CLIENT_ID || "";
const auth0Audience = import.meta.env.VITE_AUTH0_AUDIENCE as string | undefined;

type Page = "home" | "monthly" | "daily" | "upload";

/**
 * AppContent Component
 *
 * Main application content that handles authentication and routing
 * Only renders the Library Analytics dashboard for authenticated users
 */
function AppContent() {
  const { isLoading, isAuthenticated, error, user } = useAuth0();
  const [currentPage, setCurrentPage] = useState<Page>("home");

  // Loading state
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

  // Error state
  if (error) {
    return <AccessDenied />;
  }

  // Unauthenticated state - show login
  if (!isAuthenticated) {
    return <Login />;
  }

  // Authenticated state - show Library Analytics dashboard
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header onLogoClick={() => setCurrentPage("home")} />

      {/* User Profile Section */}
      {user && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <UserProfile user={user} />
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-grow">
        {renderPage(currentPage, {
          setCurrentPage,
        })}
      </main>

      <Footer />
    </div>
  );

  /**
   * Render the appropriate page based on current route
   */
  function renderPage(
    page: Page,
    handlers: {
      setCurrentPage: (page: Page) => void;
    },
  ) {
    switch (page) {
      case "monthly":
        return (
          <MonthlyAnalytics
            onBackHome={() => handlers.setCurrentPage("home")}
          />
        );
      case "daily":
        return (
          <DailyAnalytics onBackHome={() => handlers.setCurrentPage("home")} />
        );
      case "upload":
        return <Upload onBackHome={() => handlers.setCurrentPage("home")} />;
      case "home":
      default:
        return (
          <Homepage
            onMonthlyClick={() => handlers.setCurrentPage("monthly")}
            onDailyClick={() => handlers.setCurrentPage("daily")}
            onUploadClick={() => handlers.setCurrentPage("upload")}
          />
        );
    }
  }
}

/**
 * App Component
 *
 * Root component that wraps the application with Auth0Provider
 * Handles all authentication configuration
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
