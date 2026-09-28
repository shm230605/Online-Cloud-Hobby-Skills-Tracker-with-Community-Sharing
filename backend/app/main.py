import logging
import os
import secrets
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import date, timedelta
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import models, schemas
from .database import Base, engine, get_db
from .security import create_access_token, decode_access_token, hash_password, verify_password


logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("hobby_tracker")
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./uploads")).resolve()
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}
IMAGE_SIGNATURES = {
    "image/jpeg": lambda content: content.startswith(b"\xff\xd8\xff"),
    "image/png": lambda content: content.startswith(b"\x89PNG\r\n\x1a\n"),
    "image/webp": lambda content: len(content) >= 12 and content.startswith(b"RIFF") and content[8:12] == b"WEBP",
    "image/gif": lambda content: content.startswith((b"GIF87a", b"GIF89a")),
}
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(title="Little Practice API", version="1.0.0", description="Local-first hobby and skill practice API.", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.User:
    user_id = decode_access_token(token)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired access token", headers={"WWW-Authenticate": "Bearer"})
    user = db.get(models.User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account no longer exists", headers={"WWW-Authenticate": "Bearer"})
    return user


def user_out(user: models.User) -> dict:
    return {"id": user.id, "email": user.email, "username": user.username, "name": user.name, "bio": user.bio, "interests": [item for item in user.interests.split("\n") if item], "created_at": user.created_at}


def owned_skill(db: Session, skill_id: int, owner_id: int) -> models.Skill:
    skill = db.scalar(select(models.Skill).where(models.Skill.id == skill_id, models.Skill.owner_id == owner_id))
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")
    return skill


def owned_post(db: Session, post_id: int) -> models.Post:
    post = db.get(models.Post, post_id)
    if post is None or not post.is_public:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


def post_out(db: Session, post: models.Post, viewer_id: int) -> dict:
    owner = db.get(models.User, post.owner_id)
    skill = db.get(models.Skill, post.skill_id) if post.skill_id else None
    like_count = db.scalar(select(func.count(models.PostLike.id)).where(models.PostLike.post_id == post.id)) or 0
    comment_count = db.scalar(select(func.count(models.Comment.id)).where(models.Comment.post_id == post.id)) or 0
    liked = db.scalar(select(models.PostLike.id).where(models.PostLike.post_id == post.id, models.PostLike.owner_id == viewer_id)) is not None
    return {"id": post.id, "owner_id": post.owner_id, "username": owner.username if owner else "member", "name": owner.name if owner else "Community member", "skill_id": post.skill_id, "skill_name": skill.name if skill else None, "content": post.content, "media_url": post.media_url, "created_at": post.created_at, "like_count": like_count, "comment_count": comment_count, "liked_by_me": liked}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/auth/register", response_model=schemas.TokenOut, status_code=status.HTTP_201_CREATED)
def register(payload: schemas.UserCreate, db: Session = Depends(get_db)) -> dict:
    user = models.User(email=payload.email.lower(), username=payload.username.lower(), name=payload.name.strip(), password_hash=hash_password(payload.password))
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Email or username is already registered") from error
    return {"access_token": create_access_token(user.id), "user": user_out(user)}


@app.post("/api/auth/login", response_model=schemas.TokenOut)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)) -> dict:
    user = db.scalar(select(models.User).where(models.User.email == payload.email.lower()))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email or password is incorrect")
    return {"access_token": create_access_token(user.id), "user": user_out(user)}


@app.post("/api/auth/logout")
def logout(_: models.User = Depends(get_current_user)) -> dict[str, bool]:
    return {"ok": True}


@app.get("/api/profile", response_model=schemas.UserOut)
def get_profile(user: models.User = Depends(get_current_user)) -> dict:
    return user_out(user)


@app.put("/api/profile", response_model=schemas.UserOut)
def update_profile(payload: schemas.ProfileUpdate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)) -> dict:
    user.name = payload.name.strip()
    user.username = payload.username.lower()
    user.bio = payload.bio.strip()
    user.interests = "\n".join(item.strip()[:40] for item in payload.interests if item.strip())
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Username is already in use") from error
    return user_out(user)


