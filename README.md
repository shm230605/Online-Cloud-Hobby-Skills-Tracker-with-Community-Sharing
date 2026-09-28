# Online-Cloud-Hobby & Skills Tracker with Community Sharing

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

## 🏗️ Project Architecture

```text
Online-Cloud-Hobby-Skills-Tracker/
│
├── 📁 .github/
│   └── workflows/              # GitHub Actions / CI-CD workflows
│
├── 📁 backend/
│   ├── controllers/            # Application business logic
│   ├── routes/                 # API route definitions
│   ├── models/                 # Data models / schemas
│   ├── middleware/             # Authentication & request middleware
│   ├── services/               # Backend services and integrations
│   └── config/                 # Backend configuration
│
├── 📁 cloud/
│   └── firebase/               # Firebase / cloud configuration
│       ├── firestore/          # Firestore database configuration
│       ├── auth/               # Firebase Authentication
│       └── storage/            # Cloud Storage configuration
│
├── 📁 docs/
│   ├── architecture/           # System architecture documentation
│   ├── api/                    # API documentation
│   ├── database/               # Database documentation
│   └── user-guide/             # User guides and project documentation
│
├── 📁 public/
│   ├── images/                 # Public images and assets
│   ├── icons/                  # Application icons
│   └── favicon/                # Website favicon
│
├── 📁 reports/
│   ├── testing/                # Testing reports
│   ├── project-report/         # Project documentation/reports
│   └── performance/            # Performance analysis
│
├── 📁 screenshots/
│   ├── dashboard/              # Dashboard screenshots
│   ├── profile/                # User profile screenshots
│   ├── hobbies/                # Hobby tracking screenshots
│   └── community/              # Community feature screenshots
│
├── 📁 src/
│   ├── components/             # Reusable UI components
│   ├── pages/                  # Application pages
│   ├── layouts/                # Page layouts
│   ├── services/               # API / Firebase services
│   ├── hooks/                  # Custom React hooks
│   ├── context/                # Global application state
│   ├── utils/                  # Utility functions
│   ├── assets/                 # Frontend assets
│   ├── styles/                 # CSS / styling
│   └── App.*                   # Main application component
│
├── 📄 .env.example             # Environment variable template
├── 📄 .gitignore               # Git ignored files
├── 📄 .oxlintrc.json           # Code quality / lint configuration
├── 📄 README.md                # Project documentation
├── 📄 index.html               # Application entry HTML
├── 📄 package.json              # Dependencies and scripts
└── 📄 package-lock.json         # Locked dependency versions
```
## 🔄 System Architecture
```
                         👤 USER
                           │
                           ▼
                 ┌────────────────────┐
                 │   🌐 Web Frontend  │
                 │       src/         │
                 └─────────┬──────────┘
                           │
             ┌─────────────┴─────────────┐
             │                           │
             ▼                           ▼
      ┌──────────────┐           ┌──────────────┐
      │ 🔐 Firebase  │           │ ⚙️ Backend   │
      │ Authentication│           │    APIs      │
      └──────┬───────┘           └──────┬───────┘
             │                           │
             │                  ┌────────┴────────┐
             │                  │                 │
             ▼                  ▼                 ▼
      ┌────────────┐     ┌────────────┐    ┌────────────┐
      │ Firestore  │     │   Hobby &  │    │ Community  │
      │  Database  │     │   Skills   │    │  Sharing   │
      └────────────┘     │   Service  │    │   Service  │
                         └────────────┘    └────────────┘
                                │
                                ▼
                       ☁️ Cloud Services
                       
```

## Security Notes

- Passwords are Argon2-hashed; API tokens expire and are sent in the `Authorization: Bearer` header.
- Every private resource query is scoped to the authenticated owner. Community access is explicitly public-only.
- Uploads allow only JPEG, PNG, WebP, and GIF up to 5 MB; private files require an authenticated owner to read.
- Secrets, local databases, uploaded media, and virtual environments are excluded from Git.
- SQLite/local disk is for a course demo, not a horizontally scaled production deployment. Use managed identity, a managed database, and private object storage with signed URLs before public launch.

## Cloud Deployment Direction

For a student deployment, host the built frontend on Firebase Hosting, the API on a free-tier container platform, and replace SQLite/local disk with managed PostgreSQL plus private object storage. A Firebase-native variant can use Firebase Auth, Firestore, Storage, Hosting, and Cloud Functions. Do not deploy the local fallback signing key or expose private uploads.

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

## 👨‍💻 Author
Shresthaa Maiti
