import uuid
from datetime import datetime, date, timezone
from sqlalchemy import String, DateTime, Date, ForeignKey, Text, Float, Integer, Boolean, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Passport(Base):
    __tablename__ = "passports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    passport_number: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    place_of_issue: Mapped[str] = mapped_column(String(120), default="")
    issued_at: Mapped[date] = mapped_column(Date, default=lambda: date.today())
    signature: Mapped[str] = mapped_column(String(120), default="")
    bio: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user: Mapped["User"] = relationship(back_populates="passport")
    stamps: Mapped[list["Stamp"]] = relationship(back_populates="passport", cascade="all, delete-orphan")


class Journey(Base):
    __tablename__ = "journeys"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    subtitle: Mapped[str] = mapped_column(String(300), default="")
    cover_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    playlist_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    map_color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    started_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    ended_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    owner: Mapped["User"] = relationship(back_populates="journeys")
    markers: Mapped[list["Marker"]] = relationship(
        back_populates="journey", cascade="all, delete-orphan", order_by="Marker.sort_order"
    )
    companions: Mapped[list["JourneyCompanion"]] = relationship(
        back_populates="journey", cascade="all, delete-orphan"
    )


class JourneyCompanion(Base):
    __tablename__ = "journey_companions"
    __table_args__ = (UniqueConstraint("journey_id", "user_id", name="uq_journey_companion"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    journey_id: Mapped[str] = mapped_column(String(36), ForeignKey("journeys.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    journey: Mapped["Journey"] = relationship(back_populates="companions")
    user: Mapped["User"] = relationship()


class Marker(Base):
    __tablename__ = "markers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    journey_id: Mapped[str] = mapped_column(String(36), ForeignKey("journeys.id", ondelete="CASCADE"), nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    title: Mapped[str] = mapped_column(String(150), nullable=False)  # nome da cidade
    city: Mapped[str] = mapped_column(String(120), default="", index=True)  # chave normalizada
    subtitle: Mapped[str] = mapped_column(String(300), default="")
    note: Mapped[str] = mapped_column(Text, default="")
    icon: Mapped[str] = mapped_column(String(40), default="landmark")
    color: Mapped[str] = mapped_column(String(20), default="stamp")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    # Ponto de partida no trajeto — entra no caminho, sem carimbo de visita
    is_departure: Mapped[bool] = mapped_column(Boolean, default=False)
    # Meio usado no trecho anterior → este ponto (train|car|motorcycle|bicycle|walk|plane|ship)
    transport: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    journey: Mapped["Journey"] = relationship(back_populates="markers")
    annotations: Mapped[list["Annotation"]] = relationship(
        back_populates="marker", cascade="all, delete-orphan", order_by="Annotation.sort_order"
    )
    attachments: Mapped[list["Attachment"]] = relationship(
        back_populates="marker", cascade="all, delete-orphan", order_by="Attachment.sort_order"
    )
    stamp: Mapped["Stamp | None"] = relationship(back_populates="marker", uselist=False, cascade="all, delete-orphan")


class Annotation(Base):
    __tablename__ = "annotations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    marker_id: Mapped[str] = mapped_column(String(36), ForeignKey("markers.id", ondelete="CASCADE"), nullable=False)
    type: Mapped[str] = mapped_column(String(20), default="note")  # note|quote|idea|moment
    body: Mapped[str] = mapped_column(Text, nullable=False)
    author_name: Mapped[str] = mapped_column(String(120), default="")
    author_username: Mapped[str] = mapped_column(String(50), default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    marker: Mapped["Marker"] = relationship(back_populates="annotations")


class Attachment(Base):
    __tablename__ = "attachments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    marker_id: Mapped[str] = mapped_column(String(36), ForeignKey("markers.id", ondelete="CASCADE"), nullable=False)
    kind: Mapped[str] = mapped_column(String(20), default="photo")  # photo|link|file
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    caption: Mapped[str] = mapped_column(String(300), default="")
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    marker: Mapped["Marker"] = relationship(back_populates="attachments")


class Stamp(Base):
    __tablename__ = "stamps"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    passport_id: Mapped[str] = mapped_column(String(36), ForeignKey("passports.id", ondelete="CASCADE"), nullable=False)
    marker_id: Mapped[str] = mapped_column(String(36), ForeignKey("markers.id", ondelete="CASCADE"), unique=True)
    journey_id: Mapped[str] = mapped_column(String(36), ForeignKey("journeys.id", ondelete="CASCADE"), nullable=False)
    label: Mapped[str] = mapped_column(String(150), nullable=False)
    rotation: Mapped[float] = mapped_column(Float, default=0)
    stamped_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    passport: Mapped["Passport"] = relationship(back_populates="stamps")
    marker: Mapped["Marker"] = relationship(back_populates="stamp")
