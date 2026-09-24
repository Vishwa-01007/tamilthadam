import { createServer } from "node:http";
import { createHmac, randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { readFile, writeFile, rename, unlink, stat, mkdir } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { OAuth2Client } from "google-auth-library";
import pg from "pg";

try {
  const localEnv = await readFile(new URL("./.env", import.meta.url), "utf8");
  for (const line of localEnv.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    const value = match[2].replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, (_, doubleQuoted, singleQuoted) => doubleQuoted ?? singleQuoted);
    process.env[match[1]] = value;
  }
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const scrypt = promisify(scryptCallback);
const PORT = Number(process.env.PORT || process.env.API_PORT || 3001);
const APP_DIR = fileURLToPath(new URL(".", import.meta.url));
const DATA_DIR = process.env.DATA_DIR || APP_DIR;
const STORE_PATH = join(DATA_DIR, "server-data.json");
const DIST_DIR = join(APP_DIR, "dist");
const pool = process.env.DATABASE_URL ? new pg.Pool({ connectionString: process.env.DATABASE_URL }) : null;
let databaseReady;
const sessions = new Map();
const googleVerifier = new OAuth2Client();
const emailLoginCodes = new Map();
const emailCodeSends = new Map();
const otpHashKey = process.env.OTP_HASH_SECRET || randomBytes(32).toString("hex");
const OFFLINE_TAMIL_TRANSLATIONS = {
  hello: "வணக்கம்",
  "good morning": "காலை வணக்கம்",
  "thank you": "நன்றி",
  water: "தண்ணீர்",
  mother: "அம்மா",
  father: "அப்பா",
  home: "வீடு",
  house: "வீடு",
  school: "பள்ளி",
  friend: "நண்பர்",
  book: "புத்தகம்",
  tree: "மரம்",
  flower: "பூ",
  milk: "பால்",
  fish: "மீன்",
  dog: "நாய்",
  cow: "மாடு",
  fruit: "பழம்",
  love: "அன்பு",
  food: "உணவு",
  good: "நல்ல",
};

function normalizeEmail(value) {
  return String(value || "").trim().toLocaleLowerCase();
}

function hashLoginCode(email, code) {
  return createHmac("sha256", otpHashKey).update(`${email}:${code}`).digest("hex");
}

function allowLoginCodeSend(email) {
  const now = Date.now();
  const recent = (emailCodeSends.get(email) || []).filter((sentAt) => now - sentAt < 60 * 60 * 1000);
  if (recent.length >= 5) return { allowed: false, retryAfter: Math.ceil((recent[0] + 60 * 60 * 1000 - now) / 1000) };
  if (recent.length && now - recent[recent.length - 1] < 60 * 1000) {
    return { allowed: false, retryAfter: Math.ceil((recent[recent.length - 1] + 60 * 1000 - now) / 1000) };
  }
  recent.push(now);
  emailCodeSends.set(email, recent);
  return { allowed: true };
}

async function sendLoginCodeEmail(email, code) {
  const delivery = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [email],
      subject: "Your TamilThadam sign-in code",
      text: `Your TamilThadam sign-in code is ${code}. It expires in 10 minutes. If you did not request it, you can ignore this email.`,
      html: `<p>Your TamilThadam sign-in code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>`,
    }),
  });
  if (!delivery.ok) {
    console.error("Email code delivery failed:", delivery.status);
    throw new Error("We could not send your code right now. Please try again later.");
  }
}

