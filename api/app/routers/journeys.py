import random
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from collections import defaultdict

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.journey import Journey, Marker, Annotation, Attachment, Stamp, Passport, JourneyCompanion
from app.schemas import (
    JourneyCreate,
    JourneyUpdate,
    JourneyOut,
    MarkerCreate,
    MarkerUpdate,
    MarkerReorder,
    MarkerOut,
    AnnotationCreate,
    AnnotationOut,
    AttachmentCreate,
    AttachmentOut,
    UploadOut,
    PassportOut,
    JourneySummary,
    StampOut,
    PassportTravelsOut,
    TravelJourneyOut,
    TravelMarkerOut,
    CompanionOut,
    CompanionAdd,
    PassportSearchHit,
)
from app.utils.deps import get_current_user

router = APIRouter(tags=["journeys"])

TRANSPORT_MODES = frozenset({"train", "car", "motorcycle", "bicycle", "walk", "plane", "ship"})


def _normalize_transport(value: str | None) -> str | None:
    if not value:
        return None
    key = value.strip().lower()
    if key not in TRANSPORT_MODES:
        raise HTTPException(status_code=400, detail="Meio de transporte inválido")
    return key

JOURNEY_COLORS = [
    "#2F6F73",
    "#C45C26",
    "#3D5A80",
    "#8B4513",
    "#6B4C9A",
    "#B8860B",
    "#2E8B57",
    "#A0522D",
]


def _naive_utc(dt: datetime | None) -> datetime:
    """Normaliza para naive UTC — SQLite devolve naive; defaults Python podem ser aware."""
    if dt is None:
        return datetime.min
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def journey_color_for_index(index: int) -> str:
    return JOURNEY_COLORS[index % len(JOURNEY_COLORS)]


def build_journey_color_map(journeys: list[Journey]) -> dict[str, str]:
    """Cores: map_color persistida tem prioridade; senão ordem de criação."""
    ordered = sorted(journeys, key=lambda j: (_naive_utc(j.created_at), j.id))
    out: dict[str, str] = {}
    for i, j in enumerate(ordered):
        out[j.id] = (j.map_color or "").strip() or journey_color_for_index(i)
    return out


def _primary_photo_url(marker: Marker) -> str | None:
    photos = [a for a in (marker.attachments or []) if a.kind == "photo"]
    if not photos:
        return None
    primary = next((a for a in photos if a.is_primary), None)
    return (primary or photos[0]).url


def _marker_out(marker: Marker) -> MarkerOut:
    data = MarkerOut.model_validate(marker)
    data.primary_photo_url = _primary_photo_url(marker)
    data.has_stamp = marker.stamp is not None
    data.is_departure = bool(getattr(marker, "is_departure", False))
    return data


def _companion_out(c: JourneyCompanion) -> CompanionOut | None:
    if not c.user or not c.user.passport:
        return None
    p = c.user.passport
    return CompanionOut(
        user_id=c.user_id,
        username=p.username,
        display_name=p.display_name,
        photo_url=p.photo_url,
    )


def _is_owner(journey: Journey, user: User) -> bool:
    return journey.owner_id == user.id


def _is_companion(journey: Journey, user: User) -> bool:
    return any(c.user_id == user.id for c in (journey.companions or []))


def _can_edit(journey: Journey, user: User) -> bool:
    return _is_owner(journey, user) or _is_companion(journey, user)


def _require_edit(journey: Journey | None, user: User) -> Journey:
    if not journey or not _can_edit(journey, user):
        raise HTTPException(status_code=404, detail="Viagem não encontrada")
    return journey


def _require_owner(journey: Journey | None, user: User) -> Journey:
    if not journey or not _is_owner(journey, user):
        raise HTTPException(status_code=404, detail="Viagem não encontrada")
    return journey


def _slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text[:60] or "viagem"


async def _unique_slug(db: AsyncSession, base: str) -> str:
    slug = _slugify(base)
    for _ in range(20):
        result = await db.execute(select(Journey).where(Journey.slug == slug))
        if not result.scalar_one_or_none():
            return slug
        slug = f"{_slugify(base)}-{uuid.uuid4().hex[:6]}"
    return f"{slug}-{uuid.uuid4().hex[:6]}"


