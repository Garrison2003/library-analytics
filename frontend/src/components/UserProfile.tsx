// src/components/UserProfile.tsx
import { useAuth0 } from "@auth0/auth0-react";
import { User, LogOut } from "lucide-react";

interface UserProfileProps {
  user?: {
    name?: string;
    email?: string;
    picture?: string;
    sub?: string;
  };
}

/**
 * UserProfile Component
 *
 * Displays the authenticated user's profile information
 * Shows user avatar, name, email, and logout button
 */
const UserProfile: React.FC<UserProfileProps> = ({ user }) => {
  const { logout } = useAuth0();

  if (!user) {
    return null;
  }

  return (
    <div className="flex items-center justify-between py-3 px-4">
      {/* User Info */}
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {user.picture ? (
            <img
              src={user.picture}
              alt={user.name || "User"}
              className="h-10 w-10 rounded-full border-2 border-gray-200"
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
              <User className="w-6 h-6 text-blue-600" />
            </div>
          )}
        </div>

        {/* User Details */}
        <div>
          <p className="text-sm font-medium text-gray-900">
            {user.name || "User"}
          </p>
          <p className="text-xs text-gray-500">{user.email || "No email"}</p>
        </div>
      </div>

      {/* Logout Button */}
      <button
        onClick={() =>
          logout({
            logoutParams: {
              returnTo: window.location.origin,
            },
          })
        }
        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
      >
        <LogOut className="w-4 h-4" />
        Logout
      </button>
    </div>
  );
};

export default UserProfile;
