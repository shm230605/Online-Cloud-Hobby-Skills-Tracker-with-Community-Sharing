# Little Practice

A local-first hobby and skills tracker with a polished React dashboard and an independently runnable FastAPI REST service. It demonstrates the practice-to-progress loop, social sharing, user-scoped APIs, JWT authentication, relational data, and private file handling without requiring a paid cloud account.

> **Project status:** the dashboard is a synthetic local demo that persists in browser `localStorage`. The FastAPI service is a separate, authenticated REST implementation backed by SQLite and local disk uploads. The dashboard does not yet synchronize its state with that API; Firebase/AWS hosting and managed object storage are documented as deployment paths, not configured live services.

## Features

- Create skills and goals, log sessions, and see streaks, weekly time, and goal progress update.
- Share community updates, attach a small image, like posts, and leave comments.
- Persist the demo dashboard in the current browser without account credentials.
- Register/login against a FastAPI API with hashed passwords and expiring bearer tokens.
- Create owner-scoped skills, goals, practice sessions, posts, comments, likes, and image files.
- Calculate dashboard analytics from practice records and update linked goals transactionally.
- Run automated API tests with a temporary SQLite database and synthetic users.
- Explore REST documentation at `/docs` after starting the API.

## Architecture

```text
Browser (React + Vite)
  ├── local demo state: localStorage
  └── /api proxy in development ──> FastAPI + SQLAlchemy
                                      ├── SQLite (users, skills, practice, goals, posts)
                                      ├── local uploads/ (private image objects)
                                      └── JWT auth + analytics
```

See [docs/architecture.md](docs/architecture.md) for the data model, cloud mappings, threat boundaries, and scaling notes. See [docs/api-reference.md](docs/api-reference.md) for route contracts.

## Requirements

- Node.js 20.19+ or 22.12+ and npm
- Python 3.11+ (tested with Python 3.14)

## Run the Frontend

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). Demo changes are stored in this browser only. Use **Reset site data** in browser developer tools to restore the seeded example content.

## Run the API

In a second terminal from the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn backend.app.main:app --reload
```

Set a unique `SECRET_KEY` in `.env` before using the API beyond local testing. API docs are at `http://127.0.0.1:8000/docs`; health check: `http://127.0.0.1:8000/health`. SQLite and uploaded files stay local in `hobby_tracker.db` and `uploads/`.

Quick synthetic-user check:

```powershell
$body = @{ email = 'jordan@example.test'; username = 'jordan'; name = 'Jordan Lee'; password = 'local-demo-password' } | ConvertTo-Json
$account = Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/auth/register -ContentType 'application/json' -Body $body
$headers = @{ Authorization = "Bearer $($account.access_token)" }
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/skills -Headers $headers -ContentType 'application/json' -Body '{"name":"Photography","category":"Creative"}'
```

## Tests and Build

```powershell
npm run lint
npm run build
python -m pytest -q
```

Run Python commands inside the activated `.venv`. Tests create isolated temporary databases; they do not use production data.

## Security Notes

- Passwords are Argon2-hashed; API tokens expire and are sent in the `Authorization: Bearer` header.
- Every private resource query is scoped to the authenticated owner. Community access is explicitly public-only.
- Uploads allow only JPEG, PNG, WebP, and GIF up to 5 MB; private files require an authenticated owner to read.
- Secrets, local databases, uploaded media, and virtual environments are excluded from Git.
- SQLite/local disk is for a course demo, not a horizontally scaled production deployment. Use managed identity, a managed database, and private object storage with signed URLs before public launch.

## Cloud Deployment Direction

For a student deployment, host the built frontend on Firebase Hosting, the API on a free-tier container platform, and replace SQLite/local disk with managed PostgreSQL plus private object storage. A Firebase-native variant can use Firebase Auth, Firestore, Storage, Hosting, and Cloud Functions. Do not deploy the local fallback signing key or expose private uploads. Detailed tradeoffs are in [docs/architecture.md](docs/architecture.md).

## Repository Layout

```text
src/                 React dashboard and styles
backend/app/         FastAPI routes, SQLAlchemy models, schemas, and security
backend/tests/       API integration tests
docs/                Architecture and API contracts
reports/             Course project report
screenshots/         Captured app proof
requirements.txt     Python dependencies
package.json         Frontend scripts and dependencies
```

## Portfolio Summary

Built a local-first hobby and skills tracker with React, FastAPI, SQLite, JWT authentication, owner-scoped REST APIs, local object uploads, community interactions, and progress analytics. Designed the architecture to map to managed cloud services while keeping the course demonstration executable without paid infrastructure.

## License

This is a student project starter. Add a license before accepting external contributions or redistributing it.
