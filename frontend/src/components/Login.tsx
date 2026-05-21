import { useAuth0 } from "@auth0/auth0-react";
import "../styles/Login.css";

export interface UserInfo {
  email: string;
  name: string;
  picture?: string;
}

function Login() {
  const { loginWithRedirect } = useAuth0();

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Library Analytics</h1>
          <p>Sign in with your Auth0 account</p>
        </div>

        <button
          onClick={() => loginWithRedirect()}
          className="auth0-login-button"
        >
          <svg className="auth0-logo" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8m3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5m-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11m3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
          </svg>
          Sign in with Auth0
        </button>

        <div className="login-footer">
          <p>Your credentials will be securely validated through Auth0</p>
        </div>
      </div>
    </div>
  );
}

export default Login;
