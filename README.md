# TamilThadam

TamilThadam is a beginner-friendly Tamil learning website with lessons, writing practice, reading activities, Thirukkural pages, learner profiles, and saved progress.

## Run locally

Install dependencies:

```sh
npm install
```

In one terminal, start the API:

```sh
npm run backend
```

In another terminal, start the website:

```sh
npm run dev
```

Open the local URL printed by Vite. The app uses the API for accounts and per-user learning progress.

## Email and password accounts

Signing in uses an email address and password. New accounts verify their email with a six-digit code once; returning learners sign in with their email and password without requesting a code. Codes expire after 10 minutes, are stored hashed, and have limited verification attempts.

Email delivery uses Resend. To enable account verification:

1. Verify a sender domain in Resend and create an API key.
2. Copy `.env.example` to `.env` and set `RESEND_API_KEY`, `EMAIL_FROM` (an address on the verified domain), and a long random `OTP_HASH_SECRET`.
3. Restart the API with `npm run backend`.

The live service also needs these three values in its environment settings. Until they are configured, new accounts cannot receive verification codes. The Render `onrender.com` subdomain is not an email-sending domain.

## Optional Google Sheets learner directory

The backend can upsert each learner's username, email, selected path, progress, and account dates to a private Google Sheet. Passwords, password hashes, and ages are never sent to Sheets. Configure this only on the server:

1. Paste `GoogleSheetsSync.gs` into your Apps Script project. The script targets the spreadsheet opened for Aurex 26 and creates a `Learners` tab with headings on first sync.
2. In Apps Script **Project Settings → Script properties**, add `GOOGLE_SHEETS_SYNC_SECRET` with a long random value and `GOOGLE_SHEETS_SPREADSHEET_ID` with the ID from your private spreadsheet URL.
3. Deploy the project as a **Web app**, executing as your account and accessible to anyone. The endpoint is protected by the shared secret; keep the spreadsheet itself private.
4. Set `GOOGLE_SHEETS_WEBHOOK_URL` to the deployed `/exec` URL and set `GOOGLE_SHEETS_SYNC_SECRET` to the same secret in local `.env` and the Render service environment. Restart/redeploy the backend.

The sheet is updated when an account is created, signs in, changes profile information, or saves progress. If the endpoint is unavailable, website account/progress saves continue normally and the backend logs the sync failure. Never place the secret in React/frontend code or commit `.env`.

Do not commit `.env` or `server-data.json`. They contain private configuration and account records and are excluded by `.gitignore`.
