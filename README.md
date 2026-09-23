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

## Google sign-in setup

Create a Google OAuth client for a Web application and copy `.env.example` to `.env`. Put the same Web Client ID in both `VITE_GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_ID`. Add your local website origin (for example `http://127.0.0.1:5173`) to the OAuth client's authorized JavaScript origins, then restart the website and API.

Do not commit `.env` or `server-data.json`. They contain local configuration and account records and are excluded by `.gitignore`.
