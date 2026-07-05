import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

function LoginCallback() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Parse the authorization code from URL
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    const state = params.get("state");

    if (code && state) {
      // Auth0 SDK handles the token exchange automatically via Auth0Provider
      // Redirect to home page
      setTimeout(() => {
        navigate("/");
      }, 1000);
    }
  }, [location, navigate]);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        flexDirection: "column",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: "40px",
            height: "40px",
            border: "4px solid #667eea",
            borderTop: "4px solid transparent",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            margin: "0 auto 20px",
          }}
        ></div>
        <h2>Completing your sign in...</h2>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}

export default LoginCallback;
