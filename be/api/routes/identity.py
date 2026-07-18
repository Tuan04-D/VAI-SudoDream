"""Authentication and role-aware user CRUD routes."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Cookie, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field

from core import security as auth
import communes
from core import config
from infrastructure import mongo as db
import geo_utils


router = APIRouter(tags=["identity"])


class RegisterRequest(BaseModel):
    phone: str = Field(min_length=9, max_length=20)
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=2, max_length=120)
    commune_id: str
    role: Literal["resident", "official"] = "resident"


class LoginRequest(BaseModel):
    phone: str
    password: str
    role: Literal["resident", "official", "admin"] | None = None


class UserUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=2, max_length=120)
    commune_id: str | None = None


class AdminUserCreateRequest(RegisterRequest):
    commune_id: str | None = None
    role: Literal["resident", "official", "admin"]
    status: Literal["active", "suspended"] = "active"
    permissions: list[str] = Field(default_factory=list)


class AdminUserUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=2, max_length=120)
    commune_id: str | None = None
    role: Literal["resident", "official", "admin"] | None = None
    status: Literal["active", "suspended"] | None = None
    permissions: list[str] | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _set_refresh_cookie(response: Response, token: str, expires_at: datetime) -> None:
    response.set_cookie(
        key=config.REFRESH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=config.COOKIE_SECURE,
        samesite="lax",
        path="/api/auth",
        max_age=config.REFRESH_TOKEN_DAYS * 24 * 60 * 60,
        expires=expires_at,
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=config.REFRESH_COOKIE_NAME,
        path="/api/auth",
        secure=config.COOKIE_SECURE,
        httponly=True,
        samesite="lax",
    )


def _auth_response(user: dict, access_token: str) -> dict:
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": config.ACCESS_TOKEN_MINUTES * 60,
        "user": auth.public_user(user),
    }


async def _create_user_from_request(payload: RegisterRequest | AdminUserCreateRequest) -> dict:
    if payload.role != "admin" and payload.commune_id not in communes.COMMUNES_BY_ID:
        raise HTTPException(status_code=404, detail="Không tìm thấy xã")
    try:
        password_hash = auth.hash_password(payload.password)
        lat: float | None = None
        lon: float | None = None
        if payload.role == "resident":
            assert payload.commune_id is not None
            commune = communes.COMMUNES_BY_ID[payload.commune_id]
            lat, lon = geo_utils.random_point_in_commune(
                payload.commune_id, commune["lat"], commune["lon"]
            )
        return await db.create_user(
            phone=payload.phone,
            password_hash=password_hash,
            display_name=payload.display_name,
            role=payload.role,
            commune_id=None if payload.role == "admin" else payload.commune_id,
            lat=lat,
            lon=lon,
            permissions=getattr(payload, "permissions", []),
            status=getattr(payload, "status", "active"),
        )
    except ValueError as exc:
        message = str(exc)
        raise HTTPException(status_code=409 if "đăng ký" in message else 422, detail=message) from exc


@router.post("/api/auth/register", status_code=201)
async def register(payload: RegisterRequest, request: Request, response: Response):
    if payload.role == "official" and not config.ALLOW_OFFICIAL_SELF_REGISTRATION:
        raise HTTPException(status_code=403, detail="Tài khoản cán bộ phải do quản trị viên cấp")
    user = await _create_user_from_request(payload)
    raw_user = await db.get_user_raw(user["id"])
    access_token, refresh_token, expires_at = await auth.issue_session(raw_user, request)
    _set_refresh_cookie(response, refresh_token, expires_at)
    await db.write_audit(
        actor_id=user["id"],
        actor_role=user["role"],
        action="register",
        entity_type="user",
        entity_id=user["id"],
        ip=_client_ip(request),
    )
    return _auth_response(raw_user, access_token)


@router.post("/api/auth/login")
async def login(payload: LoginRequest, request: Request, response: Response):
    user = await auth.authenticate(payload.phone, payload.password)
    if not user or (payload.role and user.get("role") != payload.role):
        raise HTTPException(status_code=401, detail="Sai số điện thoại hoặc mật khẩu")
    access_token, refresh_token, expires_at = await auth.issue_session(user, request)
    _set_refresh_cookie(response, refresh_token, expires_at)
    await db.write_audit(
        actor_id=user["_id"],
        actor_role=user["role"],
        action="login",
        entity_type="session",
        entity_id=None,
        ip=_client_ip(request),
    )
    return _auth_response(user, access_token)


@router.post("/api/auth/refresh")
async def refresh_session(
    request: Request,
    response: Response,
    refresh_token: Annotated[str | None, Cookie(alias=config.REFRESH_COOKIE_NAME)] = None,
):
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Không có refresh session")
    old_hash = db.hash_token(refresh_token)
    current = await db.get_session_by_hash(old_hash)
    if not current:
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=401, detail="Refresh session không hợp lệ")
    user = await db.get_user_raw(current["user_id"])
    if not user or user.get("status") != "active":
        await db.delete_session(old_hash)
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=401, detail="Tài khoản không còn hoạt động")
    new_refresh = auth.new_refresh_token()
    expires_at = datetime.now(timezone.utc) + timedelta(days=config.REFRESH_TOKEN_DAYS)
    rotated = await db.rotate_session(
        old_hash,
        new_token_hash=db.hash_token(new_refresh),
        expires_at=expires_at,
        user_agent=request.headers.get("user-agent"),
        ip=_client_ip(request),
    )
    if not rotated:
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=401, detail="Refresh session đã được sử dụng")
    _set_refresh_cookie(response, new_refresh, expires_at)
    return _auth_response(user, auth.create_access_token(user))


@router.post("/api/auth/logout", status_code=204)
async def logout(
    response: Response,
    refresh_token: Annotated[str | None, Cookie(alias=config.REFRESH_COOKIE_NAME)] = None,
):
    if refresh_token:
        await db.delete_session(db.hash_token(refresh_token))
    _clear_refresh_cookie(response)
    response.status_code = 204
    return response


@router.get("/api/auth/me")
async def me(user: Annotated[dict, Depends(auth.get_current_user)]):
    return auth.public_user(user)


@router.patch("/api/auth/me")
async def update_me(
    payload: UserUpdateRequest,
    request: Request,
    user: Annotated[dict, Depends(auth.get_current_user)],
):
    changes: dict = {}
    if payload.display_name is not None:
        changes["display_name"] = payload.display_name.strip()
    if payload.commune_id is not None:
        if user["role"] == "admin":
            raise HTTPException(status_code=422, detail="Tài khoản admin không thuộc một xã")
        if user["role"] == "official" and payload.commune_id != user.get("commune_id"):
            raise HTTPException(status_code=403, detail="Xã quản lý của cán bộ chỉ do admin thay đổi")
        commune = communes.COMMUNES_BY_ID.get(payload.commune_id)
        if not commune:
            raise HTTPException(status_code=404, detail="Không tìm thấy xã")
        changes["commune_id"] = payload.commune_id
        if user["role"] == "resident" and user.get("commune_id") != payload.commune_id:
            lat, lon = geo_utils.random_point_in_commune(
                payload.commune_id, commune["lat"], commune["lon"]
            )
            changes["location"] = {"type": "Point", "coordinates": [lon, lat]}
    updated = await db.update_user(user["_id"], changes)
    await db.write_audit(
        actor_id=user["_id"],
        actor_role=user["role"],
        action="update_own_profile",
        entity_type="user",
        entity_id=user["_id"],
        metadata={"fields": sorted(changes)},
        ip=_client_ip(request),
    )
    return auth.public_user(updated)


admin_only = auth.require_roles("admin")


@router.post("/api/admin/users", status_code=201)
async def admin_create_user(
    payload: AdminUserCreateRequest,
    request: Request,
    admin: Annotated[dict, Depends(admin_only)],
):
    user = await _create_user_from_request(payload)
    await db.write_audit(
        actor_id=admin["_id"],
        actor_role="admin",
        action="create_user",
        entity_type="user",
        entity_id=user["id"],
        metadata={"role": user["role"], "commune_id": user.get("commune_id")},
        ip=_client_ip(request),
    )
    return auth.public_user(user)


@router.get("/api/admin/users")
async def admin_list_users(
    admin: Annotated[dict, Depends(admin_only)],
    role: str | None = None,
    commune_id: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=100, ge=1, le=500),
    skip: int = Query(default=0, ge=0),
):
    del admin
    users = await db.list_users(
        role=role, commune_id=commune_id, status=status_filter, limit=limit, skip=skip
    )
    return [auth.public_user(user) for user in users]


@router.get("/api/admin/users/{user_id}")
async def admin_get_user(user_id: str, admin: Annotated[dict, Depends(admin_only)]):
    del admin
    user = await db.get_user(user_id, include_deleted=True)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    return auth.public_user(user)


@router.patch("/api/admin/users/{user_id}")
async def admin_update_user(
    user_id: str,
    payload: AdminUserUpdateRequest,
    request: Request,
    admin: Annotated[dict, Depends(admin_only)],
):
    existing = await db.get_user(user_id, include_deleted=True)
    if not existing:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    changes = payload.model_dump(exclude_none=True)
    password = changes.pop("password", None)
    role = changes.get("role", existing["role"])
    status_value = changes.get("status", existing["status"])
    if user_id == admin["_id"] and (role != "admin" or status_value != "active"):
        raise HTTPException(
            status_code=409,
            detail="Không thể tự hạ quyền hoặc khóa tài khoản admin đang đăng nhập",
        )
    commune_id = changes.get("commune_id", existing.get("commune_id"))
    if role != "admin" and commune_id not in communes.COMMUNES_BY_ID:
        raise HTTPException(status_code=422, detail="Người dùng phải thuộc một xã hợp lệ")
    if role == "admin":
        changes["commune_id"] = None
    if password:
        try:
            changes["password_hash"] = auth.hash_password(password)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
    updated = await db.update_user(user_id, changes)
    if not updated:
        raise HTTPException(status_code=409, detail="Tài khoản đã bị xóa")
    await db.write_audit(
        actor_id=admin["_id"],
        actor_role="admin",
        action="update_user",
        entity_type="user",
        entity_id=user_id,
        metadata={"fields": sorted(changes)},
        ip=_client_ip(request),
    )
    return auth.public_user(updated)


@router.delete("/api/admin/users/{user_id}", status_code=204)
async def admin_delete_user(
    user_id: str,
    request: Request,
    admin: Annotated[dict, Depends(admin_only)],
):
    if user_id == admin["_id"]:
        raise HTTPException(status_code=409, detail="Không thể tự xóa tài khoản admin đang đăng nhập")
    if not await db.soft_delete_user(user_id):
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    await db.write_audit(
        actor_id=admin["_id"],
        actor_role="admin",
        action="delete_user",
        entity_type="user",
        entity_id=user_id,
        ip=_client_ip(request),
    )
    return Response(status_code=204)


@router.get("/api/admin/audit-logs")
async def admin_audit_logs(
    admin: Annotated[dict, Depends(admin_only)],
    limit: int = Query(default=100, ge=1, le=500),
):
    del admin
    return await db.list_audit_logs(limit)
