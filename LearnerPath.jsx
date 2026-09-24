import "./LearnerPath.css";

function LearnerPath({ savedTrack, onChoose }) {
  return (
    <main className="learner-path-page">
      <section className="learner-path-card">
        <span className="learner-path-eyebrow">WELCOME TO TAMILTHADAM</span>
        <h1>Choose your learning path</h1>
        <p className="learner-path-intro">Pick the path that feels right. You can learn at your own pace.</p>
        <div className="learner-path-options">
          <button className={`learner-path-option ${savedTrack === "beginner" ? "selected" : ""}`} onClick={() => onChoose("beginner")}>
            <span className="learner-path-icon" aria-hidden="true">🌱</span>
            <span className="learner-path-option-copy">
              <strong>Beginner learner</strong>
              <span>Start with Tamil letters and follow the guided milestones to unlock each stage.</span>
            </span>
            <span className="learner-path-arrow" aria-hidden="true">→</span>
          </button>
          <button className={`learner-path-option ${savedTrack === "intermediate" ? "selected" : ""}`} onClick={() => onChoose("intermediate")}>
            <span className="learner-path-icon" aria-hidden="true">📚</span>
            <span className="learner-path-option-copy">
              <strong>Intermediate learner</strong>
              <span>Open any stage in any order. Earn your certificate when your progress reaches 70%.</span>
            </span>
            <span className="learner-path-arrow" aria-hidden="true">→</span>
          </button>
        </div>
        <p className="learner-path-footnote">Beginner certificates require 100% progress.</p>
      </section>
    </main>
  );
}

export default LearnerPath;
