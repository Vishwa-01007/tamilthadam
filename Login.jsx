import { useEffect, useRef, useState } from "react";
import "./Login.css";

function Login({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const googleButtonRef = useRef(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current) return undefined;
    let active = true;

    const renderGoogleButton = () => {
      if (!active || !window.google?.accounts?.id || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async ({ credential }) => {
          if (!credential) return;
          setBusy(true);
          setError("");
          try {
            const response = await fetch("/api/auth/google", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "same-origin",
              body: JSON.stringify({ credential }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Could not sign in with Google.");
            onLogin(result.user);
          } catch (requestError) {
            setError(
              requestError.message.includes("Failed to fetch")
                ? "The backend is not running yet. Start the backend, then try again."
                : requestError.message
            );
          } finally {
            setBusy(false);
          }
        },
      });
      googleButtonRef.current.replaceChildren();
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        shape: "rectangular",
        text: "continue_with",
        width: 320,
      });
    };

    let script = document.getElementById("google-identity-services");
    if (window.google?.accounts?.id) {
      renderGoogleButton();
    } else if (!script) {
      script = document.createElement("script");
      script.id = "google-identity-services";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.addEventListener("load", renderGoogleButton);
      script.addEventListener("error", () => setError("Google sign-in could not load. Check your internet connection."), { once: true });
      document.head.appendChild(script);
    } else {
      script.addEventListener("load", renderGoogleButton);
    }

    return () => {
      active = false;
      script?.removeEventListener("load", renderGoogleButton);
    };
  }, [googleClientId, onLogin]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);

    const formData = new FormData(event.currentTarget);
    const username = String(formData.get("username") || "").trim();
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");

    if (mode === "register" && password !== confirmPassword) {
      setError("The passwords do not match. Please check them and try again.");
      setBusy(false);
      return;
    }

    try {
      const response = await fetch(`/api/auth/${mode === "register" ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not sign in.");
      onLogin(result.user);
    } catch (requestError) {
      setError(
        requestError.message.includes("Failed to fetch")
          ? "The backend is not running yet. Start the backend, then try again."
          : requestError.message
      );
    } finally {
      setBusy(false);
    }
  };

  const isRegistering = mode === "register";

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo">த</div>
          <h1>TamilThadam</h1>
          <p>எழுத்திலிருந்து வாசிப்புவரை, தமிழின் தடத்தில்!</p>
        </div>

        <div className="login-content">
          <h2>{isRegistering ? "Create your account" : "Welcome to TamilThadam"}</h2>
          <p>{isRegistering ? "Save your Tamil learning journey." : "Sign in to continue your Tamil learning journey."}</p>

          <form onSubmit={handleSubmit}>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              placeholder="Enter your username"
              minLength={2}
              maxLength={40}
              autoComplete="username"
              required
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder={isRegistering ? "At least 8 characters" : "Enter your password"}
              minLength={8}
              maxLength={200}
              autoComplete={isRegistering ? "new-password" : "current-password"}
              required
            />

            {isRegistering && (
              <>
                <label htmlFor="confirmPassword">Confirm password</label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="Enter your password again"
                  minLength={8}
                  maxLength={200}
                  autoComplete="new-password"
                  required
                />
              </>
            )}

            {error && <p className="login-error" role="alert">{error}</p>}

            <button type="submit" disabled={busy}>
              {busy ? "Please wait…" : isRegistering ? "Create Account" : "Sign In"}
            </button>
          </form>

          <div className="login-divider"><span>or</span></div>
          {googleClientId ? (
            <div className="google-signin-wrap">
              <div ref={googleButtonRef} />
            </div>
          ) : (
            <p className="google-signin-setup" role="note">
              Google sign-in is ready to connect once a Google OAuth Web Client ID is added.
            </p>
          )}

          <p className="login-note">
            {isRegistering ? "Already have an account?" : "New learner?"}{" "}
            <button
              type="button"
              className="login-mode-toggle"
              onClick={() => {
                setError("");
                setMode(isRegistering ? "login" : "register");
              }}
            >
              {isRegistering ? "Sign in" : "Create an account"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
