# Loan Application Status Check Portal

A self-hosted portal for a DSA (loan referral) business to let customers
check their loan application status, and for the admin to add/update
applications. No external website link is used — everything runs on your
own server, with data stored locally in `data/db.json`.

## Features

- **Customer page (`/`)** — Customer enters Application ID + registered
  mobile number and sees the current status (Pending / Under Review /
  Approved / Rejected / Disbursed), loan amount, remarks and last updated
  date.
- **Admin page (`/admin.html`)** — Password-protected. Add new
  applications, update status/remarks, and delete records.

## Setup

```bash
npm install
```

## Configuration (set before running in production)

Set these environment variables (defaults are for local testing only —
**change them before deploying**):

| Variable         | Purpose                          | Default         |
|------------------|-----------------------------------|------------------|
| `ADMIN_USER`     | Admin login username              | `admin`          |
| `ADMIN_PASS`     | Admin login password              | `changeme123`    |
| `SESSION_SECRET` | Secret used to sign session cookie| (insecure default) |
| `PORT`           | Port to run on                    | `3000`           |

Example:

```bash
ADMIN_USER=yourname ADMIN_PASS="StrongPass123!" SESSION_SECRET="random-long-string" npm start
```

## Run

```bash
npm start
```

Then open:
- Customer status check: `http://localhost:3000/`
- Admin panel: `http://localhost:3000/admin.html`

## Data storage

Applications are stored in `data/db.json`. Each record:

```json
{
  "applicationId": "DSA1001",
  "customerName": "Rahul Sharma",
  "mobile": "9876543210",
  "loanType": "Business Loan",
  "loanAmount": 500000,
  "status": "Under Review",
  "remarks": "Documents received, verification in progress",
  "lastUpdated": "2026-11-18"
}
```

You can add applications through the admin panel, or edit `data/db.json`
directly before starting the server.

## Notes

- This is a self-contained app meant to be deployed on your own
  infrastructure (a VPS, Render, Railway, etc.) — it does not call or link
  to any third-party or bank website.
- For production use, put this behind HTTPS and change the default admin
  credentials and session secret.
- Application data is stored in a **Supabase** Postgres database (not a
  local file), so it survives server restarts/redeploys on free hosting
  tiers. See "Deploying" below.

## Database setup (Supabase)

1. Create a free project at [supabase.com](https://supabase.com) (or use
   an existing one).
2. In the Supabase SQL editor, run `supabase/migration.sql` from this repo
   to create the `applications` table.
3. In your Supabase project, go to **Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role key** (secret, not the `anon` key) → `SUPABASE_SERVICE_ROLE_KEY`
4. Set these as environment variables wherever you run the app (see
   `.env.example`). The service role key is only ever used by the server —
   it is never sent to the browser.

## Deploying (Render — free tier)

1. Push this repo to GitHub (already done if you're reading this on
   GitHub).
2. Go to [render.com](https://render.com) → **New → Web Service** → connect
   this GitHub repository.
3. Render will detect `render.yaml` and the Node app automatically
   (build command `npm install`, start command `npm start`).
4. Add the environment variables when prompted (or in the service's
   **Environment** tab afterwards):
   - `ADMIN_USER`, `ADMIN_PASS`, `SESSION_SECRET`
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
5. Click **Create Web Service**. Render gives you a public URL like
   `https://loan-status-portal.onrender.com` — share this with customers.

Because data now lives in Supabase, it stays intact even when the free
Render service sleeps and restarts.
