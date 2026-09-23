import { useEffect, useState } from "react";
import "./App.css";

import Dashboard from "./Dashboard";
import Login from "./Login";
import Letters from "./Letters";
import Quiz from "./Quiz";
import Level2 from "./Level2";

import Writing from "./Writing";
import WritingLevel2 from "./WritingLevel2";
import Reading from "./Reading";
import Progress from "./Progress";
import Thirukkural from "./Thirukkural";
import Profile from "./Profile";
import AdminDashboard from "./AdminDashboard";

const STAGE_ORDER = ["letters", "writing", "reading", "thirukkural", "progress"];

const STAGE_INFO = [
  { key: "letters", icon: "அ", title: "Tamil Letters", text: "Learn vowels and consonants" },
  { key: "writing", icon: "✍️", title: "Writing Practice", text: "Practice Tamil letters and words" },
  { key: "reading", icon: "📖", title: "Reading", text: "Words, sentences & short stories" },
  { key: "thirukkural", icon: "📜", title: "Thirukkural", text: "Five kurals with Tamil meanings" },
  { key: "progress", icon: "📊", title: "Progress", text: "Track your Tamil journey" },
];

function normalizeMilestones(saved = {}) {
  return {
    letters: Boolean(saved.letters),
    writing: Boolean(saved.writing),
    reading: Boolean(saved.reading),
    thirukkural: Boolean(saved.thirukkural),
    progress: Boolean(saved.progress),
  };
}

