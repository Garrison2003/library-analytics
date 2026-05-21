import '../styles/AccessDenied.css'

function AccessDenied() {
  return (
    <div className="access-denied-container">
      <div className="access-denied-card">
        <div className="access-denied-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h1>Access Denied</h1>
        <p>Your account has not been authorized to access this application.</p>
        <p className="access-denied-sub">
          Please contact your administrator to request access.
        </p>
        <a href="/" className="access-denied-button">
          Return to Login
        </a>
      </div>
    </div>
  )
}

export default AccessDenied
