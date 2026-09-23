import { useEffect, useState } from "react";
import "./Thirukkural.css";

const kurals = [
  {
    number: 100,
    couplet: ["இனிய உளவாக இன்னாத கூறல்", "கனியிருப்பக் காய்கவர்ந் தற்று"],
    meaning: "இனிமையாகப் பேச முடியும் போது கடுமையாகப் பேசுவது, பழுத்த கனியை விட்டுவிட்டு காயைப் பறிப்பதைப் போன்றது.",
  },
  {
    number: 129,
    couplet: ["தீயினாற் சுட்டபுண் உள்ளாறும் ஆறாதே", "நாவினாற் சுட்ட வடு."],
    meaning: "தீயால் ஏற்பட்ட புண் ஆறிவிடும்; ஆனால் கடுஞ்சொல்லால் ஏற்பட்ட மனக்காயம் எளிதில் ஆறாது.",
  },
  {
    number: 131,
    couplet: ["ஒழுக்கம் விழுப்பந் தரலான் ஒழுக்கம்", "உயிரினும் ஓம்பப் படும்."],
    meaning: "ஒழுக்கம் உயர்வைத் தருவதால், அதை உயிரைவிட மேலாகப் போற்றிக் காக்க வேண்டும்.",
  },
  {
    number: 391,
    couplet: ["கற்க கசடறக் கற்பவை கற்றபின்", "நிற்க அதற்குத் தக."],
    meaning: "கற்க வேண்டியவற்றைப் பிழையின்றிக் கற்று, கற்றதற்கு ஏற்றபடி வாழ வேண்டும்.",
  },
  {
    number: 423,
    couplet: ["எப்பொருள் யார்யார் வாய்க் கேட்பினும் அப்பொருள்", "மெய்ப்பொருள் காண்பது அறிவு."],
    meaning: "யார் சொன்னாலும், ஒரு கருத்தின் உண்மையை ஆராய்ந்து அறிதலே அறிவாகும்.",
  },
];

function Thirukkural({ onBack, onComplete, onContinue }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [readKurals, setReadKurals] = useState([]);
  const [kuralsLoaded, setKuralsLoaded] = useState(false);
  const kural = kurals[currentIndex];
  const stageComplete = readKurals.length === kurals.length;

  useEffect(() => {
    let active = true;
    fetch("/api/progress", { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        const remote = result?.progress?.kuralRead;
        if (active) setReadKurals(Array.isArray(remote) ? remote : []);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setKuralsLoaded(true);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!kuralsLoaded) return;
    fetch("/api/progress", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ kuralRead: readKurals }),
    }).catch(() => {});
    if (stageComplete) onComplete?.();
  }, [readKurals, stageComplete, onComplete, kuralsLoaded]);

  const markKuralRead = () => {
    setReadKurals((previous) =>
      previous.includes(currentIndex)
        ? previous
        : [...previous, currentIndex].sort((a, b) => a - b)
    );
  };

  return (
    <div className="kural-page">
      <div className="kural-shell">
        <button className="kural-back" onClick={onBack}>
          ← Back to Learning Path
        </button>

        <header className="kural-header">
          <span className="kural-eyebrow">தமிழ் இலக்கியம்</span>
          <h1>திருக்குறள்</h1>
          <p>ஐந்து தேர்ந்தெடுக்கப்பட்ட குறள்கள் — எளிய தமிழ் பொருள்களுடன்</p>
          <p className="kural-progress-note">Read {readKurals.length} of {kurals.length} kurals to complete this milestone.</p>
        </header>

        <main className="kural-list" aria-live="polite">
          <article className="kural-card" key={kural.number}>
            <span className="kural-number">குறள் {kural.number}</span>
            <p className="kural-couplet">
              {kural.couplet[0]}
              <br />
              {kural.couplet[1]}
            </p>
            <div className="kural-meaning">
              <strong>பொருள்</strong>
              <p>{kural.meaning}</p>
            </div>
            <button
              className={readKurals.includes(currentIndex) ? "kural-mark-read is-read" : "kural-mark-read"}
              type="button"
              onClick={markKuralRead}
              disabled={readKurals.includes(currentIndex)}
            >
              {readKurals.includes(currentIndex) ? "✓ Kural completed" : "Mark this Kural as Read"}
            </button>
          </article>
        </main>

        {stageComplete && (
          <section className="kural-milestone" aria-live="polite">
            <span aria-hidden="true">🏆</span>
            <div>
              <strong>Thirukkural milestone complete!</strong>
              <p>You have read all five kurals and their meanings. Your progress page is ready.</p>
            </div>
            <button type="button" onClick={onContinue}>Continue to Progress →</button>
          </section>
        )}

        <nav className="kural-pagination" aria-label="Thirukkural pages">
          <button
            onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
            disabled={currentIndex === 0}
          >
            ← Previous
          </button>
          <span className="kural-page-count">
            Page {currentIndex + 1} of {kurals.length}
          </span>
          <button
            onClick={() =>
              setCurrentIndex((index) => Math.min(kurals.length - 1, index + 1))
            }
            disabled={currentIndex === kurals.length - 1}
          >
            Next →
          </button>
        </nav>

        <p className="kural-footer-note">
          ஒவ்வொரு குறளையும் மெதுவாகப் படித்து, அதன் பொருளைச் சிந்தியுங்கள்.
        </p>
      </div>
    </div>
  );
}

export default Thirukkural;
