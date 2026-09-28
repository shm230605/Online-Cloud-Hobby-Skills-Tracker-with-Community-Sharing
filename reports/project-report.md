# Online Hobby & Skills Tracker with Community Sharing on Cloud

## Abstract

Little Practice is a cloud-computing course project exploring how a hobby tracker can combine structured practice records, personal goals, analytics, object storage, and community sharing. The repository includes a responsive React dashboard that runs as a local synthetic demo and a FastAPI REST service with JWT authentication, SQLAlchemy persistence, owner-scoped resources, local image storage, and automated tests. The local implementation demonstrates cloud application patterns without requiring paid infrastructure; managed cloud deployment remains a documented next step.

## Problem and Objectives

People often stop learning a hobby when progress feels invisible or solitary. This project makes practice tangible through session history, streaks, goal progress, and peer encouragement. Objectives are to demonstrate client/server separation, authentication and authorization, relational modeling, object metadata separation, REST contracts, analytics, testing, and responsible deployment planning.

## Proposed Architecture

The React/Vite UI serves the interactive local demo. Its browser state is persisted in `localStorage`. The independent FastAPI service exposes JSON endpoints and OpenAPI documentation, verifies JWT bearer tokens, and reads/writes SQLite data through SQLAlchemy. Image bytes are stored separately in a local upload directory with metadata rows in SQLite. A production design would swap SQLite and local files for managed database and object-storage providers, keep API instances stateless, and place a CDN/API gateway at the edge.

## Data and Modules

The data model includes users, skills, practice sessions, goals, posts, likes, comments, and uploaded file metadata. User-owned tables include owner IDs, practice sessions reference skills, and likes use a unique `(post_id, owner_id)` constraint. Progress analytics summarize practice minutes, weekly/monthly activity, streaks, goal completion, posts, likes, and comments. Community feed rows are public; private profile fields and uploads are not exposed by public queries.

## Security and Privacy

Passwords are hashed with Argon2. Short-lived JWTs authenticate API requests. API queries scope private resources to the current user, input models constrain data, and uploads restrict size and declared image type. Local secrets, databases, uploads, and virtual environments are gitignored. Before real users or public cloud release, add database migrations, verified file signatures and malware scanning, rate limits, abuse reporting/moderation, account deletion, signed URLs, managed secrets, TLS, encryption-at-rest verification, and monitoring/backup policies.

## Testing and Results

Automated API tests cover registration, duplicate accounts, login failure, ownership isolation, linked goal updates, analytics, idempotent likes, comment ownership, and streak calculations. Frontend production builds and lints are run as release checks. The app is responsive and usable as a local demo; it does not currently synchronize browser state with the REST API.

## Limitations and Future Work

The current dashboard is synthetic and client-local; it has no real login UI or server synchronization. The REST service uses SQLite and local disk, has no migrations, rate limiting, moderation workflow, followers, notification queue, or cloud provider adapters. Next steps are an authenticated frontend API client, managed PostgreSQL/object storage integration, production security controls, CI/CD, and a deployed demo with consented synthetic fixtures.

## Conclusion

The project provides an executable demonstration of core cloud application patterns with a low-cost local workflow. It distinguishes implemented behavior from production target architecture, giving a clear path to extend the project without presenting a local simulation as a live cloud deployment.
