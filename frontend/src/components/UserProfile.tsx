import { useAuth0 } from '@auth0/auth0-react'
import '../styles/UserProfile.css'

interface UserProfileProps {
  user: any
}

function UserProfile({ user }: UserProfileProps) {
  const { logout } = useAuth0()

  const handleLogout = () => {
    logout({ logoutParams: { returnTo: window.location.origin } })
  }

  if (!user) return null

  return (
    <div className="user-profile">
      <div className="profile-card">
        {user.picture && (
          <img src={user.picture} alt={user.name} className="profile-picture" />
        )}
        <div className="profile-info">
          <h2>{user.name}</h2>
          <p>{user.email}</p>
        </div>
        <button onClick={handleLogout} className="logout-button">
          Logout
        </button>
      </div>
    </div>
  )
}

export default UserProfile
