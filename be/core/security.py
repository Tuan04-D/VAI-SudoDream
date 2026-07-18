"""Authentication, refresh sessions and RBAC dependencies."""

from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any, Callable

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import InvalidTokenError
from pwdlib import PasswordHash

from core import config
from infrastructure import mongo as db


ROLE_PERMISSIONS: dict[str, set[str]] = {
    "resident": {"alerts:read", "alerts:view:self", "chat:write", "profile:write:self"},
    "official": {
        "alerts:read",
        "alerts:create:commune",
        "residents:read:commune",
        "deliveries:read:commune",
        "profile:write:self",
    },
    "admin": {"*"},
    "system": {"alerts:create:system", "deliveries:process"},
}
USER_ROLES = {"resident", "official", "admin"}
USER_STATUSES = {"active", "suspended", "deleted"}

_password_hash = PasswordHash.recommended()
_bearer = HTTPBearer(auto_error=False)


def validate_configuration() -> None:
    if len(config.JWT_SECRET_KEY) < 32:
        raise RuntimeError("JWT_SECRET_KEY phải có ít nhất 32 ký tự ngẫu nhiên")
    if not config.MONGO_URI.startswith(("mongodb://", "mongodb+srv://")):
        raise RuntimeError("MONGO_URI không hợp lệ")
    if "*" in config.CORS_ORIGINS:
        raise RuntimeError("CORS_ORIGINS không được dùng '*' khi gửi cookie xác thực")
    if config.APP_ENV == "production" and not config.COOKIE_SECURE:
        raise RuntimeError("COOKIE_SECURE phải bật trong môi trường production")


def validate_password(password: str) -> None:
    if len(password) < 8:
        raise ValueError("Mật khẩu phải có ít nhất 8 ký tự")
    if not any(ch.isalpha() for ch in password) or not any(ch.isdigit() for ch in password):
        raise ValueError("Mật khẩu phải có cả chữ và số")


def hash_password(password: str) -> str:
    validate_password(password)
    return _password_hash.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    try:
        return _password_hash.verify(password, hashed_password)
    except Exception:
        return False


def permissions_for(user: dict) -> list[str]:
    permissions = set(ROLE_PERMISSIONS.get(user.get("role", ""), set()))
    permissions.update(user.get("permissions") or [])
    return sorted(permissions)


def has_permission(user: dict, permission: str) -> bool:
    permissions = set(permissions_for(user))
    return "*" in permissions or permission in permissions


def public_user(user: dict | None) -> dict | None:
    if not user:
        return None
    safe_keys = {
        "id",
        "_id",
        "phone",
        "display_name",
        "role",
        "permissions",
        "status",
        "commune_id",
        "lat",
        "lon",
        "created_at",
        "updated_at",
        "last_login_at",
    }
    result = {("id" if key == "_id" else key): value for key, value in user.items() if key in safe_keys}
    result["permissions"] = permissions_for(user)
    for key, value in list(result.items()):
        if isinstance(value, datetime):
            result[key] = value.astimezone(timezone.utc).isoformat()
    location = user.get("location")
    if isinstance(location, dict) and len(location.get("coordinates", [])) == 2:
        result["lon"], result["lat"] = location["coordinates"]
    return result


def create_access_token(user: dict) -> str:
    now = datetime.now(timezone.utc)
    user_id = str(user.get("id") or user.get("_id"))
    payload = {
        "sub": user_id,
        "type": "access",
        "role": user["role"],
        "permissions": permissions_for(user),
        "ver": int(user.get("token_version", 1)),
        "jti": uuid.uuid4().hex,
        "iat": now,
        "nbf": now,
        "exp": now + timedelta(minutes=config.ACCESS_TOKEN_MINUTES),
        "iss": "tramban-api",
        "aud": "tramban-web",
    }
    return jwt.encode(payload, config.JWT_SECRET_KEY, algorithm=config.JWT_ALGORITHM)


def new_refresh_token() -> str:
    return secrets.token_urlsafe(48)


async def issue_session(user: dict, request: Request) -> tuple[str, str, datetime]:
    refresh_token = new_refresh_token()
    expires_at = datetime.now(timezone.utc) + timedelta(days=config.REFRESH_TOKEN_DAYS)
    await db.create_session(
        user_id=str(user.get("id") or user.get("_id")),
        token_hash=db.hash_token(refresh_token),
        expires_at=expires_at,
        user_agent=request.headers.get("user-agent"),
        ip=request.client.host if request.client else None,
    )
    return create_access_token(user), refresh_token, expires_at


async def authenticate(phone: str, password: str) -> dict | None:
    user = await db.get_user_by_phone(phone)
    if not user or user.get("status") != "active":
        return None
    if not verify_password(password, user.get("password_hash", "")):
        return None
    await db.set_last_login(user["_id"])
    user["last_login_at"] = datetime.now(timezone.utc)
    return user


async def _user_from_token(token: str) -> dict:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Phiên đăng nhập không hợp lệ hoặc đã hết hạn",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token,
            config.JWT_SECRET_KEY,
            algorithms=[config.JWT_ALGORITHM],
            audience="tramban-web",
            issuer="tramban-api",
        )
        if payload.get("type") != "access" or not payload.get("sub"):
            raise credentials_error
    except (InvalidTokenError, ValueError) as exc:
        raise credentials_error from exc
    user = await db.get_user_raw(str(payload["sub"]))
    if not user or user.get("status") != "active":
        raise credentials_error
    if int(user.get("token_version", 1)) != int(payload.get("ver", 0)):
        raise credentials_error
    return user


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> dict:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cần đăng nhập",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return await _user_from_token(credentials.credentials)


async def get_optional_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> dict | None:
    if not credentials or credentials.scheme.lower() != "bearer":
        return None
    try:
        return await _user_from_token(credentials.credentials)
    except HTTPException:
        return None


def require_roles(*roles: str) -> Callable[..., Any]:
    async def dependency(user: Annotated[dict, Depends(get_current_user)]) -> dict:
        if user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Không đủ quyền thực hiện thao tác này")
        return user

    return dependency


def require_permission(permission: str) -> Callable[..., Any]:
    async def dependency(user: Annotated[dict, Depends(get_current_user)]) -> dict:
        if not has_permission(user, permission):
            raise HTTPException(status_code=403, detail="Không đủ quyền thực hiện thao tác này")
        return user

    return dependency


async def ensure_bootstrap_admin() -> None:
    if not config.BOOTSTRAP_ADMIN_PHONE or not config.BOOTSTRAP_ADMIN_PASSWORD:
        return
    existing = await db.get_user_by_phone(config.BOOTSTRAP_ADMIN_PHONE)
    if existing:
        return
    admin = await db.create_user(
        phone=config.BOOTSTRAP_ADMIN_PHONE,
        password_hash=hash_password(config.BOOTSTRAP_ADMIN_PASSWORD),
        display_name=config.BOOTSTRAP_ADMIN_DISPLAY_NAME,
        role="admin",
        commune_id=None,
    )
    await db.write_audit(
        actor_id=None,
        actor_role="system",
        action="bootstrap_admin",
        entity_type="user",
        entity_id=admin["id"],
    )
