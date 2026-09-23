import { useEffect, useRef, useState } from "react";
import "./Writing.css";

const writingLetters = [
  "அ",
  "ஆ",
  "இ",
  "ஈ",
  "உ",
  "ஊ",
  "எ",
  "ஏ",
  "ஐ",
  "ஒ",
  "ஓ",
  "ஔ",
];

const MATCH_SIZE = 180;
const PADDING = 18;
const MATCH_THRESHOLD = 0.85;

function Writing({ onBack, onLevel2, level = 1 }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const hasDrawingRef = useRef(false);

  const [currentLetter, setCurrentLetter] = useState(0);
  const [result, setResult] = useState("");

  const letter = writingLetters[currentLetter];

  /* ---------------- RESET WHEN LETTER CHANGES ---------------- */

  useEffect(() => {
    clearCanvas();
    setResult("");
  }, [currentLetter]);

  /* ---------------- GET POINTER POSITION ---------------- */

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
        ((point.clientX - rect.left) / rect.width) *
        canvas.width,

      y:
        ((point.clientY - rect.top) / rect.height) *
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

    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#176b3a";

    ctx.beginPath();
    ctx.moveTo(position.x, position.y);

    /* Small pencil dot */

    ctx.beginPath();

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

    hasDrawingRef.current = false;
    drawingRef.current = false;
  }

  /* ---------------- FIND BOUNDING BOX ---------------- */

  function getBoundingBox(imageData) {
    const {
      width,
      height,
      data,
    } = imageData;

    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha =
          data[(y * width + x) * 4 + 3];

        if (alpha > 30) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
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

  /* ---------------- NORMALIZE IMAGE ---------------- */

  function normalizeImage(sourceCanvas) {
    const sourceCtx =
      sourceCanvas.getContext("2d");

    const sourceData =
      sourceCtx.getImageData(
        0,
        0,
        sourceCanvas.width,
        sourceCanvas.height
      );

    const box = getBoundingBox(sourceData);

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

  /* ---------------- CREATE LETTER TEMPLATE ---------------- */

  function createLetterTemplate(character) {
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
      '130px "Noto Sans Tamil", "Nirmala UI", "Latha", sans-serif';

    ctx.fillText(
      character,
      MATCH_SIZE / 2,
      MATCH_SIZE / 2 + 5
    );

    return normalizeImage(canvas);
  }

  /* ---------------- CREATE MASK ---------------- */

  function getMask(canvas) {
    const ctx =
      canvas.getContext("2d");

    const image =
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
        image.data[i * 4 + 3];

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

  /* ---------------- DILATE ---------------- */

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
              dx * dx + dy * dy <=
                radius * radius &&
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

  /* ---------------- COMPARE ---------------- */

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

    let userInsideTarget = 0;
    let targetInsideUser = 0;

    for (
      let i = 0;
      i < userMask.length;
      i++
    ) {
      if (
        userMask[i] &&
        targetDilated[i]
      ) {
        userInsideTarget++;
      }

      if (
        targetMask[i] &&
        userDilated[i]
      ) {
        targetInsideUser++;
      }
    }

    const userCoverage =
      userInsideTarget / userPixels;

    const targetCoverage =
      targetInsideUser / targetPixels;

    if (
      userCoverage + targetCoverage === 0
    ) {
      return 0;
    }

    return (
      (2 *
        userCoverage *
        targetCoverage) /
      (userCoverage + targetCoverage)
    );
  }

  /* ---------------- CHECK DRAWING ---------------- */

  function checkDrawing() {
    const canvas = canvasRef.current;

    if (
      !canvas ||
      !hasDrawingRef.current
    ) {
      setResult("wrong");
      return;
    }

    const normalizedUser =
      normalizeImage(canvas);

    if (!normalizedUser) {
      setResult("wrong");
      return;
    }

    const normalizedTarget =
      createLetterTemplate(letter);

    if (!normalizedTarget) {
      setResult("wrong");
      return;
    }

    const userMask =
      getMask(normalizedUser);

    const targetMask =
      getMask(normalizedTarget);

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

  /* ---------------- NEXT LETTER ---------------- */

  function nextLetter() {
    if (
      currentLetter <
      writingLetters.length - 1
    ) {
      setCurrentLetter(
        currentLetter + 1
      );

      setResult("");
    } else {
      /*
        IMPORTANT:
        Level 1 does NOT automatically
        open Level 2.

        It only shows the completion
        screen.
      */

      setResult("completed");
    }
  }

  /* ---------------- SKIP ---------------- */

  function skipLetter() {
    if (
      currentLetter <
      writingLetters.length - 1
    ) {
      setCurrentLetter(
        currentLetter + 1
      );

      setResult("");
    } else {
      /*
        Skipping the final letter
        completes Level 1 only.
      */

      setResult("completed");
    }
  }

  /* ---------------- RESTART ---------------- */

  function restartPractice() {
    setCurrentLetter(0);
    setResult("");
    clearCanvas();
  }

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
          Writing Practice
        </h1>

        <p>
          Trace the Tamil letters using
          your mouse, touchpad, or finger.
        </p>

      </div>

      {/* CARD */}

      <div className="writing-card">

        {result === "completed" ? (

          /* ---------------- COMPLETED ---------------- */

          <>
            <div className="writing-complete-icon">
              🎉
            </div>
            <div className="writing-celebration" aria-hidden="true">✨🌟✨</div>

            <span className="writing-badge">
              COMPLETED
            </span>

            <h2>
              Writing Practice Completed!
            </h2>

            <p>
              Great job! You practiced all
              12 Tamil vowels.
            </p>

            {/* PRACTICE AGAIN */}

            <button
              className="writing-start"
              onClick={restartPractice}
            >
              Practice Again →
            </button>

            {/* CONTINUE TO LEVEL 2 */}

            {onLevel2 && (
              <button
                className="writing-start"
                onClick={onLevel2}
                style={{
                  marginTop: "12px",
                }}
              >
                Continue to Level 2 →
              </button>
            )}
          </>

        ) : (

          /* ---------------- PRACTICE ---------------- */

          <>

            {/* PROGRESS */}

            <div className="writing-progress">

              <span>
                Letter{" "}
                {currentLetter + 1} of{" "}
                {writingLetters.length}
              </span>

              <span>
                {Math.round(
                  ((currentLetter + 1) /
                    writingLetters.length) *
                    100
                )}
                %
              </span>

            </div>

            <div className="writing-progress-bar">

              <div
                className="writing-progress-fill"
                style={{
                  width: `${
                    ((currentLetter + 1) /
                      writingLetters.length) *
                    100
                  }%`,
                }}
              />

            </div>

            {/* LEVEL */}

            <span className="writing-badge">
              LEVEL 1
            </span>

            <h2>
              Trace this Tamil letter
            </h2>

            <div className="writing-letter">
              {letter}
            </div>

            <p className="writing-instruction">
              Draw the letter in the box below.
            </p>

            {/* CANVAS */}

            <div className="writing-canvas-wrapper">

              <div className="writing-guide">
                {letter}
              </div>

              <canvas
                ref={canvasRef}
                className="writing-canvas"
                width="500"
                height="300"

                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}

                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />

            </div>

            {/* CORRECT */}

            {result === "correct" && (
              <p className="writing-feedback correct" role="status">
                <span className="feedback-emoji" aria-hidden="true">🌟</span>
                Lovely writing! You matched the letter. Keep going!
              </p>
            )}

            {/* WRONG */}

            {result === "wrong" && (
              <p className="writing-feedback wrong" role="status">
                <span className="feedback-emoji" aria-hidden="true">💛</span>
                Nice try! Compare your strokes with the pale guide, then try again.
                <br />
                Every attempt helps your hand remember the shape.
              </p>
            )}

            {/* ACTIONS */}

            <div className="writing-actions">

              {/* CLEAR */}

              <button
                className="clear-button"
                onClick={() => {
                  clearCanvas();
                  setResult("");
                }}
              >
                Clear
              </button>

              {/* SKIP */}

              {level >= 1 &&
                level <= 3 &&
                result !== "correct" && (
                  <button
                    className="skip-button"
                    onClick={skipLetter}
                  >
                    Skip →
                  </button>
                )}

              {/* CHECK / NEXT */}

              {result === "correct" ? (

                <button
                  className="writing-start"
                  onClick={nextLetter}
                >
                  {currentLetter ===
                  writingLetters.length - 1
                    ? "Finish Practice"
                    : "Next Letter →"}
                </button>

              ) : (

                <button
                  className="writing-start"
                  onClick={checkDrawing}
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

export default Writing;
