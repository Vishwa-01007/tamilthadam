import { useState, useEffect } from "react";
import "./Progress.css";

function escapeXml(value) {
  return value.replace(/[<>&"']/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&apos;",
  })[character]);
}

function Progress({ onBack, onComplete, journeyComplete = false, kuralComplete = false }) {
  const [readingData, setReadingData] = useState({
    words: [],
    sentences: [],
    stories: [],
  });

  const [certificateName, setCertificateName] = useState("");
  const [showCertificate, setShowCertificate] = useState(false);

  /* =====================================================
     READ READING PROGRESS
  ===================================================== */

  const loadReadingProgress = () => {
    fetch("/api/progress", { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        const data = result?.progress?.reading || {};
        const convertProgress = (value) => {
          if (Array.isArray(value)) return value;
          const count = Number(value || 0);
          return Array.from({ length: count }, (_, index) => index);
        };
        setReadingData({
          words: convertProgress(data.words),
          sentences: convertProgress(data.sentences),
          stories: convertProgress(data.stories),
        });
      })
      .catch(() => {
      setReadingData({
        words: [],
        sentences: [],
        stories: [],
      });
      });
  };

  /* =====================================================
     LOAD WHEN PAGE OPENS
  ===================================================== */

  useEffect(() => {
    loadReadingProgress();

    const handleProgressUpdate = () => {
      loadReadingProgress();
    };

    window.addEventListener(
      "tamilthadamReadingProgressUpdated",
      handleProgressUpdate
    );

    return () => {
      window.removeEventListener(
        "tamilthadamReadingProgressUpdated",
        handleProgressUpdate
      );

    };
  }, []);

  /* =====================================================
     READING COUNTS
  ===================================================== */

  const wordsCompleted =
    readingData.words.length;

  const sentencesCompleted =
    readingData.sentences.length;

  const storiesCompleted =
    readingData.stories.length;

  const totalWords = 12;
  const totalSentences = 6;
  const totalStories = 2;

  const readingTotal =
    totalWords +
    totalSentences +
    totalStories;

  const readingCompleted =
    wordsCompleted +
    sentencesCompleted +
    storiesCompleted;

  const readingPercentage =
    readingTotal === 0
      ? 0
      : Math.round(
          (readingCompleted / readingTotal) * 100
        );

  /* =====================================================
     WRITING PROGRESS
     24 EXERCISES
  ===================================================== */

  const writingCompleted = 24;
  const writingTotal = 24;

  const writingPercentage = Math.round(
    (writingCompleted / writingTotal) * 100
  );

  /* =====================================================
     LETTER PROGRESS
  ===================================================== */

  const lettersCompleted = 247;
  const lettersTotal = 247;

  const lettersPercentage = Math.round(
    (lettersCompleted / lettersTotal) * 100
  );

  /* =====================================================
     OVERALL PROGRESS
  ===================================================== */

  const totalLearningActivities =
    lettersTotal +
    writingTotal +
    readingTotal;

  const completedLearningActivities =
    lettersCompleted +
    writingCompleted +
    readingCompleted;

  const overallPercentage = Math.round(
    (completedLearningActivities /
      totalLearningActivities) *
      100
  );

  /* =====================================================
     STAGES
  ===================================================== */

  const stagesCompleted =
    (lettersPercentage === 100 ? 1 : 0) +
    (writingPercentage === 100 ? 1 : 0) +
    (readingPercentage === 100 ? 1 : 0);

  let currentLevel = "Tamil Letters";

  if (lettersPercentage < 100) {
    currentLevel = "Tamil Letters";
  } else if (writingPercentage < 100) {
    currentLevel = "Writing Practice";
  } else if (readingPercentage < 100) {
    currentLevel = "Reading";
  } else {
    currentLevel = "Tamil Learning Complete";
  }

  /* =====================================================
     CERTIFICATE
  ===================================================== */

  const handleCertificate = () => {
    if (!certificateName.trim()) {
      alert("Please enter your name.");
      return;
    }

    setShowCertificate(true);
  };

  const downloadCertificate = () => {
    const name = certificateName.trim();
    const safeName = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "").replace(/\s+/g, "-") || "learner";
    const date = new Date().toLocaleDateString();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
      <rect width="1200" height="800" fill="#fbfdf9"/>
      <rect x="28" y="28" width="1144" height="744" rx="20" fill="#fff" stroke="#27864c" stroke-width="6"/>
      <rect x="48" y="48" width="1104" height="704" rx="12" fill="none" stroke="#d7b85a" stroke-width="2"/>
      <text x="600" y="150" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" letter-spacing="7" fill="#27864c">CERTIFICATE OF COMPLETION</text>
      <text x="600" y="235" text-anchor="middle" font-family="Arial, sans-serif" font-size="54" font-weight="700" fill="#111111">TamilThadam</text>
      <line x1="380" y1="270" x2="820" y2="270" stroke="#d7b85a" stroke-width="3"/>
      <text x="600" y="340" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="#536158">This certificate is proudly presented to</text>
      <text x="600" y="445" text-anchor="middle" font-family="Arial, 'Noto Sans Tamil', 'Latha', sans-serif" font-size="58" font-weight="700" fill="#27864c">${escapeXml(name)}</text>
      <line x1="300" y1="465" x2="900" y2="465" stroke="#27864c" stroke-width="2"/>
      <text x="600" y="525" text-anchor="middle" font-family="Arial, sans-serif" font-size="25" fill="#536158">for successfully completing the Tamil learning journey.</text>
      <text x="600" y="600" text-anchor="middle" font-family="'Noto Sans Tamil', 'Latha', sans-serif" font-size="30" fill="#27864c">தமிழ் கற்றல் நிறைவு</text>
      <text x="600" y="700" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#68756c">Awarded on ${escapeXml(date)}</text>
    </svg>`;
    const file = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `TamilThadam-Certificate-${safeName}.svg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="progress-page">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="progress-header">

        <button
          className="progress-back"
          onClick={onBack}
        >
          ← Back to Home
        </button>

        <div className="progress-badge">
          📊 YOUR PROGRESS
        </div>

        <h1>
          Track your Tamil journey.
        </h1>

        <p>
          See what you have learned,
          what you are practicing,
          and what comes next.
        </p>

      </div>

      {/* =================================================
          OVERALL PROGRESS
      ================================================= */}

      <section className="overall-card">

        <div className="overall-circle">
          <strong>
            {overallPercentage}%
          </strong>

          <span>
            Complete
          </span>
        </div>

        <div className="overall-info">

          <span className="progress-badge">
            OVERALL PROGRESS
          </span>

          <h2>
            Your Tamil Learning Journey
          </h2>

          <p>
            Keep learning step by step.
            Every completed activity brings
            you closer to reading Tamil
            with confidence.
          </p>

          <div className="large-progress-bar">
            <div
              style={{
                width: `${overallPercentage}%`,
              }}
            />
          </div>

          <div className="progress-summary">

            <div className="summary-card">
              <strong>
                {stagesCompleted}/3
              </strong>
              <span>
                Stages Completed
              </span>
            </div>

            <div className="summary-card">
              <strong>
                {completedLearningActivities}
              </strong>
              <span>
                Activities Completed
              </span>
            </div>

            <div className="summary-card">
              <strong>
                {currentLevel}
              </strong>
              <span>
                Current Learning Level
              </span>
            </div>

          </div>

        </div>

      </section>

      {/* =================================================
          STATISTICS
      ================================================= */}

      <section className="progress-section">

        <div className="progress-section-heading">

          <span className="progress-badge">
            LEARNING STATISTICS
          </span>

          <h2>
            Your progress by stage
          </h2>

          <p>
            Complete each stage at your own pace.
          </p>

        </div>

        <div className="statistics-grid">

          {/* LETTERS */}

          <div className="stat-card">

            <div className="stat-top">
              <div className="stat-icon">
                🔤
              </div>

              <div>
                <strong>
                  {lettersCompleted}/{lettersTotal}
                </strong>

                <span>
                  Tamil Letters Learned
                </span>
              </div>
            </div>

            <div className="stat-bar">
              <div
                style={{
                  width: `${lettersPercentage}%`,
                }}
              />
            </div>

            <p>
              {lettersPercentage}% completed
            </p>

          </div>

          {/* WRITING */}

          <div className="stat-card">

            <div className="stat-top">
              <div className="stat-icon">
                ✍️
              </div>

              <div>
                <strong>
                  {writingCompleted}/{writingTotal}
                </strong>

                <span>
                  Writing Exercises
                </span>
              </div>
            </div>

            <div className="stat-bar">
              <div
                style={{
                  width: `${writingPercentage}%`,
                }}
              />
            </div>

            <p>
              {writingPercentage}% completed
            </p>

          </div>

          {/* WORDS */}

          <div className="stat-card">

            <div className="stat-top">
              <div className="stat-icon">
                📝
              </div>

              <div>
                <strong>
                  {wordsCompleted}/{totalWords}
                </strong>

                <span>
                  Words Learned
                </span>
              </div>
            </div>

            <div className="stat-bar">
              <div
                style={{
                  width: `${Math.round(
                    (wordsCompleted / totalWords) *
                      100
                  )}%`,
                }}
              />
            </div>

            <p>
              {Math.round(
                (wordsCompleted / totalWords) * 100
              )}% completed
            </p>

          </div>

          {/* SENTENCES */}

          <div className="stat-card">

            <div className="stat-top">
              <div className="stat-icon">
                💬
              </div>

              <div>
                <strong>
                  {sentencesCompleted}/{totalSentences}
                </strong>

                <span>
                  Sentences Completed
                </span>
              </div>
            </div>

            <div className="stat-bar">
              <div
                style={{
                  width: `${Math.round(
                    (sentencesCompleted /
                      totalSentences) *
                      100
                  )}%`,
                }}
              />
            </div>

            <p>
              {Math.round(
                (sentencesCompleted /
                  totalSentences) *
                  100
              )}% completed
            </p>

          </div>

          {/* STORIES */}

          <div className="stat-card">

            <div className="stat-top">
              <div className="stat-icon">
                📚
              </div>

              <div>
                <strong>
                  {storiesCompleted}/{totalStories}
                </strong>

                <span>
                  Stories Completed
                </span>
              </div>
            </div>

            <div className="stat-bar">
              <div
                style={{
                  width: `${Math.round(
                    (storiesCompleted / totalStories) *
                      100
                  )}%`,
                }}
              />
            </div>

            <p>
              {Math.round(
                (storiesCompleted / totalStories) *
                  100
              )}% completed
            </p>

          </div>

          {/* READING */}

          <div className="stat-card">

            <div className="stat-top">
              <div className="stat-icon">
                📖
              </div>

              <div>
                <strong>
                  {readingPercentage}%
                </strong>

                <span>
                  Reading Progress
                </span>
              </div>
            </div>

            <div className="stat-bar">
              <div
                style={{
                  width: `${readingPercentage}%`,
                }}
              />
            </div>

            <p>
              {readingCompleted}/{readingTotal} reading
              activities completed
            </p>

          </div>

        </div>

      </section>

      {/* =================================================
          LEARNING STATUS
      ================================================= */}

      <section className="progress-section">

        <div className="progress-section-heading">

          <span className="progress-badge">
            KEEP GOING
          </span>

          <h2>
            Your next step
          </h2>

        </div>

        <div className="overall-card">

          <div className="overall-info">

            <h2>
              {currentLevel}
            </h2>

            <p>
              Continue practicing and complete
              the activities in this stage.
            </p>

            <div className="large-progress-bar">
              <div
                style={{
                  width: `${
                    currentLevel === "Reading"
                      ? readingPercentage
                      : currentLevel === "Writing Practice"
                      ? writingPercentage
                      : lettersPercentage
                  }%`,
                }}
              />
            </div>

          </div>

        </div>

      </section>

      <section className="journey-final-milestone" aria-live="polite">
        {journeyComplete ? (
          <>
            <span className="final-milestone-icon" aria-hidden="true">🎉</span>
            <div className="final-milestone-copy">
              <span className="progress-badge">FINAL MILESTONE COMPLETE</span>
              <h2>You completed your Tamil learning journey!</h2>
              <p>Celebrate how far you have come. You can revisit any stage from the learning path.</p>
            </div>
            <button type="button" onClick={onBack}>Return to Learning Path →</button>
          </>
        ) : (
          <>
            <span className="final-milestone-icon" aria-hidden="true">🏁</span>
            <div className="final-milestone-copy">
              <span className="progress-badge">FINAL MILESTONE</span>
              <h2>Review your learning progress</h2>
              <p>
                {kuralComplete
                  ? "You have reached the final step. Mark this milestone complete to finish your journey."
                  : "Complete the Thirukkural milestone to unlock the final step."}
              </p>
            </div>
            <button type="button" disabled={!kuralComplete} onClick={onComplete}>
              Complete Journey →
            </button>
          </>
        )}
      </section>

      {/* =================================================
          CERTIFICATE
      ================================================= */}

      {overallPercentage === 100 && (
        <section className="certificate-section">

          {!showCertificate ? (
            <>
              <div className="certificate-icon">
                🏆
              </div>

              <h2>
                Congratulations!
              </h2>

              <p>
                You have completed your Tamil
                learning journey.
              </p>

              <input
                type="text"
                placeholder="Enter your name"
                value={certificateName}
                onChange={(event) =>
                  setCertificateName(event.target.value)
                }
              />

              <button
                onClick={handleCertificate}
              >
                Get My Certificate
              </button>
            </>
          ) : (
            <div className="certificate">

              <div className="certificate-icon">
                🏆
              </div>

              <span>
                CERTIFICATE OF COMPLETION
              </span>

              <h2>
                TamilThadam
              </h2>

              <p>
                This certificate is proudly
                presented to
              </p>

              <h1>
                {certificateName}
              </h1>

              <p>
                for successfully completing
                the Tamil learning journey.
              </p>

              <strong>
                தமிழ் கற்றல் நிறைவு
              </strong>

            </div>
          )}

          {showCertificate && (
            <button
              className="certificate-download"
              type="button"
              onClick={downloadCertificate}
            >
              ⬇ Download Certificate
            </button>
          )}

        </section>
      )}

    </div>
  );
}

export default Progress;