@app.post("/api/skills", response_model=schemas.SkillOut, status_code=status.HTTP_201_CREATED)
def create_skill(payload: schemas.SkillCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)) -> models.Skill:
    skill = models.Skill(owner_id=user.id, **payload.model_dump())
    db.add(skill)
    db.commit()
    db.refresh(skill)
    return skill


@app.get("/api/skills", response_model=list[schemas.SkillOut])
def list_skills(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)) -> list[models.Skill]:
    return list(db.scalars(select(models.Skill).where(models.Skill.owner_id == user.id).order_by(models.Skill.created_at.desc())))


@app.get("/api/skills/{skill_id}", response_model=schemas.SkillOut)
def get_skill(skill_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)) -> models.Skill:
    return owned_skill(db, skill_id, user.id)


@app.put("/api/skills/{skill_id}", response_model=schemas.SkillOut)
def update_skill(skill_id: int, payload: schemas.SkillUpdate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)) -> models.Skill:
    skill = owned_skill(db, skill_id, user.id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(skill, key, value)
    db.commit()
    db.refresh(skill)
    return skill


@app.delete("/api/skills/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_skill(skill_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)) -> None:
    skill = owned_skill(db, skill_id, user.id)
    db.delete(skill)
    db.commit()


@app.post("/api/practice", response_model=schemas.PracticeOut, status_code=status.HTTP_201_CREATED)
def create_practice(payload: schemas.PracticeCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)) -> models.PracticeSession:
    owned_skill(db, payload.skill_id, user.id)
    session = models.PracticeSession(owner_id=user.id, **payload.model_dump())
    db.add(session)
    goals = db.scalars(select(models.Goal).where(models.Goal.owner_id == user.id, models.Goal.skill_id == payload.skill_id, models.Goal.status == "ACTIVE"))
    for goal in goals:
        goal.current_minutes += payload.duration_minutes
        if goal.current_minutes >= goal.target_minutes:
            goal.status = "COMPLETED"
    db.commit()
    db.refresh(session)
    return session


@app.get("/api/practice", response_model=list[schemas.PracticeOut])
def list_practice(limit: int = Query(default=50, ge=1, le=200), db: Session = Depends(get_db), user: models.User = Depends(get_current_user)) -> list[models.PracticeSession]:
    return list(db.scalars(select(models.PracticeSession).where(models.PracticeSession.owner_id == user.id).order_by(models.PracticeSession.practiced_at.desc(), models.PracticeSession.id.desc()).limit(limit)))


@app.get("/api/skills/{skill_id}/practice", response_model=list[schemas.PracticeOut])
def list_skill_practice(skill_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)) -> list[models.PracticeSession]:
    owned_skill(db, skill_id, user.id)
    return list(db.scalars(select(models.PracticeSession).where(models.PracticeSession.owner_id == user.id, models.PracticeSession.skill_id == skill_id).order_by(models.PracticeSession.practiced_at.desc())))


@app.post("/api/goals", response_model=schemas.GoalOut, status_code=status.HTTP_201_CREATED)
def create_goal(payload: schemas.GoalCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)) -> models.Goal:
    owned_skill(db, payload.skill_id, user.id)
    goal = models.Goal(owner_id=user.id, **payload.model_dump())
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


@app.get("/api/goals", response_model=list[schemas.GoalOut])
def list_goals(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)) -> list[models.Goal]:
    return list(db.scalars(select(models.Goal).where(models.Goal.owner_id == user.id).order_by(models.Goal.created_at.desc())))


@app.put("/api/goals/{goal_id}", response_model=schemas.GoalOut)
def update_goal(goal_id: int, payload: schemas.GoalUpdate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)) -> models.Goal:
    goal = db.scalar(select(models.Goal).where(models.Goal.id == goal_id, models.Goal.owner_id == user.id))
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(goal, key, value)
    if goal.current_minutes >= goal.target_minutes:
        goal.status = "COMPLETED"
    db.commit()
    db.refresh(goal)
    return goal


@app.post("/api/posts", status_code=status.HTTP_201_CREATED)
def create_post(payload: schemas.PostCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)) -> dict:
    if payload.skill_id is not None:
        owned_skill(db, payload.skill_id, user.id)
    post = models.Post(owner_id=user.id, **payload.model_dump())
    db.add(post)
    db.commit()
    db.refresh(post)
    return post_out(db, post, user.id)


