import { useEffect, useMemo, useState } from "react";
import "./AdminDashboard.css";

const STAGES = [
  ["letters", "Tamil Letters"],
  ["writing", "Writing Practice"],
  ["reading", "Reading"],
  ["thirukkural", "Thirukkural"],
  ["progress", "Progress"],
];

function formatDate(value) {
  if (!value) return "Not yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not yet" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function AdminDashboard({ onBack }) {
  const [learners, setLearners] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/summary", { credentials: "same-origin" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load the learner database.");
        return result;
      })
      .then((result) => { if (active) setLearners(result.learners || []); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filteredLearners = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return learners;
    return learners.filter((learner) => [learner.username, learner.displayName, learner.email].some((value) => String(value || "").toLocaleLowerCase().includes(query)));
  }, [learners, search]);

  return (
    <main className="admin-page">
      <button className="admin-back" onClick={onBack}>← Back to profile</button>
      <section className="admin-shell">
        <header className="admin-header">
          <div>
            <span className="admin-eyebrow">TAMILTHADAM • ADMIN</span>
            <h1>Learner database</h1>
            <p>Review account details, recent sign-ins and learning activity.</p>
          </div>
          <div className="admin-count"><strong>{learners.length}</strong><span>Learners</span></div>
        </header>

        <div className="admin-privacy-note" role="note">
          <span aria-hidden="true">🔒</span>
          Passwords are never shown here. Password accounts are stored using one-way password hashes.
        </div>

        <label className="admin-search-label" htmlFor="admin-learner-search">Search learners</label>
        <input id="admin-learner-search" className="admin-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search username, name or email" />

        {loading && <p className="admin-state">Loading learner records…</p>}
        {error && <p className="admin-error" role="alert">{error}</p>}
        {!loading && !error && filteredLearners.length === 0 && <p className="admin-state">{learners.length ? "No learners match that search." : "No learner accounts yet. New accounts will appear here."}</p>}

        {!loading && !error && filteredLearners.length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Learner</th><th>Account</th><th>Progress</th><th>Last sign-in</th><th>Recent activity</th></tr></thead>
              <tbody>
                {filteredLearners.map((learner) => {
                  const completed = STAGES.filter(([key]) => learner.progress?.milestones?.[key]).length;
                  const recent = learner.activity?.[0];
                  return (
                    <tr key={learner.id}>
                      <td><strong>{learner.displayName || learner.username}</strong><span>@{learner.username}</span>{learner.age && <small>Age {learner.age}</small>}</td>
                      <td><span>{learner.email || "No email added"}</span><small>{learner.authProvider === "google" ? "Google sign-in" : "Password sign-in"}</small></td>
                      <td><strong>{completed} / {STAGES.length} stages</strong><small>{STAGES.filter(([key]) => learner.progress?.milestones?.[key]).map(([, title]) => title).join(", ") || "Not started"}</small></td>
                      <td>{formatDate(learner.lastLoginAt)}</td>
                      <td>{recent ? <><strong>{recent.type.replaceAll("_", " ")}</strong><small>{recent.stage || formatDate(recent.at)}</small></> : <span>No activity yet</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default AdminDashboard;
