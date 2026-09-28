from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class UserCreate(BaseModel):
    email: str = Field(min_length=5, max_length=255, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    username: str = Field(min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_]+$")
    name: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str
    password: str


class ProfileUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    username: str = Field(min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_]+$")
    bio: str = Field(default="", max_length=240)
    interests: list[str] = Field(default_factory=list, max_length=12)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    username: str
    name: str
    bio: str
    interests: list[str] = Field(default_factory=list)
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class SkillCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    category: str = Field(default="Other", max_length=40)
    level: Literal["Beginner", "Intermediate", "Advanced"] = "Beginner"
    target: str = Field(default="", max_length=180)


class SkillUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    category: str | None = Field(default=None, max_length=40)
    level: Literal["Beginner", "Intermediate", "Advanced"] | None = None
    target: str | None = Field(default=None, max_length=180)
    status: Literal["ACTIVE", "PAUSED", "COMPLETED"] | None = None


class SkillOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: str
    level: str
    target: str
    status: str
    created_at: datetime


class PracticeCreate(BaseModel):
    skill_id: int
    duration_minutes: int = Field(gt=0, le=1440)
    activity: str = Field(min_length=1, max_length=140)
    notes: str = Field(default="", max_length=2000)
    practiced_at: date = Field(default_factory=date.today)


class PracticeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    skill_id: int
    duration_minutes: int
    activity: str
    notes: str
    practiced_at: date
    created_at: datetime


class GoalCreate(BaseModel):
    skill_id: int
    title: str = Field(min_length=1, max_length=120)
    target_minutes: int = Field(gt=0, le=100000)
    deadline: date | None = None


class GoalUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    target_minutes: int | None = Field(default=None, gt=0, le=100000)
    deadline: date | None = None
    status: Literal["ACTIVE", "PAUSED", "COMPLETED"] | None = None


class GoalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    skill_id: int
    title: str
    target_minutes: int
    current_minutes: int
    deadline: date | None
    status: str


class PostCreate(BaseModel):
    content: str = Field(min_length=1, max_length=1000)
    skill_id: int | None = None
    media_url: str | None = Field(default=None, max_length=500)
    is_public: bool = True


class CommentCreate(BaseModel):
    content: str = Field(min_length=1, max_length=500)


class CommentOut(BaseModel):
    id: int
    post_id: int
    owner_id: int
    username: str
    content: str
    created_at: datetime