async function syncLearnerToSheet(user) {
  const endpoint = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  const secret = process.env.GOOGLE_SHEETS_SYNC_SECRET;
  if (!endpoint || !secret || !user?.id) return;
  try {
    const result = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret,
        learner: {
          id: user.id,
          username: user.username || "",
          email: user.email || "",
          learnerPath: user.progress?.learningTrack || "",
          progress: user.progress || {},
          createdAt: user.createdAt || "",
          lastLoginAt: user.lastLoginAt || "",
          updatedAt: new Date().toISOString(),
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await result.json().catch(() => null);
    if (!result.ok || payload?.ok !== true) {
      console.error("Google Sheets learner sync was rejected.");
    }
  } catch (error) {
    console.error("Google Sheets learner sync failed:", error.message);
  }
}

async function getGoogleClientId() {
  if (process.env.GOOGLE_CLIENT_ID) return process.env.GOOGLE_CLIENT_ID;
  try {
    const envText = await readFile(new URL("./.env", import.meta.url), "utf8");
    const value = envText.match(/^\s*GOOGLE_CLIENT_ID\s*=\s*["']?([^\r\n"']*)/m)?.[1]?.trim();
    return value || "";
  } catch {
    return "";
  }
}

async function initializeDatabase() {
  if (!pool) return;
  databaseReady ||= pool.query(`
    CREATE TABLE IF NOT EXISTS learners (
      auth_key TEXT PRIMARY KEY, id TEXT NOT NULL UNIQUE, username VARCHAR(40) NOT NULL,
      display_name VARCHAR(40) NOT NULL, email VARCHAR(254) NOT NULL DEFAULT '', age SMALLINT,
      salt TEXT, password_hash TEXT, auth_provider TEXT NOT NULL DEFAULT 'password', google_subject TEXT UNIQUE,
      progress JSONB NOT NULL DEFAULT '{}'::jsonb, activity JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_login_at TIMESTAMPTZ, last_active_at TIMESTAMPTZ
    )
  `);
  await databaseReady;
}

async function readStore() {
  if (pool) {
    await initializeDatabase();
    const { rows } = await pool.query("SELECT * FROM learners");
    return { users: Object.fromEntries(rows.map((row) => [row.auth_key, {
      id: row.id, username: row.username, displayName: row.display_name, email: row.email,
      age: row.age, salt: row.salt, passwordHash: row.password_hash, authProvider: row.auth_provider,
      googleSubject: row.google_subject, progress: row.progress || {}, activity: row.activity || [],
      createdAt: row.created_at?.toISOString?.() || row.created_at,
      lastLoginAt: row.last_login_at?.toISOString?.() || row.last_login_at,
      lastActiveAt: row.last_active_at?.toISOString?.() || row.last_active_at,
    }])) };
  }
  try {
    return JSON.parse(await readFile(new URL("./server-data.json", import.meta.url), "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { users: {} };
  }
}

async function writeStore(store) {
  if (pool) {
    await initializeDatabase();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const [key, user] of Object.entries(store.users)) {
        await client.query(`
          INSERT INTO learners (auth_key,id,username,display_name,email,age,salt,password_hash,auth_provider,google_subject,progress,activity,created_at,last_login_at,last_active_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13,$14,$15)
          ON CONFLICT (auth_key) DO UPDATE SET username=EXCLUDED.username, display_name=EXCLUDED.display_name,
          email=EXCLUDED.email, age=EXCLUDED.age, salt=EXCLUDED.salt, password_hash=EXCLUDED.password_hash,
          auth_provider=EXCLUDED.auth_provider, google_subject=EXCLUDED.google_subject, progress=EXCLUDED.progress,
          activity=EXCLUDED.activity, last_login_at=EXCLUDED.last_login_at, last_active_at=EXCLUDED.last_active_at
        `, [key,user.id,user.username,user.displayName||user.username,user.email||"",user.age??null,user.salt||null,
          user.passwordHash||null,user.authProvider||"password",user.googleSubject||null,JSON.stringify(user.progress||{}),
          JSON.stringify(user.activity||[]),user.createdAt||new Date().toISOString(),user.lastLoginAt||null,user.lastActiveAt||null]);
      }
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
    return;
  }
  // Use a unique sibling temp file so overlapping profile/progress saves do
  // not collide on Windows (which can report EPERM for the same open temp file).
  await mkdir(DATA_DIR, { recursive: true });
  const temporary = join(DATA_DIR, `server-data.${randomBytes(8).toString("hex")}.tmp.json`);
  try {
    await writeFile(temporary, JSON.stringify(store, null, 2), { encoding: "utf8", flag: "wx" });
    await rename(temporary, STORE_PATH);
  } finally {
    await unlink(temporary).catch(() => {});
  }
}

function send(response, status, payload, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  response.end(JSON.stringify(payload));
}

async function readBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 64_000) throw new Error("Request is too large.");
  }
  return body ? JSON.parse(body) : {};
}

function getSessionUser(request) {
  const cookie = request.headers.cookie || "";
  const token = cookie.match(/(?:^|;\s*)tt_session=([^;]+)/)?.[1];
  return token ? sessions.get(token) : null;
}

function sessionCookie(token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `tt_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secure}`;
}

function isAdminUser(user) {
  const usernames = (process.env.ADMIN_USERNAMES || "").split(",").map((value) => value.trim().toLocaleLowerCase()).filter(Boolean);
  const emails = (process.env.ADMIN_EMAILS || "").split(",").map((value) => value.trim().toLocaleLowerCase()).filter(Boolean);
  return usernames.includes(String(user.username || "").toLocaleLowerCase()) || emails.includes(normalizeEmail(user.email));
}

async function createAccount(username, password) {
  const salt = randomBytes(16).toString("hex");
  const passwordHash = (await scrypt(password, salt, 64)).toString("hex");
  const now = new Date().toISOString();
  return { id: randomBytes(16).toString("hex"), username, displayName: username, salt, passwordHash, progress: {}, createdAt: now, lastLoginAt: now };
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    email: user.email || "",
    age: Number.isInteger(user.age) ? user.age : null,
    authProvider: user.authProvider || "password",
    isAdmin: isAdminUser(user),
  };
}

