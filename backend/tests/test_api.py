from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.database import Base, get_db
from backend.app.main import app


@pytest.fixture()
def client(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'test.db'}"
    test_engine = create_engine(database_url, connect_args={"check_same_thread": False}, poolclass=StaticPool)
    TestingSessionLocal = sessionmaker(bind=test_engine, autoflush=False, expire_on_commit=False)
    Base.metadata.create_all(bind=test_engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=test_engine)
    test_engine.dispose()


def create_user(client: TestClient, email: str, username: str) -> str:
    response = client.post("/api/auth/register", json={"email": email, "username": username, "name": username.title(), "password": "correct-horse-123"})
    assert response.status_code == 201
    return response.json()["access_token"]


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_register_login_and_duplicate_registration(client: TestClient):
    token = create_user(client, "jordan@example.test", "jordanlee")
    duplicate = client.post("/api/auth/register", json={"email": "jordan@example.test", "username": "another", "name": "Jordan", "password": "correct-horse-123"})
    login = client.post("/api/auth/login", json={"email": "jordan@example.test", "password": "correct-horse-123"})
    invalid_login = client.post("/api/auth/login", json={"email": "jordan@example.test", "password": "wrong-password"})
    assert duplicate.status_code == 409
    assert login.status_code == 200
    assert login.json()["access_token"]
    assert invalid_login.status_code == 401
    assert client.get("/api/profile", headers=auth(token)).json()["username"] == "jordanlee"


def test_skill_ownership_isolation(client: TestClient):
    owner_token = create_user(client, "owner@example.test", "owner")
    other_token = create_user(client, "other@example.test", "other")
    skill = client.post("/api/skills", headers=auth(owner_token), json={"name": "Guitar", "category": "Music"}).json()
    assert client.get(f"/api/skills/{skill['id']}", headers=auth(other_token)).status_code == 404
    assert client.put(f"/api/skills/{skill['id']}", headers=auth(other_token), json={"name": "Stolen"}).status_code == 404
    assert client.get("/api/skills", headers=auth(other_token)).json() == []


def test_practice_updates_goal_and_analytics(client: TestClient):
    token = create_user(client, "practice@example.test", "practice")
    skill = client.post("/api/skills", headers=auth(token), json={"name": "Photography", "category": "Art"}).json()
    goal = client.post("/api/goals", headers=auth(token), json={"skill_id": skill["id"], "title": "Practice ten hours", "target_minutes": 60}).json()
    session = client.post("/api/practice", headers=auth(token), json={"skill_id": skill["id"], "duration_minutes": 60, "activity": "Portrait practice", "practiced_at": date.today().isoformat()})
    updated_goal = client.get("/api/goals", headers=auth(token)).json()[0]
    analytics = client.get("/api/analytics/dashboard", headers=auth(token)).json()
    assert session.status_code == 201
    assert updated_goal["id"] == goal["id"]
    assert updated_goal["current_minutes"] == 60
    assert updated_goal["status"] == "COMPLETED"
    assert analytics["total_practice_minutes"] == 60
    assert analytics["current_streak_days"] == 1


def test_likes_are_idempotent_and_comments_are_owned(client: TestClient):
    owner_token = create_user(client, "poster@example.test", "poster")
    viewer_token = create_user(client, "viewer@example.test", "viewer")
    post = client.post("/api/posts", headers=auth(owner_token), json={"content": "Finished my first sketch."}).json()
    assert client.post(f"/api/posts/{post['id']}/like", headers=auth(viewer_token)).json() == {"liked": True}
    client.post(f"/api/posts/{post['id']}/like", headers=auth(viewer_token))
    assert client.get("/api/feed", headers=auth(viewer_token)).json()[0]["like_count"] == 1
    comment = client.post(f"/api/posts/{post['id']}/comments", headers=auth(viewer_token), json={"content": "Lovely work."}).json()
    assert client.delete(f"/api/comments/{comment['id']}", headers=auth(owner_token)).status_code == 404
    assert client.delete(f"/api/comments/{comment['id']}", headers=auth(viewer_token)).status_code == 204


def test_practice_streak_counts_consecutive_days():
    from backend.app.main import streak_summary

    today = date.today()
    assert streak_summary({today, today - timedelta(days=1), today - timedelta(days=2)}, today) == (3, 3)


def test_upload_rejects_invalid_image_content(client: TestClient):
    token = create_user(client, "upload@example.test", "upload")
    response = client.post("/api/files/upload", headers=auth(token), files={"file": ("not-a-png.png", b"this is not a PNG", "image/png")})
    assert response.status_code == 415


def test_private_upload_is_only_visible_to_owner(client: TestClient, tmp_path, monkeypatch):
    from backend.app import main

    owner_token = create_user(client, "file-owner@example.test", "fileowner")
    other_token = create_user(client, "file-reader@example.test", "filereader")
    monkeypatch.setattr(main, "UPLOAD_DIR", tmp_path / "uploads")
    content = b"\x89PNG\r\n\x1a\n" + b"synthetic image bytes"
    upload = client.post("/api/files/upload", headers=auth(owner_token), files={"file": ("practice.png", content, "image/png")})
    assert upload.status_code == 201
    file_id = upload.json()["id"]
    assert client.get(f"/api/files/{file_id}", headers=auth(owner_token)).status_code == 200
    assert client.get(f"/api/files/{file_id}", headers=auth(other_token)).status_code == 404
    assert client.delete(f"/api/files/{file_id}", headers=auth(other_token)).status_code == 404


def test_expired_access_token_is_rejected(client: TestClient, monkeypatch):
    from backend.app import security

    monkeypatch.setattr(security, "ACCESS_TOKEN_MINUTES", -1)
    token = create_user(client, "expired@example.test", "expired")
    response = client.get("/api/profile", headers=auth(token))
    assert response.status_code == 401