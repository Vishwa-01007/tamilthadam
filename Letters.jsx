import "./Letters.css";

function Letters({ onBack, onQuiz }) {
  return (
    <div className="letters-page">
      <button className="letters-back" onClick={onBack}>
        ← Back to Home
      </button>

      <div className="letters-header">
        <p className="letters-label">LEARN • LEVEL 1</p>
        <h1>Tamil Letters</h1>
        <p>
          Learn the basic Tamil உயிரெழுத்துக்கள் before moving to the next
          level.
        </p>
      </div>

      <div className="level-card">
        <div className="level-top">
          <div>
            <span className="level-badge">LEVEL 1</span>
            <h2>Easy • Tamil Vowels</h2>
          </div>

          <span className="level-progress">0%</span>
        </div>

        <div className="level-progress-bar">
          <div className="level-progress-fill"></div>
        </div>

        <p>
          Learn these 12 basic Tamil உயிரெழுத்துக்கள்:
        </p>

        <div className="letter-grid">
          {["அ", "ஆ", "இ", "ஈ", "உ", "ஊ", "எ", "ஏ", "ஐ", "ஒ", "ஓ", "ஔ"].map(
            (letter, index) => (
              <div className="letter-card" key={letter}>
                <span>{letter}</span>
                <small>Letter {index + 1}</small>
              </div>
            )
          )}
        </div>

        <div className="level-action">
          <p>Complete Level 1 to unlock the 5-question quiz.</p>

          <button onClick={onQuiz}>
  Take Level 1 Quiz →
</button>

        </div>
      </div>
    </div>
  );
}

export default Letters;