def _marker_load_options():
    return (
        selectinload(Journey.markers).selectinload(Marker.annotations),
        selectinload(Journey.markers).selectinload(Marker.attachments),
        selectinload(Journey.markers).selectinload(Marker.stamp),
        selectinload(Journey.owner).selectinload(User.passport),
        selectinload(Journey.companions).selectinload(JourneyCompanion.user).selectinload(User.passport),
    )


async def _get_journey_full(db: AsyncSession, slug: str) -> Journey | None:
    result = await db.execute(
        select(Journey).where(Journey.slug == slug).options(*_marker_load_options())
    )
    return result.scalar_one_or_none()


def _journey_out(journey: Journey, color_map: dict[str, str] | None = None) -> JourneyOut:
    owner_username = None
    owner_display = None
    if journey.owner and journey.owner.passport:
        owner_username = journey.owner.passport.username
        owner_display = journey.owner.passport.display_name
    data = JourneyOut(
        id=journey.id,
        slug=journey.slug,
        title=journey.title,
        subtitle=journey.subtitle,
        cover_url=journey.cover_url,
        playlist_url=journey.playlist_url,
        started_on=journey.started_on,
        ended_on=journey.ended_on,
        is_public=journey.is_public,
        color=None,
        owner_username=owner_username,
        owner_display_name=owner_display,
        markers=[_marker_out(m) for m in (journey.markers or [])],
        companions=[],
    )
    companions: list[CompanionOut] = []
    for c in journey.companions or []:
        co = _companion_out(c)
        if co:
            companions.append(co)
    data.companions = companions
    if color_map and journey.id in color_map:
        data.color = color_map[journey.id]
    else:
        data.color = (journey.map_color or "").strip() or None
    return data


async def _color_for_journey(db: AsyncSession, journey: Journey) -> str:
    result = await db.execute(select(Journey).where(Journey.owner_id == journey.owner_id))
    cmap = build_journey_color_map(list(result.scalars().all()))
    return cmap.get(journey.id, JOURNEY_COLORS[0])


async def _sync_journey_stamps(db: AsyncSession, journey: Journey) -> None:
    """Atualiza label/data dos carimbos do passaporte conforme o mapa."""
    from datetime import time, timezone

    for marker in journey.markers or []:
        if not marker.stamp:
            continue
        marker.stamp.label = marker.title
        if journey.started_on:
            marker.stamp.stamped_at = datetime.combine(
                journey.started_on, time(12, 0), tzinfo=timezone.utc
            ).replace(tzinfo=None)
    await db.flush()


@router.post("/journeys", response_model=JourneyOut, status_code=status.HTTP_201_CREATED)
async def create_journey(
    data: JourneyCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    slug = await _unique_slug(db, data.title)
    journey = Journey(
        owner_id=user.id,
        slug=slug,
        title=data.title,
        subtitle=data.subtitle,
        playlist_url=data.playlist_url,
        started_on=data.started_on,
        ended_on=data.ended_on,
        map_color=data.color,
    )
    db.add(journey)
    await db.commit()
    journey = await _get_journey_full(db, slug)
    color = await _color_for_journey(db, journey)
    out = _journey_out(journey)
    out.color = color
    return out


@router.get("/journeys/mine", response_model=list[JourneyOut])
async def my_journeys(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Journey).where(Journey.owner_id == user.id).options(*_marker_load_options())
    )
    journeys = list(result.scalars().all())
    cmap = build_journey_color_map(journeys)
    return [_journey_out(j, cmap) for j in journeys]


@router.get("/journeys/{slug}", response_model=JourneyOut)
async def get_journey(slug: str, db: AsyncSession = Depends(get_db)):
    journey = await _get_journey_full(db, slug)
    if not journey or not journey.is_public:
        if not journey:
            raise HTTPException(status_code=404, detail="Viagem não encontrada")
        raise HTTPException(status_code=404, detail="Viagem não encontrada")
    color = await _color_for_journey(db, journey)
    out = _journey_out(journey)
    out.color = color
    return out


