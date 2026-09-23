import { useState } from "react";
import "./Quiz.css";

const quizQuestions = {
  1: [
    {
      question: "Which of these is a Tamil vowel?",
      options: ["க", "அ", "ச", "ட"],
      answer: "அ",
    },
    {
      question: "Which letter comes after அ?",
      options: ["ஆ", "இ", "ஈ", "உ"],
      answer: "ஆ",
    },
    {
      question: "Which of these is a Tamil vowel?",
      options: ["ம", "இ", "ந", "க"],
      answer: "இ",
    },
    {
      question: "Which of these is a Tamil vowel?",
      options: ["த்", "உ", "ப்", "க்"],
      answer: "உ",
    },
    {
      question: "Which letter comes after இ?",
      options: ["அ", "ஆ", "ஈ", "உ"],
      answer: "ஈ",
    },
  ],

2: [
  {
    question: "What letter comes after க்?",
    options: ["ங்", "ச்", "ஞ்", "ட்"],
    answer: "ங்",
  },
  {
    question: "What letter comes after ங்?",
    options: ["க்", "ச்", "ட்", "ண்"],
    answer: "ச்",
  },
  {
    question: "What letter comes after ச்?",
    options: ["ஞ்", "ட்", "த்", "ந்"],
    answer: "ஞ்",
  },
  {
    question: "What letter comes after ஞ்?",
    options: ["ண்", "ட்", "த்", "ப்"],
    answer: "ட்",
  },
  {
    question: "What letter comes after ட்?",
    options: ["த்", "ண்", "ந்", "ப்"],
    answer: "ண்",
  },
  {
    question: "What letter comes after ண்?",
    options: ["ந்", "த்", "ப்", "ம்"],
    answer: "த்",
  },
  {
    question: "What letter comes after த்?",
    options: ["ந்", "ப்", "ம்", "ய்"],
    answer: "ந்",
  },
  {
    question: "What letter comes after ந்?",
    options: ["ப்", "ம்", "ய்", "ர்"],
    answer: "ப்",
  },
  {
    question: "What letter comes after ப்?",
    options: ["ம்", "ய்", "ர்", "ல்"],
    answer: "ம்",
  },
  {
    question: "What letter comes after ம்?",
    options: ["ய்", "ர்", "ல்", "வ்"],
    answer: "ய்",
  },
  {
    question: "What letter comes after ய்?",
    options: ["ர்", "ல்", "வ்", "ழ்"],
    answer: "ர்",
  },
  {
    question: "What letter comes after ர்?",
    options: ["ல்", "வ்", "ழ்", "ள்"],
    answer: "ல்",
  },
  {
    question: "What letter comes after ல்?",
    options: ["வ்", "ழ்", "ள்", "ற்"],
    answer: "வ்",
  },
  {
    question: "What letter comes after வ்?",
    options: ["ழ்", "ள்", "ற்", "ன்"],
    answer: "ழ்",
  },
  {
    question: "What letter comes after ழ்?",
    options: ["ள்", "ற்", "ன்", "வ்"],
    answer: "ள்",
  },
  {
    question: "What letter comes after ள்?",
    options: ["ற்", "ன்", "ர்", "ல்"],
    answer: "ற்",
  },
  {
    question: "What letter comes after ற்?",
    options: ["ன்", "ள்", "ந்", "ம்"],
    answer: "ன்",
  },
  {
    question: "Which letter comes before ன்?",
    options: ["ற்", "ள்", "ழ்", "ர்"],
    answer: "ற்",
  },
],
};

