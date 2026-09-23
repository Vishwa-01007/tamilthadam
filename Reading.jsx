import { useState, useEffect, useRef } from "react";
import "./Reading.css";

/* =====================================================
   WORDS
===================================================== */

const words = [
  { tamil: "அம்மா", english: "Mother" },
  { tamil: "அப்பா", english: "Father" },
  { tamil: "வீடு", english: "House" },
  { tamil: "மரம்", english: "Tree" },
  { tamil: "பால்", english: "Milk" },
  { tamil: "பூ", english: "Flower" },
  { tamil: "மாடு", english: "Cow" },
  { tamil: "நாய்", english: "Dog" },
  { tamil: "மீன்", english: "Fish" },
  { tamil: "பழம்", english: "Fruit" },
  { tamil: "பள்ளி", english: "School" },
  { tamil: "நண்பன்", english: "Friend" },
];

/* =====================================================
   SENTENCES
===================================================== */

const sentences = [
  {
    tamil: "என் பெயர் அருண்.",
    english: "My name is Arun.",
  },
  {
    tamil: "இது என் வீடு.",
    english: "This is my house.",
  },
  {
    tamil: "அம்மா சமையல் செய்கிறார்.",
    english: "Mother is cooking.",
  },
  {
    tamil: "அப்பா வேலைக்கு செல்கிறார்.",
    english: "Father goes to work.",
  },
  {
    tamil: "நான் தமிழ் படிக்கிறேன்.",
    english: "I am learning Tamil.",
  },
  {
    tamil: "அவன் பள்ளிக்கு செல்கிறான்.",
    english: "He goes to school.",
  },
];

/* =====================================================
   SHORT STORIES
===================================================== */

const stories = [
  {
    title: "சிறிய பறவை",
    tamil: `ஒரு சிறிய பறவை இருந்தது.

அது ஒரு மரத்தில் வாழ்ந்து வந்தது.

ஒரு நாள் அது உணவைத் தேடி வெளியே சென்றது.

அதற்கு ஒரு சிறிய பழம் கிடைத்தது.

பறவை மகிழ்ச்சியாக வீட்டிற்குத் திரும்பியது.`,
    meaning:
      "A small bird lived in a tree. One day, it went out looking for food. It found a small fruit and happily returned home.",
  },
  {
    title: "என் வீடு",
    tamil: `என் வீடு மிகவும் அழகாக உள்ளது.

என் வீட்டில் அம்மா, அப்பா மற்றும் நான் இருக்கிறோம்.

எங்கள் வீட்டின் அருகில் ஒரு பெரிய மரம் உள்ளது.

நான் தினமும் அந்த மரத்தின் கீழ் விளையாடுகிறேன்.`,
    meaning:
      "My house is very beautiful. My mother, father and I live there. There is a big tree near our house. I play under that tree every day.",
  },
];

/* =====================================================
   READING COMPONENT
===================================================== */

