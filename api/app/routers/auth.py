from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.journey import Passport, Journey
from app.schemas import (
    SignupRequest,
    LoginRequest,
    Token,
    RefreshToken,
    MeOut,
    PassportOut,
    PassportUpdate,
    JourneySummary,
)
from app.utils.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
)
from app.utils.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


def _passport_number() -> str:
    import random
    import string

    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=8))
    return f"NO. MR{suffix}"


@router.post("/signup", response_model=Token, status_code=status.HTTP_201_CREATED)
async def signup(data: SignupRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == data.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email já cadastrado")

    username = data.username.lower()
    existing_u = await db.execute(select(Passport).where(Passport.username == username))
    if existing_u.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username já está em uso")

    user = User(email=data.email.lower(), hashed_password=get_password_hash(data.password))
    db.add(user)
    await db.flush()

    passport = Passport(
        user_id=user.id,
        username=username,
        display_name=data.display_name,
        passport_number=_passport_number(),
        place_of_issue=data.place_of_issue or "",
        signature=data.signature or data.display_name,
        issued_at=date.today(),
    )
    db.add(passport)
    await db.commit()

    return Token(
        access_token=create_access_token({"sub": user.id}),
        refresh_token=create_refresh_token({"sub": user.id}),
    )


@router.post("/login", response_model=Token)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email.lower()))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Email ou senha incorretos")
    return Token(
        access_token=create_access_token({"sub": user.id}),
        refresh_token=create_refresh_token({"sub": user.id}),
    )


@router.post("/refresh", response_model=Token)
async def refresh(data: RefreshToken, db: AsyncSession = Depends(get_db)):
    user_id = verify_refresh_token(data.refresh_token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Refresh token inválido")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")
    return Token(
        access_token=create_access_token({"sub": user.id}),
        refresh_token=create_refresh_token({"sub": user.id}),
    )


async def _build_passport_out(db: AsyncSession, passport: Passport, user_id: str) -> PassportOut:
    journeys_result = await db.execute(select(Journey).where(Journey.owner_id == user_id))
    journeys = journeys_result.scalars().all()
    pout = PassportOut.model_validate(passport)
    pout.journeys = [JourneySummary.model_validate(j) for j in journeys]
    return pout


@router.get("/me", response_model=MeOut)
async def me(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Passport)
        .where(Passport.user_id == user.id)
        .options(selectinload(Passport.stamps))
    )
    passport = result.scalar_one()
    pout = await _build_passport_out(db, passport, user.id)
    return MeOut(id=user.id, email=user.email, passport=pout)


@router.patch("/me/passport", response_model=PassportOut)
async def update_passport(
    data: PassportUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Passport)
        .where(Passport.user_id == user.id)
        .options(selectinload(Passport.stamps))
    )
    passport = result.scalar_one()
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(passport, field, value)
    await db.commit()
    await db.refresh(passport)
    return await _build_passport_out(db, passport, user.id)
