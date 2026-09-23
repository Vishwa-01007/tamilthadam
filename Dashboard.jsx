import "./Dashboard.css";

function Dashboard({ onBack, stages = [], onStageSelect }) {
  const completedCount = stages.filter((stage) => stage.completed).length;
  const learningStageCount = stages.filter((stage) => stage.key !== "progress").length;
  const percent = Math.round((completedCount / learningStageCount) * 100);

  return (
    <div className="dashboard">
      <button className="back-button" onClick={onBack}>
        ← Back to Home
      </button>

      <header className="dashboard-header">
        <div>
          <p className="dashboard-label">தமிழ் கற்றல் பயணம்</p>
          <h1>வணக்கம்! 👋</h1>
          <p>Complete each milestone to unlock your next Tamil lesson.</p>
        </div>

        <div className="progress-box">
          <span>Learning Milestones</span>
          <strong>{percent}%</strong>
        </div>
      </header>

      <section className="dashboard-intro">
        <h2>Your learning path</h2>
        <p>Complete each stage to unlock the next. Finish Thirukkural to open Progress.</p>
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
            <div className={`dashboard-milestone ${stage.completed ? "complete" : ""}`}>
              {stage.completed ? "🏆" : stage.locked ? "🔒" : "⭐"} {stage.status}
            </div>
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
