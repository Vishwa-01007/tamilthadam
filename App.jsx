import { useEffect, useRef, useState } from "react";
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
import LearnerPath from "./LearnerPath";
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
  const [learningTrack, setLearningTrack] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [backendProgressLoaded, setBackendProgressLoaded] = useState(false);
  const [completedStages, setCompletedStages] = useState(() => normalizeMilestones());
  const [voiceStatus, setVoiceStatus] = useState("");
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [voiceEnglish, setVoiceEnglish] = useState("");
  const [voiceTamil, setVoiceTamil] = useState("");
  const [isVoiceAudioLoading, setIsVoiceAudioLoading] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const voiceRecognitionRef = useRef(null);
  const voiceAudioRef = useRef(null);
  const voiceAudioUrlRef = useRef("");

  const clearVoiceAudio = () => {
    voiceAudioRef.current?.pause();
    voiceAudioRef.current = null;
    if (voiceAudioUrlRef.current) URL.revokeObjectURL(voiceAudioUrlRef.current);
    voiceAudioUrlRef.current = "";
  };

  const prepareTamilAudio = async (text) => {
    setIsVoiceAudioLoading(true);
    try {
      const response = await fetch("/api/translate/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Tamil audio is unavailable right now.");
      }
      const audioBlob = await response.blob();
      if (!audioBlob.size) throw new Error("The Tamil audio service returned an empty recording.");
      clearVoiceAudio();
      voiceAudioUrlRef.current = URL.createObjectURL(audioBlob);
      setVoiceStatus("Tamil meaning ready. Tap Hear it to listen.");
    } catch (error) {
      setVoiceStatus(error.message || "Could not prepare Tamil audio. Tap Hear it to try browser speech.");
    } finally {
      setIsVoiceAudioLoading(false);
    }
  };

  const playTamilAudio = () => {
    if (!voiceTamil) return;
    voiceAudioRef.current?.pause();
    const audio = voiceAudioUrlRef.current ? new Audio(voiceAudioUrlRef.current) : null;
    if (!audio) {
      setVoiceStatus("Playing the browser’s Tamil voice.");
      speakText(voiceTamil, "ta-IN");
      return;
    }
    voiceAudioRef.current = audio;
    audio.onended = () => {
      voiceAudioRef.current = null;
      setVoiceStatus("Tamil pronunciation finished.");
    };
    audio.onerror = () => {
      voiceAudioRef.current = null;
      setVoiceStatus("Could not play the Tamil audio. Tap Hear it to try browser speech.");
    };
    audio.play().then(() => {
      setVoiceStatus("Playing the Tamil pronunciation.");
    }).catch(() => {
      voiceAudioRef.current = null;
      setVoiceStatus("Playing the browser’s Tamil voice.");
      speakText(voiceTamil, "ta-IN");
    });
  };

  const speakText = (text, language = "en-IN") => {
    if (!("speechSynthesis" in window)) {
      setVoiceStatus("Tamil audio is not supported by this browser. You can still read the translation.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    window.speechSynthesis.speak(utterance);
  };

  const translateEnglish = async (text = voiceEnglish) => {
    const phrase = text.trim();
    if (!phrase) {
      setVoiceStatus("Say or type an English word to translate.");
      return;
    }
    setVoiceEnglish(phrase);
    setIsTranslating(true);
    setVoiceTamil("");
    clearVoiceAudio();
    setVoiceStatus("Finding the Tamil meaning…");
    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: phrase }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Translation failed. Try again.");
      setVoiceTamil(result.translation);
      setVoiceStatus("Preparing Tamil pronunciation…");
      void prepareTamilAudio(result.translation);
    } catch (error) {
      setVoiceStatus(error.message || "Could not translate that right now. Try again.");
    } finally {
      setIsTranslating(false);
    }
  };

  const startVoiceAssistant = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceStatus("Voice input is not available here. Type an English word below to translate it.");
      return;
    }

    if (voiceRecognitionRef.current) {
      voiceRecognitionRef.current.abort();
    }

    const recognition = new Recognition();
    voiceRecognitionRef.current = recognition;
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setIsVoiceListening(true);
      setVoiceStatus("Listening… say an English word or short phrase.");
    };
    recognition.onresult = (event) => {
      const phrase = event.results?.[0]?.[0]?.transcript?.trim() || "";
      setVoiceEnglish(phrase);
      void translateEnglish(phrase);
    };
    recognition.onerror = (event) => {
      setVoiceStatus(event.error === "not-allowed"
        ? "Microphone access is blocked. Allow it in your browser settings, then try again."
                : "I couldn’t hear that clearly. Press the microphone and try again.");
      setIsVoiceListening(false);
    };
    recognition.onend = () => setIsVoiceListening(false);
    recognition.start();
  };

  useEffect(() => () => {
    voiceRecognitionRef.current?.abort();
    voiceAudioRef.current?.pause();
    if (voiceAudioUrlRef.current) URL.revokeObjectURL(voiceAudioUrlRef.current);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

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
        setLearningTrack(["beginner", "intermediate"].includes(result?.progress?.learningTrack)
          ? result.progress.learningTrack
          : null);
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
      body: JSON.stringify({ milestones: completedStages, learningTrack }),
    }).catch(() => {});
  }, [isLoggedIn, backendProgressLoaded, completedStages, learningTrack]);

  const markStageComplete = (stage) => {
    setCompletedStages((previous) =>
      previous[stage] ? previous : { ...previous, [stage]: true }
    );
  };

  const returnToTrackSelection = () => {
    setShowDashboard(false);
    setShowLetters(false);
    setShowQuiz(false);
    setShowLevel2(false);
    setShowWriting(false);
    setShowWritingLevel2(false);
    setShowReading(false);
    setShowThirukkural(false);
    setShowProgress(false);
    setShowProfile(false);
    setLearningTrack(null);
  };

  const stageCards = STAGE_INFO.map((stage) => {
    const index = STAGE_ORDER.indexOf(stage.key);
    const unlocked = learningTrack === "intermediate"
      || index === 0
      || completedStages[STAGE_ORDER[index - 1]];
    const completed = Boolean(completedStages[stage.key]);
    return {
      ...stage,
      locked: !unlocked,
      completed,
      status: completed
        ? "Milestone complete"
        : learningTrack === "intermediate"
          ? "Open to explore"
          : unlocked
          ? stage.key === "progress"
            ? "Unlocked after Thirukkural"
            : "Ready to start"
          : `Complete ${STAGE_INFO[index - 1].title} first`,
      action: completed ? "Review" : unlocked ? "Start" : "Locked",
    };
  });

  const openStage = (stage) => {
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
          setLearningTrack(null);
          setCompletedStages(normalizeMilestones());
          setBackendProgressLoaded(false);
          setIsLoggedIn(true);
        }}
      />
    );
  }

  if (!backendProgressLoaded) {
    return <div className="login-page"><p>Loading your learning path…</p></div>;
  }

  if (!learningTrack) {
    return <LearnerPath onChoose={setLearningTrack} />;
  }

  if (showProfile) {
    return (
      <Profile
        user={currentUser}
        learningTrack={learningTrack}
        milestones={completedStages}
        onBack={() => setShowProfile(false)}
        onChangeLearningPath={returnToTrackSelection}
        onUserUpdate={setCurrentUser}
        onAdmin={() => { setShowProfile(false); setShowAdmin(true); }}
        onLogout={async () => {
          try {
            await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
          } finally {
            setCurrentUser(null);
            setLearningTrack(null);
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
        learningTrack={learningTrack}
        onChangeLearningPath={returnToTrackSelection}
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
        learningTrack={learningTrack}
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
          onClick={returnToTrackSelection}
        >
          Change learning path
        </button>

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
              {learningTrack === "beginner" ? "One step at a time." : "Learn in your own order."}
            </h2>

            <p>
              {learningTrack === "beginner"
                ? "Complete each milestone and unlock the next stage of your Tamil learning journey."
                : "Explore any stage in any order and learn at your own pace."}
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
                    {learningTrack === "beginner" && <>
                      {item.completed ? "🏆 " : isLocked ? "🔒 " : "⭐ "}
                      {item.status}
                    </>}
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

            <div className="about-voice-assistant">
              <div className="about-voice-heading">
                <button
                  className={`about-voice-button${isVoiceListening ? " is-listening" : ""}`}
                  type="button"
                  onClick={startVoiceAssistant}
                  disabled={isTranslating}
                  aria-label={isVoiceListening ? "Listening for an English word" : "Speak an English word to translate it into Tamil"}
                  title="Speak an English word to translate it into Tamil"
                >
                  <span aria-hidden="true">🎙️</span>
                </button>
                <div>
                  <span className="about-voice-label">English to Tamil voice translator</span>
                  <p className="about-voice-hint">Tap the microphone or type a word. We’ll show the Tamil meaning and read it aloud.</p>
                </div>
              </div>
              <form className="about-translate-form" onSubmit={(event) => { event.preventDefault(); void translateEnglish(); }}>
                <label className="sr-only" htmlFor="voice-english-input">English word or phrase</label>
                <input
                  id="voice-english-input"
                  value={voiceEnglish}
                  onChange={(event) => setVoiceEnglish(event.target.value)}
                  placeholder="Type an English word or phrase"
                  maxLength={300}
                />
                <button type="submit" disabled={isTranslating || !voiceEnglish.trim()}>
                  {isTranslating ? "Translating…" : "Translate"}
                </button>
              </form>
              {voiceTamil && (
                <div className="about-translation-result" aria-live="polite">
                  <span className="about-translation-caption">Tamil meaning</span>
                  <strong lang="ta">{voiceTamil}</strong>
                  <button type="button" onClick={playTamilAudio} disabled={isVoiceAudioLoading} aria-label="Hear the Tamil pronunciation">
                    {isVoiceAudioLoading ? "Preparing audio…" : "🔊 Hear it"}
                  </button>
                </div>
              )}
              <p className="about-voice-status" aria-live="polite">
                {voiceStatus || "Translations use an online service. Avoid entering private information."}
              </p>
            </div>

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
