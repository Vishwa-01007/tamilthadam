import { useEffect, useState } from "react";
import "./Profile.css";

const STAGES = [
  ["letters", "Tamil Letters"],
  ["writing", "Writing Practice"],
  ["reading", "Reading"],
  ["thirukkural", "Thirukkural"],
  ["progress", "Progress"],
];

function Profile({ user, milestones, learningTrack = "beginner", onBack, onLogout, onUserUpdate, onChangeLearningPath, onAdmin }) {
  const [displayName, setDisplayName] = useState(user?.displayName || user?.username || "");
  const [email, setEmail] = useState(user?.email || "");
  const [age, setAge] = useState(user?.age ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const completedCount = STAGES.filter(([key]) => milestones?.[key]).length;

  useEffect(() => {
    setDisplayName(user?.displayName || user?.username || "");
    setEmail(user?.email || "");
    setAge(user?.age ?? "");
  }, [user]);

  const saveProfile = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ displayName, email, age: age === "" ? null : Number(age) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save your profile.");
      onUserUpdate(result.profile);
      setDisplayName(result.profile.displayName);
      setEmail(result.profile.email || "");
      setAge(result.profile.age ?? "");
      setMessage("Your profile has been saved.");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="profile-page">
      <button className="profile-back" onClick={onBack}>← Back to home</button>
      <section className="profile-card">
        <div className="profile-heading">
          <div className="profile-avatar" aria-hidden="true">{(displayName || "த").charAt(0).toUpperCase()}</div>
          <div>
            <span className="profile-eyebrow">YOUR ACCOUNT</span>
            <h1>Learner profile</h1>
            <p>Keep your learning details up to date.</p>
          </div>
        </div>

        <form className="profile-form" onSubmit={saveProfile}>
          <label htmlFor="profile-display-name">Display name</label>
          <input
            id="profile-display-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            minLength={2}
            maxLength={40}
            required
          />
          <label htmlFor="profile-username">Username</label>
          <input id="profile-username" value={user?.username || ""} readOnly />
          <label htmlFor="profile-email">Email</label>
          <input
            id="profile-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            maxLength={254}
            autoComplete="email"
            placeholder="you@example.com"
            readOnly={user?.authProvider === "email-password"}
          />
          {user?.authProvider === "email-password" && <small className="profile-email-note">Your verified email is used to sign in and cannot be changed here.</small>}
          <label htmlFor="profile-age">Age</label>
          <input
            id="profile-age"
            type="number"
            value={age}
            onChange={(event) => setAge(event.target.value)}
            min={1}
            max={120}
            step={1}
            inputMode="numeric"
            placeholder="Optional"
          />
          <button type="submit" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
          {error && <p className="profile-error" role="alert">{error}</p>}
          {message && <p className="profile-success" role="status">{message}</p>}
        </form>

        {learningTrack === "beginner" ? <section className="profile-progress" aria-label="Learning progress">
          <div className="profile-progress-heading">
            <h2>Learning journey</h2>
            <strong>{completedCount} of {STAGES.length} milestones</strong>
          </div>
          <div className="profile-progress-track"><span style={{ width: `${completedCount / STAGES.length * 100}%` }} /></div>
          <ul>
            {STAGES.map(([key, title]) => (
              <li key={key} className={milestones?.[key] ? "is-complete" : ""}>
                <span>{milestones?.[key] ? "✓" : "○"}</span>{title}
              </li>
            ))}
          </ul>
        </section> : <section className="profile-progress" aria-label="Learning path">
          <div className="profile-progress-heading">
            <h2>Learning path</h2>
            <strong>Intermediate</strong>
          </div>
          <p>You can open any stage in any order. Your certificate becomes available at 70% overall progress.</p>
        </section>}

        <button className="profile-change-path" onClick={onChangeLearningPath}>← Change learning path</button>
        {user?.isAdmin && <button className="profile-change-path" onClick={onAdmin}>Open learner database</button>}
        <button className="profile-logout" onClick={onLogout}>Sign out</button>
      </section>
    </main>
  );
}

export default Profile;