function App() {
  const [showDashboard, setShowDashboard] = useState(false);
  const [showLetters, setShowLetters] = useState(false);

  const [showQuiz, setShowQuiz] = useState(false);
  const [quizLevel, setQuizLevel] = useState(1);

  const [showLevel2, setShowLevel2] = useState(false);

  const [showWriting, setShowWriting] = useState(false);
  const [showWritingLevel2, setShowWritingLevel2] = useState(false);

  const [showReading, setShowReading] = useState(false);
  const [showThirukkural, setShowThirukkural] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [backendProgressLoaded, setBackendProgressLoaded] = useState(false);
  const [completedStages, setCompletedStages] = useState(() => normalizeMilestones());

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        if (active && result?.user?.id) {
          setCurrentUser(result.user);
          setIsLoggedIn(true);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setAuthChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return undefined;
    let active = true;
    fetch("/api/progress", { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        if (!active) return;
        // The signed-in account's server record is authoritative; never merge in
        // browser-wide progress that could belong to another learner.
        setCompletedStages(normalizeMilestones(result?.progress?.milestones));
      })
      .catch(() => {})
      .finally(() => {
        if (active) setBackendProgressLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn || !backendProgressLoaded) return;
    fetch("/api/progress", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ milestones: completedStages }),
    }).catch(() => {});
  }, [isLoggedIn, backendProgressLoaded, completedStages]);

  const markStageComplete = (stage) => {
    setCompletedStages((previous) =>
      previous[stage] ? previous : { ...previous, [stage]: true }
    );
  };

  const stageCards = STAGE_INFO.map((stage) => {
    const index = STAGE_ORDER.indexOf(stage.key);
    const unlocked =
      index === 0 ||
      completedStages[STAGE_ORDER[index - 1]];
    const completed = Boolean(completedStages[stage.key]);
    return {
      ...stage,
      locked: !unlocked,
      completed,
      status: completed
        ? "Milestone complete"
        : unlocked
          ? stage.key === "progress"
            ? "Unlocked after Thirukkural"
            : "Ready to start"
          : `Complete ${STAGE_INFO[index - 1].title} first`,
      action: completed ? "Review" : unlocked ? "Start" : "Locked",
    };
  });

  const openStage = (stage) => {
    fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ stage }),
    }).catch(() => {});
    setShowDashboard(false);
    setShowLetters(false);
    setShowWriting(false);
    setShowWritingLevel2(false);
    setShowReading(false);
    setShowThirukkural(false);
    setShowProgress(false);

    if (stage === "letters") setShowLetters(true);
    if (stage === "writing") setShowWriting(true);
    if (stage === "reading") setShowReading(true);
    if (stage === "thirukkural") setShowThirukkural(true);
    if (stage === "progress") setShowProgress(true);
  };

  /* =====================================================
     LOGIN
  ===================================================== */

  if (!isLoggedIn) {
    if (authChecking) {
      return <div className="login-page"><p>Connecting to TamilThadam…</p></div>;
    }
    return (
      <Login
        onLogin={(user) => {
          setCurrentUser(user);
          setCompletedStages(normalizeMilestones());
          setBackendProgressLoaded(false);
          setIsLoggedIn(true);
        }}
      />
    );
  }

  if (showProfile) {
    return (
      <Profile
        user={currentUser}
        milestones={completedStages}
        onBack={() => setShowProfile(false)}
        onUserUpdate={setCurrentUser}
        onAdmin={() => { setShowProfile(false); setShowAdmin(true); }}
        onLogout={async () => {
          try {
            await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
          } finally {
            setCurrentUser(null);
            setCompletedStages(normalizeMilestones());
            setIsLoggedIn(false);
            setShowProfile(false);
            setBackendProgressLoaded(false);
          }
        }}
      />
    );
  }

  if (showAdmin) {
    return <AdminDashboard onBack={() => { setShowAdmin(false); setShowProfile(true); }} />;
  }

  /* =====================================================
     DASHBOARD
  ===================================================== */

  if (showDashboard) {
    return (
      <Dashboard
        onBack={() => setShowDashboard(false)}
        stages={stageCards}
        onStageSelect={(stage) => openStage(stage)}
      />
    );
  }

  /* =====================================================
     LEVEL 2 LESSON
  ===================================================== */

  if (showLevel2) {
    return (
      <Level2
        onBack={() => setShowLevel2(false)}
        onQuiz={() => {
          setShowLevel2(false);
          setShowQuiz(true);
          setQuizLevel(2);
        }}
      />
    );
  }

  /* =====================================================
     WRITING LEVEL 1
  ===================================================== */

  if (showWriting) {
    return (
      <Writing
        onBack={() => setShowWriting(false)}
        onLevel2={() => {
          setShowWriting(false);
          setShowWritingLevel2(true);
        }}
      />
    );
  }

  /* =====================================================
     WRITING LEVEL 2
  ===================================================== */

  if (showWritingLevel2) {
    return (
      <WritingLevel2
        onBack={() => setShowWritingLevel2(false)}
        onComplete={() => markStageComplete("writing")}
        onContinue={() => openStage("reading")}
      />
    );
  }

  /* =====================================================
     READING
  ===================================================== */

  if (showReading) {
    return (
      <Reading
        onBack={() => setShowReading(false)}
        onComplete={() => markStageComplete("reading")}
        onContinue={() => openStage("thirukkural")}
      />
    );
  }

  if (showThirukkural) {
    return (
      <Thirukkural
        onBack={() => setShowThirukkural(false)}
        onComplete={() => markStageComplete("thirukkural")}
        onContinue={() => openStage("progress")}
      />
    );
  }

  /* =====================================================
     PROGRESS
  ===================================================== */

  if (showProgress) {
    return (
      <Progress
        onBack={() => setShowProgress(false)}
        onComplete={() => markStageComplete("progress")}
        journeyComplete={completedStages.progress}
        kuralComplete={completedStages.thirukkural}
      />
    );
  }

  /* =====================================================
     NORMAL QUIZ
  ===================================================== */

  if (showQuiz) {
    return (
      <Quiz
        level={quizLevel}
        onBack={() => setShowQuiz(false)}
        onPass={() => {
          setShowQuiz(false);

          if (quizLevel === 1) {
            setShowLevel2(true);
          } else if (quizLevel === 2) {
            markStageComplete("letters");
            setShowWriting(true);
          }
        }}
      />
    );
  }

  /* =====================================================
     TAMIL LETTERS
  ===================================================== */

  if (showLetters) {
    return (
      <Letters
        onBack={() => setShowLetters(false)}
        onQuiz={() => {
          setShowLetters(false);
          setShowQuiz(true);
          setQuizLevel(1);
        }}
      />
    );
  }

  /* =====================================================
     LEARNING PATH
  ===================================================== */

  /* =====================================================
     MAIN PAGE
  ===================================================== */

  return (
    <div className="app">

      {/* =================================================
          NAVBAR
      ================================================= */}

      <nav className="navbar">

        <div className="logo">

          <span className="logo-mark">
            த
          </span>

          <span>
            Tamil<span>Thadam</span>
          </span>

        </div>

        <div className="nav-links">

          <a href="#home">
            Home
          </a>

          <a href="#learn">
            Learn
          </a>

          <a href="#practice">
            Practice
          </a>

          <a href="#progress">
            Progress
          </a>

          <a href="#about">
            About
          </a>

        </div>

        <button
          className="profile-nav-btn"
          onClick={() => setShowProfile(true)}
        >
          Profile
        </button>

        <button
          className="login-btn"
          onClick={() => setShowDashboard(true)}
        >
          Start Learning
        </button>

      </nav>

      <main>

        {/* =================================================
            HERO
        ================================================= */}

        <section
          className="hero"
          id="home"
        >

          <div className="hero-content">

            <div className="badge">
              🌱 BEGIN YOUR TAMIL JOURNEY
            </div>

            <h1>
              Learn Tamil.
              <br />
              <span>
                Step by Step.
              </span>
            </h1>

            <p>
              A simple and guided learning journey that takes you
              from your first Tamil letter to confidently reading Tamil.
            </p>

            <div className="hero-buttons">

              <button
                className="primary-btn"
                onClick={() => setShowDashboard(true)}
              >
                Start Learning
                <span>→</span>
              </button>

              <button
                className="secondary-btn"
                onClick={() => setShowLetters(true)}
              >
                Explore Lessons
              </button>

            </div>

            <div className="stats">

              <div>
                <strong>
                  4
                </strong>

                <span>
                  Learning Stages
                </span>
              </div>

              <div>
                <strong>
                  100+
                </strong>

                <span>
                  Practice Activities
                </span>
              </div>

              <div>
                <strong>
                  தமிழ்
                </strong>

                <span>
                  Learn in Tamil
                </span>
              </div>

            </div>

          </div>

          {/* =================================================
              HERO CARD
          ================================================= */}

          <div className="hero-card">

            <div className="card-top">

              <span>
                Your Tamil Journey
              </span>

              <span className="progress-text">
                0%
              </span>

            </div>

            <div className="progress-bar">

              <div className="progress-fill">
              </div>

            </div>

            <div className="letter-display">
              அ
            </div>

            <p className="tamil-example">
              அம்மா
            </p>

            <p className="example-meaning">
              Learn your first Tamil letter
            </p>

            <figure className="heritage-art">
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/9/94/Tirukkural_manuscript.jpg"
                alt="A historic palm-leaf manuscript showing verses from the Tirukkural"
                loading="lazy"
              />
              <figcaption>
                Tamil wisdom, preserved on palm leaves · <a href="https://commons.wikimedia.org/wiki/File:Tirukkural_manuscript.jpg" target="_blank" rel="noreferrer">View source</a>
              </figcaption>
            </figure>

            <button
              className="card-button"
              onClick={() => setShowLetters(true)}
            >
              Start with அ →
            </button>

          </div>

        </section>

        {/* =================================================
            LEARNING PATH
        ================================================= */}

        <section
          className="journey"
          id="learn"
        >

          <div className="section-heading">

            <div className="badge">
              YOUR LEARNING PATH
            </div>

            <h2>
              One step at a time.
            </h2>

            <p>
              Complete each milestone and unlock the next stage
              of your Tamil learning journey.
            </p>

          </div>

          <div className="learning-grid">

            {stageCards.map((item, index) => {
              const isLocked = item.locked;

              return (
                <div
                  className={`learning-card ${
                    isLocked ? "locked" : ""
                  }`}
                  key={item.title}
                >

                  <div className="card-number">
                    0{index + 1}
                  </div>

                  <div className="stage-icon">
                    {item.icon}
                  </div>

                  <h3>
                    {item.title}
                  </h3>

                  <p>
                    {item.text}
                  </p>

                  <p className={item.completed ? "milestone-status complete" : "milestone-status"}>
                    {item.completed ? "🏆 " : isLocked ? "🔒 " : "⭐ "}
                    {item.status}
                  </p>

                  <button
                    disabled={isLocked}
                    onClick={() => openStage(item.key)}
                  >
                    {isLocked
                      ? "🔒 Locked"
                      : item.completed
                        ? "Review →"
                        : item.key === "progress"
                          ? "View →"
                          : "Start →"}
                  </button>

                </div>
              );

            })}

          </div>

        </section>

        {/* =================================================
            ABOUT
        ================================================= */}

        <section
          className="about"
          id="about"
        >

          <div>

            <div className="badge">
              WHY TAMILTHADAM?
            </div>

            <h2>
              Learn Tamil with a clear, guided path.
            </h2>

          </div>

          <div className="about-text">

            <p>
              TamilThadam is a structured Tamil learning platform
              designed to make learning Tamil simple, engaging,
              and easy to follow.
            </p>

            <p>
              Start with the basics, practice writing,
              learn through simple reading exercises,
              and gradually progress towards reading Tamil
              with confidence.
            </p>

            <p>
              Every stage of the journey helps you understand
              what you have learned, what you need to practice,
              and what comes next.
            </p>

          </div>

        </section>

      </main>

      {/* =================================================
          FOOTER
      ================================================= */}

      <footer>

        <div className="logo">

          <span className="logo-mark">
            த
          </span>

          <span>
            Tamil<span>Thadam</span>
          </span>

        </div>

        <p>
          Learn Tamil. Follow your path. Read with confidence.
        </p>

        <span>
          © 2026 TamilThadam
        </span>

      </footer>

    </div>
  );
}

export default App;
