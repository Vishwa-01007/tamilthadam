import { createServer } from "node:http";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { readFile, writeFile, rename, stat, mkdir } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { OAuth2Client } from "google-auth-library";
import pg from "pg";

const scrypt = promisify(scryptCallback);
const PORT = Number(process.env.PORT || process.env.API_PORT || 3001);
const APP_DIR = fileURLToPath(new URL(".", import.meta.url));
const DATA_DIR = process.env.DATA_DIR || APP_DIR;
const STORE_PATH = join(DATA_DIR, "server-data.json");
const DIST_DIR = join(APP_DIR, "dist");
const sessions = new Map();
const googleVerifier = new OAuth2Client();
const pool = process.env.DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL })
  : null;
let databaseReady;

async function initializeDatabase() {
  if (!pool) return;
  databaseReady ||= pool.query(`
    CREATE TABLE IF NOT EXISTS learners (
      auth_key TEXT PRIMARY KEY,
      id TEXT NOT NULL UNIQUE,
      username VARCHAR(40) NOT NULL,
      display_name VARCHAR(40) NOT NULL,
      email VARCHAR(254) NOT NULL DEFAULT '',
      age SMALLINT,
      salt TEXT,
      password_hash TEXT,
      auth_provider TEXT NOT NULL DEFAULT 'password',
      google_subject TEXT UNIQUE,
      progress JSONB NOT NULL DEFAULT '{}'::jsonb,
      activity JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login_at TIMESTAMPTZ,
      last_active_at TIMESTAMPTZ
    )
  `);
  await databaseReady;
}

function recordActivity(user, type, stage = "") {
  const at = new Date().toISOString();
  user.createdAt ||= at;
  user.lastActiveAt = at;
  user.activity ||= [];
  user.activity.unshift({ type, stage, at });
  user.activity = user.activity.slice(0, 100);
}

