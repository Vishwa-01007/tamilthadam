import "./Dashboard.css";

function Dashboard({ onBack, onChangeLearningPath, stages = [], onStageSelect, learningTrack = "beginner" }) {
  const beginner = learningTrack === "beginner";
  const completedCount = stages.filter((stage) => stage.completed).length;
  const learningStageCount = stages.filter((stage) => stage.key !== "progress").length;
  const percent = Math.round((completedCount / learningStageCount) * 100);

  return (
    <div className="dashboard">
      <button className="back-button" onClick={onBack}>
        ← Back to Home
      </button>
      <button className="back-button dashboard-change-path" onClick={onChangeLearningPath}>
        ← Change learning path
      </button>

      <header className="dashboard-header">
        <div>
          <p className="dashboard-label">தமிழ் கற்றல் பயணம்</p>
          <h1>வணக்கம்! 👋</h1>
          <p>{beginner ? "Complete each milestone to unlock your next Tamil lesson." : "Choose any Tamil stage and explore in any order."}</p>
        </div>

        <div className="progress-box">
          <span>{beginner ? "Learning Milestones" : "Stages Explored"}</span>
          <strong>{beginner ? `${percent}%` : "Open"}</strong>
        </div>
      </header>

      <section className="dashboard-intro">
        <h2>Your learning path</h2>
        <p>{beginner ? "Complete each stage to unlock the next. Finish Thirukkural to open Progress." : "All stages are open. Visit them in whichever order works for you."}</p>
      </section>

      <section className="learning-cards">
        {stages.map((stage, index) => (
          <article
            className={`learning-card ${stage.locked ? "stage-locked" : ""} ${stage.completed ? "stage-completed" : ""}`}
            key={stage.key}
          >
            <div className="card-number">0{index + 1}</div>
            <div className="card-icon">{stage.icon}</div>
            <h3>{stage.title}</h3>
            <p>{stage.text}</p>
            {beginner && <div className={`dashboard-milestone ${stage.completed ? "complete" : ""}`}>
              {stage.completed ? "🏆" : stage.locked ? "🔒" : "⭐"} {stage.status}
            </div>}
            <button
              disabled={stage.locked}
              onClick={() => onStageSelect?.(stage.key)}
            >
              {stage.locked ? "Locked" : stage.completed ? "Review Stage" : stage.key === "progress" ? "View Progress" : "Start Stage"}
              {!stage.locked && " →"}
            </button>
          </article>
        ))}
      </section>
    </div>
  );
}

export default Dashboard;
