import { useEffect, useRef, useState } from "react";
import "./Writing.css";

const basicWords = [
  "அம்மா",
  "அப்பா",
  "அண்ணா",
  "அக்கா",
  "பால்",
  "பூ",
  "மாடு",
  "வீடு",
  "மரம்",
  "நாய்",
  "மீன்",
  "பழம்",
];

const MATCH_SIZE = 220;
const PADDING = 15;
const MATCH_THRESHOLD = 0.70;

function WritingLevel2({ onBack, onComplete, onContinue }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const hasDrawingRef = useRef(false);

  const [currentWord, setCurrentWord] = useState(0);
  const [result, setResult] = useState("");

  const word = basicWords[currentWord];

  /* ---------------- RESET CURRENT WORD ---------------- */

  useEffect(() => {
    clearCanvas();
    setResult("");
  }, [currentWord]);

  /* ---------------- POINTER POSITION ---------------- */

  function getPosition(event) {
    const canvas = canvasRef.current;

    if (!canvas) {
      return { x: 0, y: 0 };
    }

    const rect = canvas.getBoundingClientRect();

    const point =
      event.touches && event.touches.length
        ? event.touches[0]
        : event;

    return {
      x:
        ((point.clientX - rect.left) /
          rect.width) *
        canvas.width,

      y:
        ((point.clientY - rect.top) /
          rect.height) *
        canvas.height,
    };
  }

  /* ---------------- START DRAWING ---------------- */

  function startDrawing(event) {
    event.preventDefault();

    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const position = getPosition(event);

    drawingRef.current = true;
    hasDrawingRef.current = true;

    ctx.beginPath();
    ctx.moveTo(position.x, position.y);

    /* Small pencil nib */
    ctx.arc(
      position.x,
      position.y,
      2,
      0,
      Math.PI * 2
    );

    ctx.fillStyle = "#176b3a";
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(position.x, position.y);
  }

  /* ---------------- DRAW ---------------- */

  function draw(event) {
    if (!drawingRef.current) return;

    event.preventDefault();

    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const position = getPosition(event);

    /* Easy small pencil stroke */
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#176b3a";

    ctx.lineTo(position.x, position.y);
    ctx.stroke();
  }

  /* ---------------- STOP DRAWING ---------------- */

  function stopDrawing(event) {
    if (event) {
      event.preventDefault();
    }

    drawingRef.current = false;
  }

  /* ---------------- CLEAR CANVAS ---------------- */

  function clearCanvas() {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    drawingRef.current = false;
    hasDrawingRef.current = false;
  }

  /* ---------------- BOUNDING BOX ---------------- */

  function getBoundingBox(imageData) {
    const { width, height, data } = imageData;

    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha =
          data[(y * width + x) * 4 + 3];

        if (alpha > 30) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX === -1) {
      return null;
    }

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
  }

  /* ---------------- NORMALIZE DRAWING ---------------- */

  function normalizeCanvas(sourceCanvas) {
    const sourceCtx =
      sourceCanvas.getContext("2d");

    const imageData =
      sourceCtx.getImageData(
        0,
        0,
        sourceCanvas.width,
        sourceCanvas.height
      );

    const box = getBoundingBox(imageData);

    if (!box) {
      return null;
    }

    const output =
      document.createElement("canvas");

    output.width = MATCH_SIZE;
    output.height = MATCH_SIZE;

    const ctx = output.getContext("2d");

    const available =
      MATCH_SIZE - PADDING * 2;

    const scale = Math.min(
      available / box.width,
      available / box.height
    );

    const newWidth =
      box.width * scale;

    const newHeight =
      box.height * scale;

    const x =
      (MATCH_SIZE - newWidth) / 2;

    const y =
      (MATCH_SIZE - newHeight) / 2;

    ctx.drawImage(
      sourceCanvas,
      box.minX,
      box.minY,
      box.width,
      box.height,
      x,
      y,
      newWidth,
      newHeight
    );

    return output;
  }

  /* ---------------- WORD TEMPLATE ---------------- */

  function createWordTemplate(text) {
    const canvas =
      document.createElement("canvas");

    canvas.width = MATCH_SIZE;
    canvas.height = MATCH_SIZE;

    const ctx = canvas.getContext("2d");

    ctx.clearRect(
      0,
      0,
      MATCH_SIZE,
      MATCH_SIZE
    );

    ctx.fillStyle = "#000";

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font =
      '70px "Noto Sans Tamil", "Nirmala UI", "Latha", sans-serif';

    ctx.fillText(
      text,
      MATCH_SIZE / 2,
      MATCH_SIZE / 2
    );

    return normalizeCanvas(canvas);
  }

  /* ---------------- CREATE MASK ---------------- */

  function getMask(canvas) {
    const ctx =
      canvas.getContext("2d");

    const imageData =
      ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      );

    const mask = new Uint8Array(
      canvas.width * canvas.height
    );

    for (let i = 0; i < mask.length; i++) {
      const alpha =
        imageData.data[i * 4 + 3];

      mask[i] =
        alpha > 40 ? 1 : 0;
    }

    return mask;
  }

  /* ---------------- COUNT PIXELS ---------------- */

  function countPixels(mask) {
    let count = 0;

    for (let i = 0; i < mask.length; i++) {
      if (mask[i]) {
        count++;
      }
    }

    return count;
  }

  /* ---------------- DILATE MASK ---------------- */

  function dilate(mask, radius = 8) {
    const output =
      new Uint8Array(mask.length);

    for (let y = 0; y < MATCH_SIZE; y++) {
      for (let x = 0; x < MATCH_SIZE; x++) {

        let found = false;

        for (
          let dy = -radius;
          dy <= radius && !found;
          dy++
        ) {
          for (
            let dx = -radius;
            dx <= radius;
            dx++
          ) {
            if (
              dx * dx + dy * dy >
              radius * radius
            ) {
              continue;
            }

            const nx = x + dx;
            const ny = y + dy;

            if (
              nx < 0 ||
              ny < 0 ||
              nx >= MATCH_SIZE ||
              ny >= MATCH_SIZE
            ) {
              continue;
            }

            if (
              mask[
                ny * MATCH_SIZE + nx
              ]
            ) {
              found = true;
              break;
            }
          }
        }

        if (found) {
          output[
            y * MATCH_SIZE + x
          ] = 1;
        }
      }
    }

    return output;
  }

  /* ---------------- COMPARE DRAWING ---------------- */

  function compareMasks(
    userMask,
    targetMask
  ) {
    const userPixels =
      countPixels(userMask);

    const targetPixels =
      countPixels(targetMask);

    if (
      userPixels < 50 ||
      targetPixels < 50
    ) {
      return 0;
    }

    const userDilated =
      dilate(userMask, 8);

    const targetDilated =
      dilate(targetMask, 8);

    let userMatch = 0;
    let targetMatch = 0;

    for (
      let i = 0;
      i < userMask.length;
      i++
    ) {
      if (
        userMask[i] &&
        targetDilated[i]
      ) {
        userMatch++;
      }

      if (
        targetMask[i] &&
        userDilated[i]
      ) {
        targetMatch++;
      }
    }

    const userCoverage =
      userMatch / userPixels;

    const targetCoverage =
      targetMatch / targetPixels;

    if (
      userCoverage + targetCoverage === 0
    ) {
      return 0;
    }

    return (
      (2 *
        userCoverage *
        targetCoverage) /
      (userCoverage +
        targetCoverage)
    );
  }

  /* ---------------- CHECK WRITING ---------------- */

  function checkWriting() {
    const canvas = canvasRef.current;

    if (
      !canvas ||
      !hasDrawingRef.current
    ) {
      setResult("wrong");
      return;
    }

    const userCanvas =
      normalizeCanvas(canvas);

    if (!userCanvas) {
      setResult("wrong");
      return;
    }

    const targetCanvas =
      createWordTemplate(word);

    if (!targetCanvas) {
      setResult("wrong");
      return;
    }

    const userMask =
      getMask(userCanvas);

    const targetMask =
      getMask(targetCanvas);

    const score =
      compareMasks(
        userMask,
        targetMask
      );

    if (score >= MATCH_THRESHOLD) {
      setResult("correct");
    } else {
      setResult("wrong");
    }
  }

  /* ---------------- NEXT WORD ---------------- */

  function nextWord() {
    if (
      currentWord <
      basicWords.length - 1
    ) {
      setCurrentWord(
        currentWord + 1
      );

      setResult("");
    } else {
      setResult("completed");
      onComplete?.();
    }
  }

  /* ---------------- SKIP WORD ---------------- */

  function skipWord() {
    if (
      currentWord <
      basicWords.length - 1
    ) {
      setCurrentWord(
        currentWord + 1
      );

      setResult("");
    } else {
      setResult("completed");
      onComplete?.();
    }
  }

  /* ---------------- RESTART ---------------- */

  function restartPractice() {
    setCurrentWord(0);
    setResult("");
    clearCanvas();
  }

  const progress =
    ((currentWord + 1) /
      basicWords.length) *
    100;

  /* ---------------- UI ---------------- */

  return (
    <div className="writing-page">

      {/* BACK */}

      <button
        className="writing-back"
        onClick={onBack}
      >
        ← Back to Tamil Letters
      </button>

      {/* HEADER */}

      <div className="writing-header">

        <p>
          LEARN • WRITING
        </p>

        <h1>
          Basic Tamil Words
        </h1>

        <p>
          Practice writing simple Tamil
          words using your mouse,
          touchpad, or finger.
        </p>

      </div>

      {/* CARD */}

      <div className="writing-card">

            {result === "completed" ? (

          <>
              <div className="writing-complete-icon">
                🎉
              </div>
              <div className="writing-celebration" aria-hidden="true">✨🌟✨</div>

            <span className="writing-badge">
              COMPLETED
            </span>

            <h2>
              Level 2 Completed!
            </h2>

            <p>
              Great job! You practiced all 12 basic Tamil words. Your next milestone is ready.
            </p>

            <button
              className="writing-start writing-next-stage"
              onClick={onContinue}
            >
              Continue to Reading →
            </button>

            <button
              className="writing-start"
              onClick={restartPractice}
            >
              Practice Again →
            </button>
          </>

        ) : (

          <>

            {/* PROGRESS */}

            <div className="writing-progress">

              <span>
                Word {currentWord + 1} of{" "}
                {basicWords.length}
              </span>

              <span>
                {Math.round(progress)}%
              </span>

            </div>

            <div className="writing-progress-bar">

              <div
                className="writing-progress-fill"
                style={{
                  width: `${progress}%`,
                }}
              />

            </div>

            {/* LEVEL */}

            <span className="writing-badge">
              LEVEL 2
            </span>

            <h2>
              Write this Tamil word
            </h2>

            <div className="writing-letter">
              {word}
            </div>

            <p className="writing-instruction">
              Draw the complete word
              in the box below.
            </p>

            {/* CANVAS */}

            <div className="writing-canvas-wrapper">

              <div className="writing-guide">
                {word}
              </div>

              <canvas
                ref={canvasRef}
                className="writing-canvas"
                width="500"
                height="300"

                onMouseDown={
                  startDrawing
                }

                onMouseMove={
                  draw
                }

                onMouseUp={
                  stopDrawing
                }

                onMouseLeave={
                  stopDrawing
                }

                onTouchStart={
                  startDrawing
                }

                onTouchMove={
                  draw
                }

                onTouchEnd={
                  stopDrawing
                }
              />

            </div>

            {/* FEEDBACK */}

            {result === "correct" && (
              <p className="writing-feedback correct" role="status">
                <span className="feedback-emoji" aria-hidden="true">🌟</span>
                Beautiful effort! You matched the Tamil word. Keep going!
              </p>
            )}

            {result === "wrong" && (
              <p className="writing-feedback wrong" role="status">
                <span className="feedback-emoji" aria-hidden="true">💛</span>
                Good try! Compare each part with the pale guide and try again.
                <br />
                Your practice is helping you improve.
              </p>
            )}

            {/* ACTIONS */}

            <div className="writing-actions">

              <button
                className="clear-button"
                onClick={() => {
                  clearCanvas();
                  setResult("");
                }}
              >
                Clear
              </button>

              {result !== "correct" && (
                <button
                  className="skip-button"
                  onClick={skipWord}
                >
                  Skip →
                </button>
              )}

              {result === "correct" ? (

                <button
                  className="writing-start"
                  onClick={nextWord}
                >
                  {currentWord ===
                  basicWords.length - 1
                    ? "Finish Level"
                    : "Next Word →"}
                </button>

              ) : (

                <button
                  className="writing-start"
                  onClick={checkWriting}
                >
                  Check Writing
                </button>

              )}

            </div>

          </>

        )}

      </div>

    </div>
  );
}

export default WritingLevel2;