function shuffleArray(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function getRandomQuestions(level) {
  const questionPool = quizQuestions[level] || quizQuestions[1];

  return shuffleArray(questionPool)
    .slice(0, 3)
    .map((question) => ({
      ...question,
      options: shuffleArray(question.options),
    }));
}

function Quiz({ onBack, onPass, level = 1 }) {
  const [questions, setQuestions] = useState(() =>
    getRandomQuestions(level)
  );

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [finished, setFinished] = useState(false);

  const question = questions[currentQuestion];
  const selectedIsCorrect = selectedAnswer === question?.answer;

  const resetQuiz = () => {
    setQuestions(getRandomQuestions(level));
    setCurrentQuestion(0);
    setScore(0);
    setSelectedAnswer(null);
    setFinished(false);
  };

  const handleAnswer = (option) => {
   

    setSelectedAnswer(option);
  };

  const handleNext = () => {
    const isCorrect = selectedAnswer === question.answer;
    const newScore = isCorrect ? score + 1 : score;

    if (currentQuestion < questions.length - 1) {
      if (isCorrect) {
        setScore(newScore);
      }

      setCurrentQuestion((previous) => previous + 1);
      setSelectedAnswer(null);
    } else {
      setScore(newScore);
      setFinished(true);
    }
  };

  if (finished) {
    const passed = score >= 2;

    return (
      <div className="quiz-page">
        <div className="quiz-result">
          {passed ? (
            <>
            <div className="result-icon">🎉</div>
              <div className="quiz-celebration" aria-hidden="true">✨🎊✨</div>

              <p className="quiz-label">
                LEVEL {level} COMPLETED
              </p>

              <h1>Quiz Passed!</h1>

              <p className="result-score">
                Your Score: <strong>{score} / 3</strong>
              </p>

              <div className="milestone-box">
                <span>🏆</span>

                <div>
                  <h3>Milestone Unlocked</h3>
                  <p>
                    {level === 1
                      ? "First Letter Explorer"
                      : level === 2
                      ? "Tamil Letter Builder"
                      : "Tamil Letter Explorer"}
                  </p>
                </div>
              </div>

              <div className="result-buttons">
                <button
                  className="retry-button"
                  onClick={resetQuiz}
                >
                  Retry Quiz
                </button>

                <button
                  className="next-level-button"
                  onClick={onPass}
                >
                  Next Level →
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="result-icon">💪</div>
              <div className="quiz-encouragement" role="status">
                Every answer is practice. Review the letters and give it another try 🌱
              </div>

              <p className="quiz-label">
                LEVEL {level}
              </p>

              <h1>Keep Practicing</h1>

              <p className="result-score">
                Your Score: <strong>{score} / 3</strong>
              </p>

              <p className="result-message">
                You need at least 2 out of 3 correct answers to pass.
              </p>

              <button
                className="retry-button"
                onClick={resetQuiz}
              >
                Retry Quiz
              </button>
            </>
          )}

          <button
            className="quiz-back-result"
            onClick={onBack}
          >
            ← Back to Letters
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-page">
      <button className="quiz-back" onClick={onBack}>
        ← Back to Letters
      </button>

      <div className="quiz-header">
        <p className="quiz-label">
          TAMIL LETTERS • LEVEL {level}
        </p>

        <h1>Level {level} Quiz</h1>

        <p>
          Answer 3 questions. You need at least 2 correct
          answers to pass.
        </p>
      </div>

      <div className="quiz-card">
        <div className="quiz-progress">
          <span>
            Question {currentQuestion + 1} of {questions.length}
          </span>

          <span>
            Score: {score} / {questions.length}
          </span>
        </div>

        <div className="quiz-progress-bar">
          <div
            className="quiz-progress-fill"
            style={{
              width: `${
                ((currentQuestion + 1) /
                  questions.length) *
                100
              }%`,
            }}
          ></div>
        </div>

        <div className="question">
          <p className="question-number">
            QUESTION {currentQuestion + 1}
          </p>

          <h2>{question.question}</h2>

          <div className="answer-options">
            {question.options.map((option) => (
              <button
                key={option}
                className={
                  selectedAnswer === option
                    ? "selected-answer"
                    : ""
                }
                onClick={() => handleAnswer(option)}
              >
                {option}
              </button>
            ))}
          </div>
          {selectedAnswer && (
            <p className={`quiz-answer-feedback ${selectedIsCorrect ? "is-correct" : "keep-trying"}`} role="status">
              {selectedIsCorrect
                ? "Great choice! You got it 🌟"
                : "Close! Look carefully at the letter shapes and try another choice 💛"}
            </p>
          )}
        </div>

        <button
          className="next-question"
          onClick={handleNext}
          disabled={!selectedAnswer}
        >
          {currentQuestion === questions.length - 1
            ? "Finish Quiz"
            : "Next Question →"}
        </button>
      </div>
    </div>
  );
}

export default Quiz;