async function route(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  // In local development, return the OTP to the localhost UI so signup can be
  // tested without configuring an email provider. Never expose it in production.
  const requestOrigin = request.headers.origin;
  const isLocalOtpTest = process.env.NODE_ENV !== "production"
    && requestOrigin
    && ["localhost", "127.0.0.1"].includes(new URL(requestOrigin).hostname);

  if (request.method === "GET" && url.pathname === "/api/health") {
    return send(response, 200, { status: "ok", service: "TamilThadam API" });
  }

  if (request.method === "POST" && url.pathname === "/api/translate") {
    if (!getSessionUser(request)) return send(response, 401, { error: "Please sign in to translate." });
    const body = await readBody(request);
    const text = String(body.text || "").trim();
    if (!text) return send(response, 400, { error: "Enter or speak an English word first." });
    if (Buffer.byteLength(text, "utf8") > 500) {
      return send(response, 400, { error: "Please translate a shorter word or phrase (up to 500 bytes)." });
    }
    const offlineTranslation = OFFLINE_TAMIL_TRANSLATIONS[text.toLocaleLowerCase().replace(/[?.!,]+$/g, "").trim()];
    if (offlineTranslation) return send(response, 200, { translation: offlineTranslation, offline: true });

    try {
      const translationUrl = new URL("https://api.mymemory.translated.net/get");
      translationUrl.searchParams.set("q", text);
      translationUrl.searchParams.set("langpair", "en|ta");
      const translationResponse = await fetch(translationUrl, { signal: AbortSignal.timeout(12_000) });
      if (!translationResponse.ok) {
        return send(response, 502, { error: "The translation service is unavailable right now. Try again shortly." });
      }
      const result = await translationResponse.json();
      const translation = String(result?.responseData?.translatedText || "").trim();
      if (Number(result?.responseStatus) !== 200 || !translation) {
        return send(response, 502, { error: "I couldn’t find a Tamil translation for that. Try a shorter phrase." });
      }
      return send(response, 200, { translation });
    } catch {
      return send(response, 502, { error: "Could not connect to the translation service. Check your connection and try again." });
    }
  }

  if (request.method === "POST" && url.pathname === "/api/translate/speech") {
    if (!getSessionUser(request)) return send(response, 401, { error: "Please sign in to play Tamil audio." });
    const body = await readBody(request);
    const text = String(body.text || "").trim();
    if (!text) return send(response, 400, { error: "There is no Tamil text to read." });
    if (Buffer.byteLength(text, "utf8") > 500) {
      return send(response, 400, { error: "Please use a shorter phrase for audio." });
    }

    try {
      const speechUrl = new URL("https://translate.google.com/translate_tts");
      speechUrl.searchParams.set("ie", "UTF-8");
      speechUrl.searchParams.set("client", "tw-ob");
      speechUrl.searchParams.set("tl", "ta");
      speechUrl.searchParams.set("q", text);
      const speechResponse = await fetch(speechUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!speechResponse.ok) {
        return send(response, 502, { error: "Tamil audio is unavailable right now. Tap Hear it to try again." });
      }
      const audio = Buffer.from(await speechResponse.arrayBuffer());
      if (!audio.length) return send(response, 502, { error: "The Tamil audio service returned an empty recording." });
      response.writeHead(200, {
        "Content-Type": "audio/mpeg",
        "Content-Length": audio.length,
        "Cache-Control": "no-store",
      });
      response.end(audio);
    } catch {
      return send(response, 502, { error: "Could not connect to the Tamil audio service. Check your connection and try again." });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/send-code") {
    const body = await readBody(request);
    const email = normalizeEmail(body.email);
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return send(response, 400, { error: "Enter a valid email address." });
    }
    if (!isLocalOtpTest && (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM || !process.env.OTP_HASH_SECRET)) {
      return send(response, 503, { error: "Email sign-in is not configured yet. Please contact the site administrator." });
    }
    const rate = allowLoginCodeSend(email);
    if (!rate.allowed) {
      return send(response, 429, { error: `Please wait ${rate.retryAfter} seconds before requesting another code.` }, { "Retry-After": String(rate.retryAfter) });
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    emailLoginCodes.set(email, { codeHash: hashLoginCode(email, code), expiresAt: Date.now() + 10 * 60 * 1000, attempts: 0 });
    if (isLocalOtpTest) {
      return send(response, 200, { ok: true, developmentCode: code });
    }
    try {
      await sendLoginCodeEmail(email, code);
    } catch (error) {
      emailLoginCodes.delete(email);
      return send(response, 502, { error: error.message || "We could not send your code right now." });
    }
    return send(response, 200, { ok: true });
  }

  if (request.method === "POST" && url.pathname === "/api/auth/verify-code") {
    const body = await readBody(request);
    const email = normalizeEmail(body.email);
    const code = String(body.code || "").trim();
    const password = String(body.password || "");
    const confirmPassword = String(body.confirmPassword || "");
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(code)) {
      return send(response, 400, { error: "Enter your email and the 6-digit verification code." });
    }
    if (password.length < 8 || password.length > 200 || password !== confirmPassword) {
      return send(response, 400, { error: "Use a password of 8–200 characters and make sure both password fields match." });
    }
    const challenge = emailLoginCodes.get(email);
    if (!challenge) return send(response, 401, { error: "That code is invalid or expired. Request a new one." });
    challenge.attempts += 1;
    if (challenge.expiresAt <= Date.now()) {
      emailLoginCodes.delete(email);
      return send(response, 401, { error: "That code has expired. Request a new one." });
    }
    if (challenge.attempts > 5) {
      emailLoginCodes.delete(email);
      return send(response, 429, { error: "Too many incorrect attempts. Request a new code." });
    }
    const submittedHash = Buffer.from(hashLoginCode(email, code), "hex");
    const expectedHash = Buffer.from(challenge.codeHash, "hex");
    if (submittedHash.length !== expectedHash.length || !timingSafeEqual(submittedHash, expectedHash)) {
      return send(response, 401, { error: "That code is incorrect. Check the email and try again." });
    }
    emailLoginCodes.delete(email);

    const store = await readStore();
    let userKey = Object.keys(store.users).find((key) =>
      key.toLocaleLowerCase() === email || normalizeEmail(store.users[key].email) === email
    );
    let user = userKey ? store.users[userKey] : null;
    if (user?.passwordHash) {
      return send(response, 409, { error: "An account already uses this email. Sign in with your email and password." });
    }
    if (!user) {
      const username = email.split("@")[0].slice(0, 40);
      user = await createAccount(username, password);
      user.email = email;
      user.authProvider = "email-password";
      userKey = `email:${email}`;
      store.users[userKey] = user;
    } else {
      const credentials = await createAccount(user.username || email.split("@")[0].slice(0, 40), password);
      user.salt = credentials.salt;
      user.passwordHash = credentials.passwordHash;
      user.email = email;
      user.authProvider = "email-password";
    }
    await writeStore(store);
    void syncLearnerToSheet(user);
    const token = randomBytes(32).toString("hex");
    sessions.set(token, { key: userKey, id: user.id, username: user.username });
    return send(response, 200, { user: publicUser(user) }, { "Set-Cookie": sessionCookie(token) });
  }

  if (request.method === "POST" && url.pathname === "/api/auth/google") {
    const clientId = await getGoogleClientId();
    if (!clientId) {
      return send(response, 503, { error: "Google sign-in needs a Google OAuth Web Client ID." });
    }
    const body = await readBody(request);
    const credential = String(body.credential || "");
    let payload;
    try {
      const ticket = await googleVerifier.verifyIdToken({ idToken: credential, audience: clientId });
      payload = ticket.getPayload();
    } catch {
      return send(response, 401, { error: "Google could not verify this sign-in. Please try again." });
    }

    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      return send(response, 401, { error: "Use a Google account with a verified email address." });
    }

    const store = await readStore();
    let userKey = `google:${payload.sub}`;
    let user = store.users[userKey];
    if (!user) {
      const normalizedEmail = payload.email.toLocaleLowerCase();
      const existingKey = Object.keys(store.users).find((key) =>
        key !== userKey &&
        (key.toLocaleLowerCase() === normalizedEmail ||
          String(store.users[key].email || "").toLocaleLowerCase() === normalizedEmail)
      );

      if (existingKey) {
        const googleControlsEmail = normalizedEmail.endsWith("@gmail.com") ||
          (payload.hd && payload.email_verified === true);
        if (!googleControlsEmail) {
          return send(response, 409, { error: "This email already has an account. Sign in with that account first." });
        }
        userKey = existingKey;
        user = store.users[userKey];
        user.googleSubject = payload.sub;
        user.email = user.email || payload.email;
      } else {
        user = {
          id: randomBytes(16).toString("hex"),
          username: payload.email,
          displayName: payload.name || payload.email.split("@")[0],
          email: payload.email,
          age: null,
          googleSubject: payload.sub,
          authProvider: "google",
          progress: {},
        };
        store.users[userKey] = user;
      }
      await writeStore(store);
      void syncLearnerToSheet(user);
    }

    const token = randomBytes(32).toString("hex");
    sessions.set(token, { key: userKey, id: user.id, username: user.username });
    return send(response, 200, { user: publicUser(user) }, {
      "Set-Cookie": sessionCookie(token),
    });
  }

  if (request.method === "POST" && url.pathname === "/api/auth/register") {
    return send(response, 410, { error: "Account creation now requires email verification. Use the create-account form." });
  }

  if (request.method === "POST" && url.pathname === "/api/auth/login") {
    const body = await readBody(request);
    const email = normalizeEmail(body.email || body.username);
    const password = String(body.password || "");
    if (email.length < 2 || email.length > 254 || password.length < 8 || password.length > 200) {
      return send(response, 400, { error: "Enter your email or username and password." });
    }

    const store = await readStore();
    const key = Object.keys(store.users).find((candidateKey) =>
      candidateKey.toLocaleLowerCase() === email ||
      String(store.users[candidateKey].username || "").toLocaleLowerCase() === email ||
      normalizeEmail(store.users[candidateKey].email) === email
    );
    const user = key ? store.users[key] : null;
    if (!user?.salt || !user?.passwordHash) {
      return send(response, 401, { error: "Email or password is incorrect." });
    }
    const candidate = Buffer.from(await scrypt(password, user.salt, 64));
    const savedHash = Buffer.from(user.passwordHash, "hex");
    if (candidate.length !== savedHash.length || !timingSafeEqual(candidate, savedHash)) {
      return send(response, 401, { error: "Email or password is incorrect." });
    }

    user.lastLoginAt = new Date().toISOString();
    await writeStore(store);
    void syncLearnerToSheet(user);
    const token = randomBytes(32).toString("hex");
    sessions.set(token, { key, id: user.id, username: user.username });
    return send(response, 200, { user: publicUser(user) }, {
      "Set-Cookie": sessionCookie(token),
    });
  }

  if (request.method === "POST" && url.pathname === "/api/auth/logout") {
    const token = (request.headers.cookie || "").match(/(?:^|;\s*)tt_session=([^;]+)/)?.[1];
    if (token) sessions.delete(token);
    return send(response, 200, { ok: true }, {
      "Set-Cookie": "tt_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
    });
  }

  if ((request.method === "GET" || request.method === "HEAD") && !url.pathname.startsWith("/api/")) {
    const requestedPath = decodeURIComponent(url.pathname);
    const candidate = resolve(DIST_DIR, `.${requestedPath}`);
    if (candidate !== DIST_DIR && !candidate.startsWith(`${DIST_DIR}${sep}`)) return send(response, 400, { error: "Invalid path." });
    let filePath = candidate;
    try { if (!(await stat(filePath)).isFile()) filePath = join(DIST_DIR, "index.html"); }
    catch { filePath = join(DIST_DIR, "index.html"); }
    try {
      const content = await readFile(filePath);
      const types = { ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".ico": "image/x-icon", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".mp3": "audio/mpeg", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp" };
      response.writeHead(200, { "Content-Type": types[extname(filePath).toLowerCase()] || "application/octet-stream", "Cache-Control": filePath.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable" });
      return response.end(request.method === "HEAD" ? undefined : content);
    } catch { return send(response, 404, { error: "Page not found. Build the website before starting the server." }); }
  }

  const session = getSessionUser(request);
  if (!session) return send(response, 401, { error: "Please sign in to continue." });

  if (request.method === "GET" && url.pathname === "/api/admin/summary") {
    const store = await readStore();
    const admin = store.users[session.key];
    if (!admin || !isAdminUser(admin)) return send(response, 403, { error: "Admin access is not enabled for this account." });
    const learners = Object.values(store.users).map((user) => ({
      id: user.id, username: user.username, displayName: user.displayName || user.username,
      email: user.email || "", age: Number.isInteger(user.age) ? user.age : null,
      authProvider: user.authProvider || "password", createdAt: user.createdAt || null,
      lastLoginAt: user.lastLoginAt || null, lastActiveAt: user.lastActiveAt || null,
      progress: user.progress || {}, activity: (user.activity || []).slice(0, 20),
    }));
    return send(response, 200, { learners });
  }

  if (request.method === "POST" && url.pathname === "/api/activity") {
    const body = await readBody(request);
    const store = await readStore();
    const user = store.users[session.key];
    if (!user) return send(response, 401, { error: "Please sign in again." });
    user.activity ||= [];
    user.activity.unshift({ type: "stage_opened", stage: String(body.stage || "").slice(0, 40), at: new Date().toISOString() });
    user.activity = user.activity.slice(0, 100);
    user.lastActiveAt = new Date().toISOString();
    await writeStore(store);
    return send(response, 200, { ok: true });
  }

  if (request.method === "GET" && url.pathname === "/api/auth/me") {
    const store = await readStore();
    const user = store.users[session.key];
    if (!user) return send(response, 401, { error: "Please sign in again." });
    return send(response, 200, { user: publicUser(user) });
  }

  if (url.pathname === "/api/profile" && request.method === "GET") {
    const store = await readStore();
    const user = store.users[session.key];
    if (!user) return send(response, 401, { error: "Please sign in again." });
    return send(response, 200, { profile: publicUser(user) });
  }

  if (url.pathname === "/api/profile" && request.method === "PUT") {
    const body = await readBody(request);
    const displayName = String(body.displayName || "").trim();
    const email = String(body.email || "").trim();
    const age = body.age === null || body.age === "" || body.age === undefined
      ? null
      : Number(body.age);
    if (displayName.length < 2 || displayName.length > 40) {
      return send(response, 400, { error: "Display name must be between 2 and 40 characters." });
    }
    if (email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return send(response, 400, { error: "Enter a valid email address." });
    }
    if (age !== null && (!Number.isInteger(age) || age < 1 || age > 120)) {
      return send(response, 400, { error: "Enter an age from 1 to 120, or leave it blank." });
    }
    const store = await readStore();
    const user = store.users[session.key];
    if (!user) return send(response, 401, { error: "Please sign in again." });
    if (user.authProvider === "email-password" && normalizeEmail(email) !== normalizeEmail(user.email)) {
      return send(response, 400, { error: "Your verified sign-in email cannot be changed from this profile." });
    }
    user.displayName = displayName;
    user.email = user.authProvider === "email-password" ? user.email : email;
    user.age = age;
    await writeStore(store);
    void syncLearnerToSheet(user);
    return send(response, 200, { profile: publicUser(user) });
  }

  if (url.pathname === "/api/progress" && request.method === "GET") {
    const store = await readStore();
    return send(response, 200, { progress: store.users[session.key]?.progress || {} });
  }

  if (url.pathname === "/api/progress" && request.method === "PUT") {
    const body = await readBody(request);
    const store = await readStore();
    const user = store.users[session.key];
    if (!user) return send(response, 401, { error: "Please sign in again." });
    user.progress = { ...user.progress, ...body };
    await writeStore(store);
    void syncLearnerToSheet(user);
    return send(response, 200, { progress: user.progress });
  }

  return send(response, 404, { error: "Route not found." });
}

const server = createServer((request, response) => {
  route(request, response).catch((error) => {
    console.error("API request failed:", error.message);
    send(response, 400, { error: error.message || "Request failed." });
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`TamilThadam listening on port ${PORT}`);
  if (process.env.GOOGLE_SHEETS_WEBHOOK_URL && process.env.GOOGLE_SHEETS_SYNC_SECRET) {
    void readStore()
      .then((store) => Promise.all(Object.values(store.users).map(syncLearnerToSheet)))
      .catch((error) => console.error("Could not backfill learners to Google Sheets:", error.message));
  }
});