function isAdminUser(user) {
  const usernames = (process.env.ADMIN_USERNAMES || "").split(",").map((value) => value.trim().toLocaleLowerCase()).filter(Boolean);
  const emails = (process.env.ADMIN_EMAILS || "").split(",").map((value) => value.trim().toLocaleLowerCase()).filter(Boolean);
  return usernames.includes(String(user.username || "").toLocaleLowerCase()) ||
    emails.includes(String(user.email || "").toLocaleLowerCase());
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

async function readStore() {
  if (pool) {
    await initializeDatabase();
    const { rows } = await pool.query("SELECT * FROM learners");
    return {
      users: Object.fromEntries(rows.map((row) => [row.auth_key, {
        id: row.id,
        username: row.username,
        displayName: row.display_name,
        email: row.email,
        age: row.age,
        salt: row.salt,
        passwordHash: row.password_hash,
        authProvider: row.auth_provider,
        googleSubject: row.google_subject,
        progress: row.progress || {},
        activity: row.activity || [],
        createdAt: row.created_at?.toISOString?.() || row.created_at,
        lastLoginAt: row.last_login_at?.toISOString?.() || row.last_login_at,
        lastActiveAt: row.last_active_at?.toISOString?.() || row.last_active_at,
      }])) ,
    };
  }
  try {
    return JSON.parse(await readFile(STORE_PATH, "utf8"));
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
          INSERT INTO learners
            (auth_key, id, username, display_name, email, age, salt, password_hash, auth_provider, google_subject, progress, activity, created_at, last_login_at, last_active_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13,$14,$15)
          ON CONFLICT (auth_key) DO UPDATE SET
            username=EXCLUDED.username, display_name=EXCLUDED.display_name, email=EXCLUDED.email,
            age=EXCLUDED.age, salt=EXCLUDED.salt, password_hash=EXCLUDED.password_hash,
            auth_provider=EXCLUDED.auth_provider, google_subject=EXCLUDED.google_subject,
            progress=EXCLUDED.progress, activity=EXCLUDED.activity,
            last_login_at=EXCLUDED.last_login_at, last_active_at=EXCLUDED.last_active_at
        `, [key, user.id, user.username, user.displayName || user.username, user.email || "", user.age ?? null,
          user.salt || null, user.passwordHash || null, user.authProvider || "password", user.googleSubject || null,
          JSON.stringify(user.progress || {}), JSON.stringify(user.activity || []), user.createdAt || new Date().toISOString(),
          user.lastLoginAt || null, user.lastActiveAt || null]);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return;
  }
  await mkdir(DATA_DIR, { recursive: true });
  const temporary = join(DATA_DIR, "server-data.tmp.json");
  await writeFile(temporary, JSON.stringify(store, null, 2), "utf8");
  await rename(temporary, STORE_PATH);
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

async function createAccount(username, password) {
  const salt = randomBytes(16).toString("hex");
  const passwordHash = (await scrypt(password, salt, 64)).toString("hex");
  return { id: randomBytes(16).toString("hex"), username, displayName: username, salt, passwordHash, progress: {}, activity: [], createdAt: new Date().toISOString() };
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    email: user.email || "",
    age: Number.isInteger(user.age) ? user.age : null,
    isAdmin: isAdminUser(user),
  };
}

async function route(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (request.method === "GET" && url.pathname === "/api/health") {
    return send(response, 200, { status: "ok", service: "TamilThadam API" });
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
          activity: [],
          createdAt: new Date().toISOString(),
        };
        store.users[userKey] = user;
      }
    }

    user.lastLoginAt = new Date().toISOString();
    recordActivity(user, "signed_in");
    await writeStore(store);

    const token = randomBytes(32).toString("hex");
    sessions.set(token, { key: userKey, id: user.id, username: user.username });
    return send(response, 200, { user: publicUser(user) }, {
      "Set-Cookie": sessionCookie(token),
    });
  }

  if (request.method === "POST" && ["/api/auth/register", "/api/auth/login"].includes(url.pathname)) {
    const body = await readBody(request);
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    if (username.length < 2 || username.length > 40 || password.length < 8 || password.length > 200) {
      return send(response, 400, { error: "Use a username of 2–40 characters and a password of at least 8 characters." });
    }

    const store = await readStore();
    const key = username.toLocaleLowerCase();
    let user = store.users[key];

    const registering = url.pathname.endsWith("/register");
    if (registering) {
      if (user) return send(response, 409, { error: "That username is already registered. Please sign in." });
      user = await createAccount(username, password);
      store.users[key] = user;
    } else {
      if (!user) return send(response, 401, { error: "Username or password is incorrect." });
      const candidate = Buffer.from(await scrypt(password, user.salt, 64));
      const savedHash = Buffer.from(user.passwordHash, "hex");
      if (candidate.length !== savedHash.length || !timingSafeEqual(candidate, savedHash)) {
        return send(response, 401, { error: "Username or password is incorrect." });
      }
    }

    user.lastLoginAt = new Date().toISOString();
    recordActivity(user, registering ? "account_created" : "signed_in");
    await writeStore(store);

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
    if (candidate !== DIST_DIR && !candidate.startsWith(`${DIST_DIR}${sep}`)) {
      return send(response, 400, { error: "Invalid path." });
    }
    let filePath = candidate;
    try {
      if (!(await stat(filePath)).isFile()) filePath = join(DIST_DIR, "index.html");
    } catch {
      filePath = join(DIST_DIR, "index.html");
    }
    try {
      const content = await readFile(filePath);
      const types = {
        ".css": "text/css; charset=utf-8",
        ".html": "text/html; charset=utf-8",
        ".ico": "image/x-icon",
        ".js": "text/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".mp3": "audio/mpeg",
        ".png": "image/png",
        ".svg": "image/svg+xml",
        ".webp": "image/webp",
      };
      response.writeHead(200, {
        "Content-Type": types[extname(filePath).toLowerCase()] || "application/octet-stream",
        "Cache-Control": filePath.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable",
      });
      return response.end(request.method === "HEAD" ? undefined : content);
    } catch {
      return send(response, 404, { error: "Page not found. Build the website before starting the server." });
    }
  }

  const session = getSessionUser(request);
  if (!session) return send(response, 401, { error: "Please sign in to continue." });

  if (request.method === "GET" && url.pathname === "/api/auth/me") {
    const store = await readStore();
    const user = store.users[session.key];
    if (!user) return send(response, 401, { error: "Please sign in again." });
    return send(response, 200, { user: publicUser(user) });
  }

  if (request.method === "GET" && url.pathname === "/api/admin/summary") {
    const store = await readStore();
    const admin = store.users[session.key];
    if (!admin || !isAdminUser(admin)) return send(response, 403, { error: "Admin access is not enabled for this account." });
    const learners = Object.values(store.users).map((user) => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName || user.username,
      email: user.email || "",
      age: Number.isInteger(user.age) ? user.age : null,
      authProvider: user.authProvider || "password",
      createdAt: user.createdAt || null,
      lastLoginAt: user.lastLoginAt || null,
      lastActiveAt: user.lastActiveAt || null,
      progress: user.progress || {},
      activity: (user.activity || []).slice(0, 20),
    }));
    return send(response, 200, { learners });
  }

  if (request.method === "POST" && url.pathname === "/api/activity") {
    const body = await readBody(request);
    const stage = String(body.stage || "").slice(0, 40);
    const store = await readStore();
    const user = store.users[session.key];
    if (!user) return send(response, 401, { error: "Please sign in again." });
    recordActivity(user, "stage_opened", stage);
    await writeStore(store);
    return send(response, 200, { ok: true });
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
    user.displayName = displayName;
    user.email = email;
    user.age = age;
    recordActivity(user, "profile_updated");
    await writeStore(store);
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
    const completedStages = Object.entries(user.progress.milestones || {}).filter(([, completed]) => completed).map(([stage]) => stage);
    recordActivity(user, "progress_updated", completedStages.join(", "));
    await writeStore(store);
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
});