@app.get("/api/feed")
def get_feed(limit: int = Query(default=30, ge=1, le=100), before_id: int | None = None, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)) -> list[dict]:
    query = select(models.Post).where(models.Post.is_public.is_(True))
    if before_id is not None:
        query = query.where(models.Post.id < before_id)
    posts = db.scalars(query.order_by(models.Post.created_at.desc(), models.Post.id.desc()).limit(limit))
    return [post_out(db, post, user.id) for post in posts]


@app.delete("/api/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(post_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)) -> None:
    post = db.scalar(select(models.Post).where(models.Post.id == post_id, models.Post.owner_id == user.id))
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    db.delete(post)
    db.commit()


@app.post("/api/posts/{post_id}/like", status_code=status.HTTP_200_OK)
def like_post(post_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)) -> dict[str, bool]:
    post = owned_post(db, post_id)
    existing = db.scalar(select(models.PostLike).where(models.PostLike.post_id == post.id, models.PostLike.owner_id == user.id))
    if existing is None:
        db.add(models.PostLike(post_id=post.id, owner_id=user.id))
        db.commit()
    return {"liked": True}


@app.delete("/api/posts/{post_id}/like", status_code=status.HTTP_200_OK)
def unlike_post(post_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)) -> dict[str, bool]:
    post = owned_post(db, post_id)
    existing = db.scalar(select(models.PostLike).where(models.PostLike.post_id == post.id, models.PostLike.owner_id == user.id))
    if existing is not None:
        db.delete(existing)
        db.commit()
    return {"liked": False}


@app.post("/api/posts/{post_id}/comments", response_model=schemas.CommentOut, status_code=status.HTTP_201_CREATED)
def add_comment(post_id: int, payload: schemas.CommentCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)) -> dict:
    post = owned_post(db, post_id)
    comment = models.Comment(post_id=post.id, owner_id=user.id, content=payload.content.strip())
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return {"id": comment.id, "post_id": comment.post_id, "owner_id": user.id, "username": user.username, "content": comment.content, "created_at": comment.created_at}


@app.get("/api/posts/{post_id}/comments", response_model=list[schemas.CommentOut])
def get_comments(post_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)) -> list[dict]:
    owned_post(db, post_id)
    comments = db.scalars(select(models.Comment).where(models.Comment.post_id == post_id).order_by(models.Comment.created_at.asc()))
    return [{"id": comment.id, "post_id": comment.post_id, "owner_id": comment.owner_id, "username": db.get(models.User, comment.owner_id).username, "content": comment.content, "created_at": comment.created_at} for comment in comments]


@app.delete("/api/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(comment_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)) -> None:
    comment = db.scalar(select(models.Comment).where(models.Comment.id == comment_id, models.Comment.owner_id == user.id))
    if comment is None:
        raise HTTPException(status_code=404, detail="Comment not found")
    db.delete(comment)
    db.commit()


@app.post("/api/files/upload", status_code=status.HTTP_201_CREATED)
async def upload_file(file: UploadFile = File(...), is_public: bool = False, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)) -> dict:
    extension = ALLOWED_IMAGE_TYPES.get(file.content_type or "")
    if extension is None:
        raise HTTPException(status_code=415, detail="Upload a JPEG, PNG, WebP, or GIF image")
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if not content or len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image must be between 1 byte and 5 MB")
    if not IMAGE_SIGNATURES[file.content_type](content):
        raise HTTPException(status_code=415, detail="Image content does not match its declared file type")
    storage_name = f"{secrets.token_hex(16)}{extension}"
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    path = UPLOAD_DIR / storage_name
    path.write_bytes(content)
    asset = models.FileAsset(owner_id=user.id, storage_name=storage_name, original_name=Path(file.filename or "image").name[:255], content_type=file.content_type or "application/octet-stream", size_bytes=len(content), is_public=is_public)
    db.add(asset)
    try:
        db.commit()
        db.refresh(asset)
    except Exception:
        db.rollback()
        path.unlink(missing_ok=True)
        logger.exception("Upload metadata save failed; removed orphaned object")
        raise HTTPException(status_code=500, detail="Could not save uploaded image")
    return {"id": asset.id, "file_url": f"/api/files/{asset.id}", "content_type": asset.content_type, "size_bytes": asset.size_bytes, "is_public": asset.is_public}


