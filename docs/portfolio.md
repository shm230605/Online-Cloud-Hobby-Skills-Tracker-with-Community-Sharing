# GitHub and Portfolio Proof

## Repository Setup

Suggested repository: `Cloud-Hobby-Skills-Tracker`

Description: `A local-first hobby and skills tracker with a React dashboard, FastAPI REST API, JWT authentication, local object storage, goals, community features, and progress analytics.`

Suggested topics: `cloud-computing`, `skill-tracker`, `fastapi`, `react`, `rest-api`, `authentication`, `cloud-storage`, `analytics`, `sqlite`, `full-stack`.

Suggested commit sequence:

1. `Scaffold hobby and skills tracker`
2. `Build responsive practice dashboard`
3. `Add skill, practice, goal, and community workflows`
4. `Implement authenticated FastAPI resources`
5. `Add private file handling and analytics`
6. `Cover ownership and social interactions with tests`
7. `Document cloud architecture and local setup`
8. `Add CI checks and project screenshots`

## Resume Bullets

- Built a responsive React dashboard for hobby practice, skill progress, goals, streaks, analytics, and community updates with browser-local persistence.
- Implemented a FastAPI REST service with Argon2 password hashing, expiring JWTs, owner-scoped SQLAlchemy resources, SQLite persistence, and private image uploads.
- Added automated tests for data isolation, goal progression, idempotent likes, comment ownership, upload validation, and streak calculations; documented a managed-cloud deployment path.

## Short Description

Little Practice helps learners make personal projects visible: log sessions, set small goals, see progress, and share wins. The repository pairs a local-first React demo with a separately runnable authenticated FastAPI service to demonstrate cloud application patterns without paid infrastructure.

## LinkedIn Description

Designed and built Little Practice, a hobby and skills tracker focused on consistent learning. The React dashboard supports skill creation, practice logging, goal progress, streaks, community posts, likes, comments, and image attachments in a browser-local demo. A separate FastAPI service demonstrates JWT authentication, Argon2 password storage, user-scoped REST endpoints, SQLite data modeling, private file access, and analytics. I added integration tests for authorization and core social flows, plus documentation mapping the local architecture to Firebase and AWS services. The frontend is not yet synchronized with the API, and no public cloud deployment is claimed.

## Interview Preparation: 10 Questions and Answers

### 1. Explain your project.

Little Practice is a hobby and skills tracker. Users can create practices, log sessions, set goals, see progress and streaks, and share learning updates. I built a local-first React dashboard for the interactive demo and a separate FastAPI service that demonstrates authentication, user-scoped REST resources, relational persistence, private uploads, and analytics. I documented the cloud deployment mapping, but the current dashboard and API are not yet synchronized and the project is not represented as a live cloud deployment.

### 2. Which cloud-computing concepts does it demonstrate?

The project models a client/server SaaS workflow, REST APIs, authentication and authorization, managed-database and object-storage boundaries, environment-based secrets, scalability, and observability. Locally, SQLite and disk uploads simulate those managed services. The architecture notes identify what would move to services such as Cloud SQL, Firestore, or S3.

### 3. How is user data isolated?

Each private row has an owner ID. API queries include the authenticated user's ID, and cross-user access returns not found rather than exposing whether a record exists. Tests create two synthetic accounts and verify that one cannot read or update the other's skill or private upload.

### 4. Why separate the database and object storage?

The database holds searchable metadata and references; file bytes live separately. That keeps relational queries smaller and allows a production migration to managed object storage, CDN delivery, lifecycle rules, and signed URLs without changing the domain records.

### 5. How does authentication work?

The API hashes passwords with Argon2 and returns a short-lived signed JWT after registration or login. Protected routes validate the bearer token and resolve its user before continuing. Logout is currently client token discard because self-contained JWTs are stateless; production revocation would add refresh-token rotation or a denylist.

### 6. How does practice update progress?

A practice record references a skill and date. The API inserts the session and increments active goals for that skill in the same database transaction; reaching a target marks the goal complete. Analytics aggregate durations and distinct practice dates for weekly/monthly totals and streaks.

### 7. How does the community feed avoid duplicate likes?

A like is keyed by post and user, with a database uniqueness constraint on that pair. The endpoint checks for an existing row before inserting, and repeated likes return the same success state. In a higher-concurrency deployment, the unique constraint remains the final guard.

### 8. What would change at 100,000 users?

I would replace local SQLite and disk with managed PostgreSQL and private object storage, keep API instances stateless behind managed ingress, add caching and queue-backed analytics, paginate every feed query, and use a CDN for public media. Feed fan-out-on-read is simpler initially; fan-out-on-write can speed up high-volume reads but costs more writes and creates consistency challenges.

### 9. What security work remains before public launch?

The API needs rate limiting, migrations, robust refresh/logout semantics, stricter operational secret management, malware scanning, signed object URLs, moderation/reporting, account deletion, audit logs, automated backups, and production HTTPS/deployment checks. Upload MIME plus signature and size checks are a baseline, not a full content-safety pipeline.

### 10. How did you test it and what is the main limitation?

The backend tests cover registration, duplicate registration, login failure, user isolation, goal progression, analytics, likes, comment ownership, image validation, and streak calculations using temporary databases. The React app passes a production build and was checked in a desktop and narrow mobile browser. The main limitation is that the interactive frontend still persists locally instead of using the authenticated API, and no managed cloud services are provisioned.
