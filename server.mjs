import { createServer } from "node:http";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { readFile, writeFile, rename } from "node:fs/promises";
import { OAuth2Client } from "google-auth-library";

const scrypt = promisify(scryptCallback);
const PORT = Number(process.env.API_PORT || 3001);
const STORE_PATH = new URL("./server-data.json", import.meta.url);
const sessions = new Map();
const googleVerifier = new OAuth2Client();

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
  try {
    return JSON.parse(await readFile(STORE_PATH, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { users: {} };
  }
}

async function writeStore(store) {
  const temporary = new URL("./server-data.tmp.json", import.meta.url);
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
  return `tt_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`;
}

async function createAccount(username, password) {
  const salt = randomBytes(16).toString("hex");
  const passwordHash = (await scrypt(password, salt, 64)).toString("hex");
  return { id: randomBytes(16).toString("hex"), username, displayName: username, salt, passwordHash, progress: {} };
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    email: user.email || "",
    age: Number.isInteger(user.age) ? user.age : null,
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
        };
        store.users[userKey] = user;
      }
      await writeStore(store);
    }

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

    if (url.pathname.endsWith("/register")) {
      if (user) return send(response, 409, { error: "That username is already registered. Please sign in." });
      user = await createAccount(username, password);
      store.users[key] = user;
      await writeStore(store);
    } else {
      if (!user) return send(response, 401, { error: "Username or password is incorrect." });
      const candidate = Buffer.from(await scrypt(password, user.salt, 64));
      const savedHash = Buffer.from(user.passwordHash, "hex");
      if (candidate.length !== savedHash.length || !timingSafeEqual(candidate, savedHash)) {
        return send(response, 401, { error: "Username or password is incorrect." });
      }
    }

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

  const session = getSessionUser(request);
  if (!session) return send(response, 401, { error: "Please sign in to continue." });

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
    user.displayName = displayName;
    user.email = email;
    user.age = age;
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

server.listen(PORT, "127.0.0.1", () => {
  console.log(`TamilThadam API listening on http://127.0.0.1:${PORT}`);
});