@app.get("/api/files/{file_id}")
def get_file(file_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)) -> FileResponse:
    asset = db.get(models.FileAsset, file_id)
    if asset is None or (asset.owner_id != user.id and not asset.is_public):
        raise HTTPException(status_code=404, detail="File not found")
    path = UPLOAD_DIR / asset.storage_name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="File content is unavailable")
    return FileResponse(path, media_type=asset.content_type, filename=asset.original_name, content_disposition_type="inline")


@app.delete("/api/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_file(file_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)) -> None:
    asset = db.scalar(select(models.FileAsset).where(models.FileAsset.id == file_id, models.FileAsset.owner_id == user.id))
    if asset is None:
        raise HTTPException(status_code=404, detail="File not found")
    (UPLOAD_DIR / asset.storage_name).unlink(missing_ok=True)
    db.delete(asset)
    db.commit()


def streak_summary(practice_dates: set[date], current_day: date) -> tuple[int, int]:
    if not practice_dates:
        return 0, 0
    ordered = sorted(practice_dates)
    longest = run = 1
    for previous, current in zip(ordered, ordered[1:]):
        run = run + 1 if current == previous + timedelta(days=1) else 1
        longest = max(longest, run)
    anchor = current_day if current_day in practice_dates else current_day - timedelta(days=1)
    current_streak = 0
    while anchor in practice_dates:
        current_streak += 1
        anchor -= timedelta(days=1)
    return current_streak, longest


@app.get("/api/analytics/dashboard")
def dashboard_analytics(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)) -> dict:
    sessions = list(db.scalars(select(models.PracticeSession).where(models.PracticeSession.owner_id == user.id)))
    now = date.today()
    week_start = now - timedelta(days=now.weekday())
    month_start = now.replace(day=1)
    skill_minutes: dict[int, int] = defaultdict(int)
    dates: set[date] = set()
    total_minutes = weekly_minutes = monthly_minutes = 0
    for session in sessions:
        duration = session.duration_minutes
        total_minutes += duration
        skill_minutes[session.skill_id] += duration
        dates.add(session.practiced_at)
        if session.practiced_at >= week_start:
            weekly_minutes += duration
        if session.practiced_at >= month_start:
            monthly_minutes += duration
    current_streak, longest_streak = streak_summary(dates, now)
    top_skill_id = max(skill_minutes, key=skill_minutes.get) if skill_minutes else None
    top_skill = db.get(models.Skill, top_skill_id) if top_skill_id else None
    goals = list(db.scalars(select(models.Goal).where(models.Goal.owner_id == user.id)))
    public_posts = db.scalar(select(func.count(models.Post.id)).where(models.Post.owner_id == user.id, models.Post.is_public.is_(True))) or 0
    likes_received = db.scalar(select(func.count(models.PostLike.id)).join(models.Post, models.Post.id == models.PostLike.post_id).where(models.Post.owner_id == user.id)) or 0
    comments_received = db.scalar(select(func.count(models.Comment.id)).join(models.Post, models.Post.id == models.Comment.post_id).where(models.Post.owner_id == user.id)) or 0
    return {"total_practice_minutes": total_minutes, "weekly_practice_minutes": weekly_minutes, "monthly_practice_minutes": monthly_minutes, "most_practiced_skill": top_skill.name if top_skill else None, "current_streak_days": current_streak, "longest_streak_days": longest_streak, "goals_completed": sum(goal.status == "COMPLETED" for goal in goals), "active_goals": sum(goal.status == "ACTIVE" for goal in goals), "milestones_achieved": 0, "posts_created": public_posts, "likes_received": likes_received, "comments_received": comments_received, "practice_minutes_by_skill": {db.get(models.Skill, skill_id).name: minutes for skill_id, minutes in skill_minutes.items() if db.get(models.Skill, skill_id) is not None}}