@router.get("/journeys/{slug}/edit", response_model=JourneyOut)
async def get_journey_edit(
    slug: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    journey = _require_edit(await _get_journey_full(db, slug), user)
    color = await _color_for_journey(db, journey)
    out = _journey_out(journey)
    out.color = color
    return out


@router.patch("/journeys/{slug}", response_model=JourneyOut)
async def update_journey(
    slug: str,
    data: JourneyUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    journey = _require_edit(await _get_journey_full(db, slug), user)
    payload = data.model_dump(exclude_unset=True)
    if "color" in payload:
        journey.map_color = payload.pop("color")
    for field, value in payload.items():
        setattr(journey, field, value)
    await _sync_journey_stamps(db, journey)
    await db.commit()
    journey = await _get_journey_full(db, slug)
    color = await _color_for_journey(db, journey)
    out = _journey_out(journey)
    out.color = color
    return out


@router.delete("/journeys/{slug}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_journey(
    slug: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Journey).where(Journey.slug == slug))
    journey = result.scalar_one_or_none()
    if not journey or journey.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Viagem não encontrada")
    await db.delete(journey)
    await db.commit()


@router.post("/journeys/{slug}/markers", response_model=MarkerOut, status_code=201)
async def create_marker(
    slug: str,
    data: MarkerCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    journey = _require_edit(await _get_journey_full(db, slug), user)

    city_label = (data.title or data.city or "").strip()
    if not city_label:
        raise HTTPException(status_code=400, detail="Informe a cidade do carimbo")
    city_key = (data.city or city_label).strip().casefold()
    is_departure = bool(data.is_departure)

    # Partida / retorno: entram no caminho. Carimbo só na primeira visita real.
    want_stamp = bool(data.stamp) and not is_departure
    if want_stamp and user.passport:
        for existing in journey.markers:
            existing_key = (existing.city or existing.title or "").strip().casefold()
            if existing_key == city_key and existing.stamp is not None:
                want_stamp = False
                break

    marker = Marker(
        journey_id=journey.id,
        lat=data.lat,
        lng=data.lng,
        title=city_label,
        city=city_key,
        subtitle=data.subtitle,
        note=data.note,
        icon=data.icon,
        color=data.color,
        sort_order=data.sort_order if data.sort_order is not None else len(journey.markers),
        is_departure=is_departure,
        transport=_normalize_transport(data.transport),
    )
    db.add(marker)
    await db.flush()

    if want_stamp and user.passport:
        from datetime import time, timezone

        stamped_at = None
        if journey.started_on:
            stamped_at = datetime.combine(
                journey.started_on, time(12, 0), tzinfo=timezone.utc
            ).replace(tzinfo=None)
        stamp = Stamp(
            passport_id=user.passport.id,
            marker_id=marker.id,
            journey_id=journey.id,
            label=city_label,
            rotation=random.uniform(-12, 12),
            **({"stamped_at": stamped_at} if stamped_at else {}),
        )
        db.add(stamp)

    await db.commit()

    result = await db.execute(
        select(Marker)
        .where(Marker.id == marker.id)
        .options(
            selectinload(Marker.annotations),
            selectinload(Marker.attachments),
            selectinload(Marker.stamp),
        )
    )
    return _marker_out(result.scalar_one())


@router.patch("/journeys/{slug}/markers/{marker_id}", response_model=MarkerOut)
async def update_marker(
    slug: str,
    marker_id: str,
    data: MarkerUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    journey = _require_edit(await _get_journey_full(db, slug), user)
    marker = next((m for m in journey.markers if m.id == marker_id), None)
    if not marker:
        raise HTTPException(status_code=404, detail="Marcador não encontrado")
    for field, value in data.model_dump(exclude_unset=True).items():
        if field == "transport":
            value = _normalize_transport(value)
        setattr(marker, field, value)
    if data.title is not None and marker.stamp:
        marker.stamp.label = data.title
    await db.commit()
    result = await db.execute(
        select(Marker)
        .where(Marker.id == marker_id)
        .options(selectinload(Marker.annotations), selectinload(Marker.attachments), selectinload(Marker.stamp))
    )
    return _marker_out(result.scalar_one())


@router.put("/journeys/{slug}/reorder-markers", response_model=JourneyOut)
async def reorder_markers(
    slug: str,
    data: MarkerReorder,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    journey = _require_edit(await _get_journey_full(db, slug), user)
    by_id = {m.id: m for m in journey.markers}
    if set(data.marker_ids) != set(by_id.keys()):
        raise HTTPException(status_code=400, detail="Lista de lugares inválida")
    for i, mid in enumerate(data.marker_ids):
        by_id[mid].sort_order = i
    await db.commit()
    journey = await _get_journey_full(db, slug)
    color = await _color_for_journey(db, journey)
    out = _journey_out(journey)
    out.color = color
    return out


@router.delete("/journeys/{slug}/markers/{marker_id}", status_code=204)
async def delete_marker(
    slug: str,
    marker_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    journey = await _get_journey_full(db, slug)
    if not journey or journey.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Viagem não encontrada")
    marker = next((m for m in journey.markers if m.id == marker_id), None)
    if not marker:
        raise HTTPException(status_code=404, detail="Marcador não encontrado")
    await db.delete(marker)
    await db.commit()


@router.post("/journeys/{slug}/markers/{marker_id}/annotations", response_model=AnnotationOut, status_code=201)
async def add_annotation(
    slug: str,
    marker_id: str,
    data: AnnotationCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    journey = await _get_journey_full(db, slug)
    if not journey or journey.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Viagem não encontrada")
    marker = next((m for m in journey.markers if m.id == marker_id), None)
    if not marker:
        raise HTTPException(status_code=404, detail="Marcador não encontrado")
    ann = Annotation(
        marker_id=marker.id,
        type=data.type,
        body=data.body,
        author_name=(user.passport.display_name if user.passport else "") or "",
        author_username=(user.passport.username if user.passport else "") or "",
        sort_order=data.sort_order or len(marker.annotations),
    )
    db.add(ann)
    await db.commit()
    await db.refresh(ann)
    return AnnotationOut.model_validate(ann)


@router.delete("/journeys/{slug}/markers/{marker_id}/annotations/{ann_id}", status_code=204)
async def delete_annotation(
    slug: str,
    marker_id: str,
    ann_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    journey = await _get_journey_full(db, slug)
    if not journey or journey.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Viagem não encontrada")
    result = await db.execute(select(Annotation).where(Annotation.id == ann_id, Annotation.marker_id == marker_id))
    ann = result.scalar_one_or_none()
    if not ann:
        raise HTTPException(status_code=404, detail="Anotação não encontrada")
    await db.delete(ann)
    await db.commit()


@router.post("/journeys/{slug}/markers/{marker_id}/attachments", response_model=AttachmentOut, status_code=201)
async def add_attachment(
    slug: str,
    marker_id: str,
    data: AttachmentCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    journey = await _get_journey_full(db, slug)
    if not journey or journey.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Viagem não encontrada")
    marker = next((m for m in journey.markers if m.id == marker_id), None)
    if not marker:
        raise HTTPException(status_code=404, detail="Marcador não encontrado")

    make_primary = data.is_primary or (
        data.kind == "photo"
        and not any(a.kind == "photo" for a in marker.attachments)
    )
    if make_primary and data.kind == "photo":
        for a in marker.attachments:
            if a.kind == "photo":
                a.is_primary = False

    att = Attachment(
        marker_id=marker.id,
        kind=data.kind,
        url=data.url,
        caption=data.caption,
        sort_order=data.sort_order or len(marker.attachments),
        is_primary=make_primary if data.kind == "photo" else False,
    )
    db.add(att)
    await db.commit()
    await db.refresh(att)
    return AttachmentOut.model_validate(att)


@router.post(
    "/journeys/{slug}/markers/{marker_id}/attachments/{att_id}/primary",
    response_model=MarkerOut,
)
async def set_primary_photo(
    slug: str,
    marker_id: str,
    att_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    journey = _require_edit(await _get_journey_full(db, slug), user)
    marker = next((m for m in journey.markers if m.id == marker_id), None)
    if not marker:
        raise HTTPException(status_code=404, detail="Marcador não encontrado")
    target = next((a for a in marker.attachments if a.id == att_id and a.kind == "photo"), None)
    if not target:
        raise HTTPException(status_code=404, detail="Foto não encontrada")
    for a in marker.attachments:
        if a.kind == "photo":
            a.is_primary = a.id == att_id
    await db.commit()
    result = await db.execute(
        select(Marker)
        .where(Marker.id == marker_id)
        .options(selectinload(Marker.annotations), selectinload(Marker.attachments))
    )
    return _marker_out(result.scalar_one())


@router.delete("/journeys/{slug}/markers/{marker_id}/attachments/{att_id}", status_code=204)
async def delete_attachment(
    slug: str,
    marker_id: str,
    att_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    journey = await _get_journey_full(db, slug)
    if not journey or journey.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Viagem não encontrada")
    result = await db.execute(select(Attachment).where(Attachment.id == att_id, Attachment.marker_id == marker_id))
    att = result.scalar_one_or_none()
    if not att:
        raise HTTPException(status_code=404, detail="Anexo não encontrado")
    was_primary = att.is_primary and att.kind == "photo"
    await db.delete(att)
    await db.flush()
    if was_primary:
        journey = await _get_journey_full(db, slug)
        marker = next((m for m in journey.markers if m.id == marker_id), None) if journey else None
        if marker:
            photos = [a for a in marker.attachments if a.kind == "photo"]
            if photos:
                photos[0].is_primary = True
    await db.commit()


@router.post("/upload", response_model=UploadOut)
async def upload_file(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    if not file.content_type or not file.content_type.startswith(("image/", "application/pdf")):
        raise HTTPException(status_code=400, detail="Arquivo deve ser imagem ou PDF")
    content = await file.read()
    if len(content) > settings.max_file_size:
        raise HTTPException(status_code=400, detail="Arquivo maior que 5MB")
    ext = Path(file.filename or "file.jpg").suffix or ".jpg"
    name = f"{uuid.uuid4().hex}{ext}"
    dest = Path(settings.upload_dir) / name
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(content)
    return UploadOut(url=f"/uploads/{name}")


@router.get("/passports/search", response_model=list[PassportSearchHit])
async def search_passports(
    q: str = Query(min_length=1, max_length=80),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    term = q.strip().lower()
    if len(term) < 1:
        return []
    result = await db.execute(
        select(Passport)
        .where(
            or_(
                Passport.username.ilike(f"%{term}%"),
                Passport.display_name.ilike(f"%{term}%"),
            )
        )
        .limit(12)
    )
    hits = []
    for p in result.scalars().all():
        if p.user_id == user.id:
            continue
        hits.append(
            PassportSearchHit(
                username=p.username,
                display_name=p.display_name,
                photo_url=p.photo_url,
            )
        )
    return hits


@router.get("/journeys/{slug}/companions", response_model=list[CompanionOut])
async def list_companions(
    slug: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    journey = _require_edit(await _get_journey_full(db, slug), user)
    out = []
    for c in journey.companions or []:
        co = _companion_out(c)
        if co:
            out.append(co)
    return out


@router.post("/journeys/{slug}/companions", response_model=list[CompanionOut], status_code=201)
async def add_companion(
    slug: str,
    data: CompanionAdd,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    journey = _require_owner(await _get_journey_full(db, slug), user)
    result = await db.execute(
        select(Passport)
        .where(Passport.username == data.username.strip().lower())
        .options(selectinload(Passport.user))
    )
    passport = result.scalar_one_or_none()
    if not passport:
        raise HTTPException(status_code=404, detail="Passaporte não encontrado. A pessoa precisa ter conta.")
    if passport.user_id == journey.owner_id:
        raise HTTPException(status_code=400, detail="Você já é o dono deste mapa")
    if any(c.user_id == passport.user_id for c in (journey.companions or [])):
        raise HTTPException(status_code=400, detail="Essa pessoa já está no mapa")
    db.add(JourneyCompanion(journey_id=journey.id, user_id=passport.user_id))
    await db.commit()
    journey = await _get_journey_full(db, slug)
    out = []
    for c in journey.companions or []:
        co = _companion_out(c)
        if co:
            out.append(co)
    return out


@router.delete("/journeys/{slug}/companions/{username}", status_code=204)
async def remove_companion(
    slug: str,
    username: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    journey = _require_owner(await _get_journey_full(db, slug), user)
    result = await db.execute(select(Passport).where(Passport.username == username.strip().lower()))
    passport = result.scalar_one_or_none()
    if not passport:
        raise HTTPException(status_code=404, detail="Passaporte não encontrado")
    target = next((c for c in (journey.companions or []) if c.user_id == passport.user_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Companheiro não encontrado")
    await db.delete(target)
    await db.commit()


@router.post("/journeys/{slug}/join", response_model=dict)
async def join_journey(
    slug: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Visitante autenticado entra no mapa público — passa a ver no próprio passaporte."""
    journey = await _get_journey_full(db, slug)
    if not journey or not journey.is_public:
        raise HTTPException(status_code=404, detail="Viagem não encontrada")
    if not user.passport:
        raise HTTPException(status_code=400, detail="Crie um passaporte para entrar no mapa")
    if _is_owner(journey, user):
        cmap = build_journey_color_map([journey])
        return {"joined": False, "journey": _journey_out(journey, cmap)}
    if _is_companion(journey, user):
        cmap = build_journey_color_map([journey])
        return {"joined": False, "journey": _journey_out(journey, cmap)}
    db.add(JourneyCompanion(journey_id=journey.id, user_id=user.id))
    await db.commit()
    journey = await _get_journey_full(db, slug)
    assert journey
    cmap = build_journey_color_map([journey])
    return {"joined": True, "journey": _journey_out(journey, cmap)}


@router.get("/passports/{username}", response_model=PassportOut)
async def get_passport(username: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Passport)
        .where(Passport.username == username.lower())
        .options(
            selectinload(Passport.stamps).selectinload(Stamp.marker).selectinload(Marker.attachments),
            selectinload(Passport.user),
        )
    )
    passport = result.scalar_one_or_none()
    if not passport:
        raise HTTPException(status_code=404, detail="Passaporte não encontrado")

    journeys_result = await db.execute(
        select(Journey).where(Journey.owner_id == passport.user_id)
    )
    owned_journeys = list(journeys_result.scalars().all())

    companion_result = await db.execute(
        select(Journey)
        .join(JourneyCompanion, JourneyCompanion.journey_id == Journey.id)
        .where(JourneyCompanion.user_id == passport.user_id)
    )
    companion_journeys = list(companion_result.scalars().all())

    by_id: dict[str, Journey] = {j.id: j for j in owned_journeys}
    for j in companion_journeys:
        by_id.setdefault(j.id, j)
    all_journeys = list(by_id.values())
    public_journeys = [j for j in all_journeys if j.is_public]
    journey_by_id = by_id
    color_map = build_journey_color_map(all_journeys)

    # Agrupa carimbos pela cidade: 1 selo por cidade; cores misturadas se em vários mapas
    by_city: dict[str, list[Stamp]] = defaultdict(list)
    for s in passport.stamps:
        city = ""
        if s.marker:
            city = (s.marker.city or s.marker.title or "").strip().casefold()
        if not city:
            city = (s.label or "").strip().casefold()
        by_city[city or s.id].append(s)

    stamp_outs: list[StampOut] = []
    for stamps in by_city.values():
        stamps_sorted = sorted(stamps, key=lambda s: _naive_utc(s.stamped_at))
        primary = stamps_sorted[0]
        colors: list[str] = []
        titles: list[str] = []
        started_dates = []
        ended_dates = []
        photo = None
        slug = None
        for s in stamps_sorted:
            j = journey_by_id.get(s.journey_id)
            c = color_map.get(s.journey_id)
            if c and c not in colors:
                colors.append(c)
            if j:
                if j.title and j.title not in titles:
                    titles.append(j.title)
                if j.started_on:
                    started_dates.append(j.started_on)
                if j.ended_on:
                    ended_dates.append(j.ended_on)
                if slug is None:
                    slug = j.slug
            if not photo and s.marker:
                photo = _primary_photo_url(s.marker)

        so = StampOut(
            id=primary.id,
            label=(primary.marker.title if primary.marker else None) or primary.label,
            rotation=primary.rotation,
            stamped_at=primary.stamped_at,
            marker_id=primary.marker_id,
            journey_id=primary.journey_id,
            journey_slug=slug,
            journey_title=titles[0] if len(titles) == 1 else (" · ".join(titles) if titles else None),
            journey_started_on=min(started_dates) if started_dates else None,
            journey_ended_on=max(ended_dates) if ended_dates else None,
            primary_photo_url=photo,
            colors=colors,
            journey_titles=titles,
        )
        stamp_outs.append(so)

    stamp_outs.sort(key=lambda s: _naive_utc(s.stamped_at))

    pout = PassportOut.model_validate(passport)
    pout.stamps = stamp_outs
    journey_summaries: list[JourneySummary] = []
    for j in public_journeys:
        js = JourneySummary.model_validate(j)
        js.color = color_map.get(j.id)
        js.is_mine = j.owner_id == passport.user_id
        journey_summaries.append(js)
    pout.journeys = journey_summaries
    return pout


@router.get("/passports/{username}/travels", response_model=PassportTravelsOut)
async def get_passport_travels(username: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Passport).where(Passport.username == username.lower())
    )
    passport = result.scalar_one_or_none()
    if not passport:
        raise HTTPException(status_code=404, detail="Passaporte não encontrado")

    journeys_result = await db.execute(
        select(Journey)
        .where(Journey.owner_id == passport.user_id, Journey.is_public == True)  # noqa: E712
        .options(
            selectinload(Journey.markers).selectinload(Marker.attachments),
        )
        .order_by(Journey.created_at)
    )
    owned = list(journeys_result.scalars().all())

    companion_result = await db.execute(
        select(Journey)
        .join(JourneyCompanion, JourneyCompanion.journey_id == Journey.id)
        .where(
            JourneyCompanion.user_id == passport.user_id,
            Journey.is_public == True,  # noqa: E712
        )
        .options(
            selectinload(Journey.markers).selectinload(Marker.attachments),
        )
        .order_by(Journey.created_at)
    )
    companion = list(companion_result.scalars().all())
    by_id: dict[str, Journey] = {j.id: j for j in owned}
    for j in companion:
        by_id.setdefault(j.id, j)
    journeys = list(by_id.values())

    # Cores alinhadas com o passaporte (próprias + mapas em que participa)
    all_ids = list(by_id.keys())
    color_source = journeys
    if all_ids:
        all_result = await db.execute(select(Journey).where(Journey.id.in_(all_ids)))
        color_source = list(all_result.scalars().all())
    color_map = build_journey_color_map(color_source)

    out_journeys: list[TravelJourneyOut] = []
    for j in journeys:
        ordered = sorted(j.markers, key=lambda m: m.sort_order)
        out_journeys.append(
            TravelJourneyOut(
                id=j.id,
                slug=j.slug,
                title=j.title,
                color=color_map.get(j.id, JOURNEY_COLORS[0]),
                started_on=j.started_on,
                ended_on=j.ended_on,
                markers=[
                    TravelMarkerOut(
                        id=m.id,
                        lat=m.lat,
                        lng=m.lng,
                        title=m.title,
                        sort_order=m.sort_order,
                        is_departure=bool(getattr(m, "is_departure", False)),
                        transport=getattr(m, "transport", None),
                        primary_photo_url=_primary_photo_url(m),
                    )
                    for m in ordered
                ],
            )
        )
    return PassportTravelsOut(
        username=passport.username,
        display_name=passport.display_name,
        journeys=out_journeys,
    )
