import "./Level2.css";

function Level2({ onBack, onQuiz }) {
  return (
    <div className="level2-page">
      <button className="level2-back" onClick={onBack}>
        ← Back to Letters
      </button>

      <div className="level2-header">
        <p>LEARN • LEVEL 2</p>
        <h1>Tamil Letters</h1>
        <h2>Medium Level</h2>
        <span>🔓 Unlocked</span>
      </div>

      <div className="level2-card">
        <div className="level2-top">
          <div>
            <span className="level2-badge">LEVEL 2</span>
            <h2>மெய்யெழுத்துக்கள்</h2>
          </div>

          <strong>0%</strong>
        </div>

        <div className="level2-progress">
          <div></div>
        </div>

        <p>
          Learn the basic Tamil consonants and identify their sounds.
        </p>

        <div className="consonant-grid">
      {[
  "க்",
  "ங்",
  "ச்",
  "ஞ்",
  "ட்",
  "ண்",
  "த்",
  "ந்",
  "ப்",
  "ம்",
  "ய்",
  "ர்",
  "ல்",
  "வ்",
  "ழ்",
  "ள்",
  "ற்",
  "ன்",
].map((letter, index) => (
            <div className="consonant-card" key={letter}>
              <span>{letter}</span>
              <small>Letter {index + 1}</small>
            </div>
          ))}
        </div>

        <div className="level2-action">
          <p>Complete Level 2 to unlock the next milestone.</p>

          <button onClick={onQuiz}>
            Take Level 2 Quiz →
          </button>
        </div>
      </div>
    </div>
  );
}

export default Level2;