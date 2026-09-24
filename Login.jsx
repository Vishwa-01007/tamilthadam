import { useState } from "react";
import "./Login.css";

function Login({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const isRegistering = mode === "register";

  const submit = async (path, payload, genericError) => {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const response = await fetch(`/api/auth/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || genericError);
      return result;
    } catch (requestError) {
      setError(
        requestError.message.includes("Failed to fetch")
          ? "The sign-in service could not be reached. Please try again shortly."
          : requestError.message
      );
      return null;
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLocaleLowerCase();
    setEmail(normalizedEmail);

    if (!isRegistering) {
      const result = await submit("login", { email: normalizedEmail, password }, "Could not sign in.");
      if (result?.user) onLogin(result.user);
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match. Please check them and try again.");
      return;
    }

    if (!codeSent) {
      const result = await submit("send-code", { email: normalizedEmail }, "Could not send a verification code.");
      if (result) {
        setCodeSent(true);
        setNotice(result.developmentCode
          ? `Local test code: ${result.developmentCode}. Enter it above; it expires in 10 minutes.`
          : `A verification code was sent to ${normalizedEmail}. It expires in 10 minutes.`);
      }
      return;
    }

    const result = await submit("verify-code", {
      email: normalizedEmail,
      code,
      password,
      confirmPassword,
    }, "Could not verify your email.");
    if (result?.user) onLogin(result.user);
  };

  const resendCode = async () => {
    const result = await submit("send-code", { email }, "Could not send a new verification code.");
    if (result) setNotice(result.developmentCode
      ? `New local test code: ${result.developmentCode}. The previous code is no longer valid.`
      : `A new verification code was sent to ${email}. The previous code is no longer valid.`);
  };

  const changeMode = () => {
    setMode(isRegistering ? "login" : "register");
    setCodeSent(false);
    setCode("");
    setPassword("");
    setConfirmPassword("");
    setError("");
    setNotice("");
  };

  const changeEmail = () => {
    setCodeSent(false);
    setCode("");
    setError("");
    setNotice("");
  };

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
          <p>{isRegistering ? "Verify your email once to create your account." : "Sign in with your email and password."}</p>

          <form onSubmit={handleSubmit}>
            <label htmlFor="email">{isRegistering ? "Email address" : "Email or username"}</label>
            <input
              id="email"
              name="email"
              type={isRegistering ? "email" : "text"}
              placeholder={isRegistering ? "you@example.com" : "Enter your email or username"}
              maxLength={254}
              autoComplete="email"
              value={email}
              onChange={(event) => { setEmail(event.target.value); setError(""); setNotice(""); }}
              readOnly={codeSent}
              required
            />

            <label htmlFor="password">Password</label>
            <div className="login-password-field">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder={isRegistering ? "At least 8 characters" : "Enter your password"}
                minLength={8}
                maxLength={200}
                autoComplete={isRegistering ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => { setPassword(event.target.value); setError(""); }}
                required
              />
              <button
                className="password-visibility-toggle"
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            {isRegistering && (
              <>
                <label htmlFor="confirmPassword">Confirm password</label>
                <div className="login-password-field">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Enter your password again"
                    minLength={8}
                    maxLength={200}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => { setConfirmPassword(event.target.value); setError(""); }}
                    required
                  />
                  <button
                    className="password-visibility-toggle"
                    type="button"
                    aria-label={showConfirmPassword ? "Hide confirmation password" : "Show confirmation password"}
                    aria-pressed={showConfirmPassword}
                    onClick={() => setShowConfirmPassword((visible) => !visible)}
                  >
                    {showConfirmPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </>
            )}

            {isRegistering && codeSent && (
              <>
                <label htmlFor="emailCode">Email verification code</label>
                <input
                  id="emailCode"
                  name="emailCode"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  placeholder="Enter the 6-digit code"
                  maxLength={6}
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(event) => { setCode(event.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                  required
                />
              </>
            )}

            {error && <p className="login-error" role="alert">{error}</p>}
            {notice && <p className="login-notice" role="status">{notice}</p>}

            <button type="submit" disabled={busy}>
              {busy ? "Please wait…" : isRegistering ? (codeSent ? "Verify email and create account" : "Send verification code") : "Sign In"}
            </button>
          </form>

          {isRegistering && codeSent && (
            <div className="login-secondary-actions">
              <button type="button" className="login-mode-toggle" onClick={resendCode} disabled={busy}>Send a new code</button>
              <button type="button" className="login-mode-toggle" onClick={changeEmail}>Use a different email</button>
            </div>
          )}

          <p className="login-note">
            {isRegistering ? "Already have an account?" : "New learner?"}{" "}
            <button type="button" className="login-mode-toggle" onClick={changeMode}>
              {isRegistering ? "Sign in" : "Create an account"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