function Reading({ onBack, onComplete, onContinue }) {
  const [activeTab, setActiveTab] = useState("words");

  const [wordIndex, setWordIndex] = useState(0);
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [storyIndex, setStoryIndex] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioStatus, setAudioStatus] = useState("");
  const audioRef = useRef(null);

  const [completedWords, setCompletedWords] = useState([]);
  const [completedSentences, setCompletedSentences] = useState([]);
  const [completedStories, setCompletedStories] = useState([]);
  const [readingLoaded, setReadingLoaded] = useState(false);

  /* =====================================================
     LOAD SAVED PROGRESS
  ===================================================== */

  useEffect(() => {
    let active = true;
    const convertProgress = (value) => {
      if (Array.isArray(value)) return value;
      const count = Number(value || 0);
      return Array.from({ length: count }, (_, index) => index);
    };

    fetch("/api/progress", { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        const remote = result?.progress?.reading;
        if (!active) return;
        setCompletedWords(convertProgress(remote?.words));
        setCompletedSentences(convertProgress(remote?.sentences));
        setCompletedStories(convertProgress(remote?.stories));
      })
      .catch(() => {})
      .finally(() => {
        if (active) setReadingLoaded(true);
      });

    return () => {
      active = false;
    };
  }, []);

  /* =====================================================
     SAVE PROGRESS
  ===================================================== */

  useEffect(() => {
    if (!readingLoaded) return;
    const progressData = {
      words: completedWords,
      sentences: completedSentences,
      stories: completedStories,
    };

    fetch("/api/progress", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ reading: progressData }),
    }).catch(() => {});

    /*
      Custom event allows Progress to update immediately
      if both components are active.
    */

    window.dispatchEvent(
      new CustomEvent("tamilthadamReadingProgressUpdated")
    );
  }, [
    completedWords,
    completedSentences,
    completedStories,
    readingLoaded,
  ]);

  /* =====================================================
     TOTAL READING ACTIVITIES
  ===================================================== */

  const totalActivities =
    words.length +
    sentences.length +
    stories.length;

  const completedActivities =
    completedWords.length +
    completedSentences.length +
    completedStories.length;

  const progress =
    totalActivities === 0
      ? 0
      : Math.round(
          (completedActivities / totalActivities) * 100
        );

  useEffect(() => {
    if (progress === 100) {
      onComplete?.();
    }
  }, [progress, onComplete]);

  const word = words[wordIndex];
  const sentence = sentences[sentenceIndex];
  const story = stories[storyIndex];

  /* =====================================================
     WORD COMPLETE
  ===================================================== */

  const toggleWordComplete = () => {
    setCompletedWords((prev) =>
      prev.includes(wordIndex)
        ? prev.filter((index) => index !== wordIndex)
        : [...prev, wordIndex]
    );
  };

  /* =====================================================
     SENTENCE COMPLETE
  ===================================================== */

  const toggleSentenceComplete = () => {
    setCompletedSentences((prev) =>
      prev.includes(sentenceIndex)
        ? prev.filter((index) => index !== sentenceIndex)
        : [...prev, sentenceIndex]
    );
  };

  /* =====================================================
     STORY COMPLETE
  ===================================================== */

  const toggleStoryComplete = () => {
    setCompletedStories((prev) =>
      prev.includes(storyIndex)
        ? prev.filter((index) => index !== storyIndex)
        : [...prev, storyIndex]
    );
  };
  const handleAudio = () => {
    if (isSpeaking && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
      setIsSpeaking(false);
      setAudioStatus("Audio stopped.");
      return;
    }

    const itemIndex =
      activeTab === "words"
        ? wordIndex
        : activeTab === "sentences"
          ? sentenceIndex
          : storyIndex;
    const audioPath = `/audio/reading/${activeTab}/${String(itemIndex + 1).padStart(2, "0")}.mp3`;

    audioRef.current?.pause();
    const audio = new Audio(audioPath);
    audio.preload = "auto";
    audioRef.current = audio;

    audio.onended = () => {
      audioRef.current = null;
      setIsSpeaking(false);
      setAudioStatus("Audio finished.");
    };
    audio.onerror = () => {
      audioRef.current = null;
      setIsSpeaking(false);
      setAudioStatus("Could not play this audio. Please try again.");
    };

    try {
      const playback = audio.play();
      setIsSpeaking(true);
      setAudioStatus("Playing Tamil audio. Tap the speaker to stop.");
      playback?.catch(() => {
        audioRef.current = null;
        setIsSpeaking(false);
        setAudioStatus("Could not play this audio. Please try again.");
      });
    } catch {
      audioRef.current = null;
      setIsSpeaking(false);
      setAudioStatus("Could not play this audio. Please try again.");
    }
  };
  useEffect(() => {
    window.speechSynthesis?.cancel();
    audioRef.current?.pause();
    audioRef.current = null;
    setIsSpeaking(false);
    setAudioStatus("");
  }, [activeTab, wordIndex, sentenceIndex, storyIndex]);

  return (
    <div className="reading-page">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="reading-header">

        <div className="reading-header-actions">
          <button
            className="reading-back"
            onClick={onBack}
          >
            ← Back to Home
          </button>

          
        </div>

        <div>
          <div className="reading-badge">
            📖 READING
          </div>

          <h1>
            Read Tamil with confidence.
          </h1>

          <p>
            Learn words, understand sentences,
            and enjoy short Tamil stories.
          </p>
        </div>

      </div>

      <p className="reading-audio-note" role="note">
        <strong>Important:</strong> Tap the speaker below the word count or beside Mark as Read to hear the current Tamil word, sentence, or story.
      </p>
      {audioStatus && <p className="reading-audio-status" role="status">{audioStatus}</p>}
      {/* =================================================
          READING PROGRESS
      ================================================= */}

      <div className="reading-progress-card">

        <div>
          <strong>
            Reading Progress
          </strong>

          <span>
            {completedActivities} / {totalActivities} activities completed
          </span>
        </div>

        <div className="reading-progress-bar">
          <div
            style={{
              width: `${progress}%`,
            }}
          />
        </div>

        <strong className="reading-percentage">
          {progress}%
        </strong>

      </div>

      {progress === 100 && (
        <section className="reading-stage-milestone" aria-live="polite">
          <span aria-hidden="true">🏆</span>
          <div>
            <strong>Reading milestone complete!</strong>
            <p>You finished every word, sentence, and story. Thirukkural is unlocked.</p>
          </div>
          <button type="button" onClick={onContinue}>Continue to Thirukkural →</button>
        </section>
      )}

      {/* =================================================
          TABS
      ================================================= */}

      <div className="reading-tabs">

        <button
          className={
            activeTab === "words"
              ? "active"
              : ""
          }
          onClick={() => setActiveTab("words")}
        >
          📝 Words
        </button>

        <button
          className={
            activeTab === "sentences"
              ? "active"
              : ""
          }
          onClick={() => setActiveTab("sentences")}
        >
          💬 Sentences
        </button>

        <button
          className={
            activeTab === "stories"
              ? "active"
              : ""
          }
          onClick={() => setActiveTab("stories")}
        >
          📚 Short Stories
        </button>

      </div>

      {/* =================================================
          WORDS
      ================================================= */}

      {activeTab === "words" && (
        <section className="reading-content">

          <div className="reading-section-title">
            <span>📝</span>

            <div>
              <h2>Tamil Words</h2>

              <p>
                Learn simple Tamil words
                and their meanings.
              </p>
            </div>
          </div>

          <div className="sentence-card">

            <div className="activity-number">
              Word {wordIndex + 1} of {words.length}
            </div>
            <div className="reading-word-audio">
              <button
                className="reading-listen-button"
                type="button"
                onClick={handleAudio}
                aria-label={isSpeaking ? "Stop Tamil audio" : `Listen to ${word.tamil}`}
                aria-pressed={isSpeaking}
                title={isSpeaking ? "Stop audio" : `Listen to ${word.tamil}`}
              >
                <span aria-hidden="true">{isSpeaking ? "⏹" : "🔊"}</span>
              </button>
            </div>

            <div className="tamil-reading-text">
              {word.tamil}
            </div>

            <div className="english-reading-text">
              {word.english}
            </div>

<div className="reading-card-actions">
  <button className={completedWords.includes(wordIndex) ? "reading-complete completed" : "reading-complete"} onClick={toggleWordComplete}>
    {completedWords.includes(wordIndex) ? "✓ Completed" : "Mark as Read"}
  </button>
  
</div>
            {completedWords.includes(wordIndex) && (
              <p className="reading-encouragement" role="status">🌟 Word learned! You’re building your Tamil one step at a time.</p>
            )}

          </div>

          <div className="reading-navigation">

            <button
              disabled={wordIndex === 0}
              onClick={() =>
                setWordIndex((prev) =>
                  Math.max(0, prev - 1)
                )
              }
            >
              ← Previous
            </button>

            <div className="reading-dots">

              {words.map((_, index) => (
                <span
                  key={index}
                  className={
                    index === wordIndex
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setWordIndex(index)
                  }
                />
              ))}

            </div>

            <button
              disabled={
                wordIndex === words.length - 1
              }
              onClick={() =>
                setWordIndex((prev) =>
                  Math.min(
                    words.length - 1,
                    prev + 1
                  )
                )
              }
            >
              Next →
            </button>

          </div>

        </section>
      )}

      {/* =================================================
          SENTENCES
      ================================================= */}

      {activeTab === "sentences" && (
        <section className="reading-content">

          <div className="reading-section-title">
            <span>💬</span>

            <div>
              <h2>Simple Sentences</h2>

              <p>
                Read each sentence and
                understand its meaning.
              </p>
            </div>
          </div>

          <div className="sentence-card">

            <div className="activity-number">
              Sentence {sentenceIndex + 1} of {sentences.length}
            </div>

            <div className="tamil-reading-text">
              {sentence.tamil}
            </div>

            <div className="english-reading-text">
              {sentence.english}
            </div>

            <div className="reading-card-actions">
  <button className={completedSentences.includes(sentenceIndex) ? "reading-complete completed" : "reading-complete"} onClick={toggleSentenceComplete}>
    {completedSentences.includes(sentenceIndex) ? "✓ Completed" : "Mark as Read"}
  </button>
  <button className="reading-listen-button" type="button" onClick={handleAudio} aria-label={isSpeaking ? "Stop Tamil audio" : "Listen to this sentence"} aria-pressed={isSpeaking} title={isSpeaking ? "Stop audio" : "Listen to this sentence"}>
    <span aria-hidden="true">{isSpeaking ? "⏹" : "🔊"}</span>
  </button>
</div>
            {completedSentences.includes(sentenceIndex) && (
              <p className="reading-encouragement" role="status">👏 Sentence complete! Your reading confidence is growing.</p>
            )}

          </div>

          <div className="reading-navigation">

            <button
              disabled={sentenceIndex === 0}
              onClick={() =>
                setSentenceIndex((prev) =>
                  Math.max(0, prev - 1)
                )
              }
            >
              ← Previous
            </button>

            <div className="reading-dots">

              {sentences.map((_, index) => (
                <span
                  key={index}
                  className={
                    index === sentenceIndex
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setSentenceIndex(index)
                  }
                />
              ))}

            </div>

            <button
              disabled={
                sentenceIndex === sentences.length - 1
              }
              onClick={() =>
                setSentenceIndex((prev) =>
                  Math.min(
                    sentences.length - 1,
                    prev + 1
                  )
                )
              }
            >
              Next →
            </button>

          </div>

        </section>
      )}

      {/* =================================================
          SHORT STORIES
      ================================================= */}

      {activeTab === "stories" && (
        <section className="reading-content">

          <div className="reading-section-title">
            <span>📚</span>

            <div>
              <h2>Short Stories</h2>

              <p>
                Read short Tamil stories
                and understand the meaning.
              </p>
            </div>
          </div>

          <div className="story-card">

            <div className="activity-number">
              Story {storyIndex + 1} of {stories.length}
            </div>

            <h2 className="story-title">
              {story.title}
            </h2>

            <div className="story-tamil">

              {story.tamil
                .split("\n")
                .map((line, index) => (
                  <p key={index}>
                    {line}
                  </p>
                ))}

            </div>

            <div className="story-meaning">

              <strong>
                English Meaning
              </strong>

              <p>
                {story.meaning}
              </p>

            </div>

            <div className="reading-card-actions">
  <button className={completedStories.includes(storyIndex) ? "reading-complete completed" : "reading-complete"} onClick={toggleStoryComplete}>
    {completedStories.includes(storyIndex) ? "✓ Completed" : "Mark as Read"}
  </button>
  <button className="reading-listen-button" type="button" onClick={handleAudio} aria-label={isSpeaking ? "Stop Tamil audio" : "Listen to this story"} aria-pressed={isSpeaking} title={isSpeaking ? "Stop audio" : "Listen to this story"}>
    <span aria-hidden="true">{isSpeaking ? "⏹" : "🔊"}</span>
  </button>
</div>
            {completedStories.includes(storyIndex) && (
              <p className="reading-encouragement" role="status">🎉 Story complete! Wonderful reading—keep up the great work.</p>
            )}

          </div>

          <div className="reading-navigation">

            <button
              disabled={storyIndex === 0}
              onClick={() =>
                setStoryIndex((prev) =>
                  Math.max(0, prev - 1)
                )
              }
            >
              ← Previous
            </button>

            <div className="reading-story-count">
              {storyIndex + 1} / {stories.length}
            </div>

            <button
              disabled={
                storyIndex === stories.length - 1
              }
              onClick={() =>
                setStoryIndex((prev) =>
                  Math.min(
                    stories.length - 1,
                    prev + 1
                  )
                )
              }
            >
              Next →
            </button>

          </div>

        </section>
      )}

      {/* =================================================
          TIP
      ================================================= */}

      <div className="reading-footer-tip">

        <span>🌱</span>

        <p>
          Take your time. Read the Tamil word
          or sentence first, then check the
          English meaning.
        </p>

      </div>

    </div>
  );
}

export default Reading;
