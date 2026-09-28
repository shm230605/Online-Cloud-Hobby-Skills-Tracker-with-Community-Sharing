# REST API Reference

Base URL for local development: `http://127.0.0.1:8000`. Interactive OpenAPI docs: `/docs`. Private routes require `Authorization: Bearer <access_token>`. JSON validation errors use `422`; missing/unauthorized resources return `404` to avoid disclosing ownership.

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| GET | `/health` | Liveness check | Public |
| POST | `/api/auth/register` | Create account and return token | Public |
| POST | `/api/auth/login` | Verify credentials and return token | Public |
| POST | `/api/auth/logout` | Acknowledge client token discard (JWT is stateless) | Authenticated |
| GET / PUT | `/api/profile` | Read/update own profile | Authenticated, self |
| POST / GET | `/api/skills` | Create/list own skills | Authenticated, self |
| GET / PUT / DELETE | `/api/skills/{skill_id}` | Read/update/delete owned skill | Authenticated, self |
| POST / GET | `/api/practice` | Create/list own sessions | Authenticated, self |
| GET | `/api/skills/{skill_id}/practice` | List sessions for owned skill | Authenticated, self |
| POST / GET | `/api/goals` | Create/list own goals | Authenticated, self |
| PUT | `/api/goals/{goal_id}` | Update own goal | Authenticated, self |
| POST | `/api/posts` | Create public or private post | Authenticated, self |
| GET | `/api/feed` | Read public feed, with `limit` and `before_id` pagination | Authenticated |
| DELETE | `/api/posts/{post_id}` | Delete own post | Authenticated, owner |
| POST / DELETE | `/api/posts/{post_id}/like` | Idempotently like/unlike a public post | Authenticated |
| POST / GET | `/api/posts/{post_id}/comments` | Create/list comments | Authenticated |
| DELETE | `/api/comments/{comment_id}` | Delete own comment | Authenticated, owner |
| POST | `/api/files/upload` | Upload a private image (multipart form, max 5 MB) | Authenticated |
| GET / DELETE | `/api/files/{file_id}` | Read permitted or delete owned image | Authenticated, owner/private |
| GET | `/api/analytics/dashboard` | Aggregate owned practice and engagement | Authenticated, self |

## Example Registration

Request:

```json
{
  "email": "jordan@example.test",
  "username": "jordanlee",
  "name": "Jordan Lee",
  "password": "replace-with-a-local-demo-password"
}
```

Response (`201 Created`):

```json
{
  "access_token": "<short-lived-jwt>",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "email": "jordan@example.test",
    "username": "jordanlee",
    "name": "Jordan Lee",
    "bio": "",
    "interests": [],
    "created_at": "2026-09-28T12:00:00Z"
  }
}
```

## Example Practice Request

```json
{
  "skill_id": 1,
  "duration_minutes": 30,
  "activity": "Portrait photography",
  "notes": "Practiced natural light composition.",
  "practiced_at": "2026-09-28"
}
```

Successful create returns `201 Created`; invalid duration is `422`, missing skill is `404`, expired/missing token is `401`. Create operations validate relationships against the authenticated user.

## Important Behavior

- A duplicate like returns `{ "liked": true }` without creating another row. Unlike is safe to repeat.
- Goal progress advances when a session for the linked skill is created. Reaching the target marks the goal `COMPLETED`.
- Logout cannot revoke a self-contained JWT in this MVP; the client discards it. Production logout/revocation needs short lifetimes plus a denylist or refresh-token rotation.
- File upload currently validates declared image MIME type and byte-size limit; production must also inspect file signatures, scan content, and use private object storage with signed URLs.
- Error bodies use FastAPI's `detail` field. Do not return SQL exceptions or secret values to clients.
