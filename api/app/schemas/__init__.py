from datetime import date, datetime
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshToken(BaseModel):
    refresh_token: str


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    username: str = Field(min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")
    display_name: str = Field(min_length=1, max_length=120)
    place_of_issue: str = ""
    signature: str = ""


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class PassportUpdate(BaseModel):
    display_name: str | None = None
    photo_url: str | None = None
    date_of_birth: date | None = None
    place_of_issue: str | None = None
    signature: str | None = None
    bio: str | None = None


class StampOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    label: str
    rotation: float
    stamped_at: datetime
    marker_id: str
    journey_id: str
    journey_slug: str | None = None
    journey_title: str | None = None
    journey_started_on: date | None = None
    journey_ended_on: date | None = None
    primary_photo_url: str | None = None
    colors: list[str] = []
    journey_titles: list[str] = []


class JourneySummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    slug: str
    title: str
    subtitle: str
    cover_url: str | None
    started_on: date | None
    ended_on: date | None
    color: str | None = None
    is_mine: bool = True


class PassportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    display_name: str
    passport_number: str
    photo_url: str | None
    date_of_birth: date | None
    place_of_issue: str
    issued_at: date
    signature: str
    bio: str
    stamps: list[StampOut] = []
    journeys: list[JourneySummary] = []


class MeOut(BaseModel):
    id: str
    email: EmailStr
    passport: PassportOut


class AnnotationCreate(BaseModel):
    type: str = "note"
    body: str
    sort_order: int = 0


class AnnotationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    type: str
    body: str
    author_name: str = ""
    author_username: str = ""
    sort_order: int
    created_at: datetime | None = None


class AttachmentCreate(BaseModel):
    kind: str = "photo"
    url: str
    caption: str = ""
    sort_order: int = 0
    is_primary: bool = False


class AttachmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    kind: str
    url: str
    caption: str
    sort_order: int
    is_primary: bool = False


class MarkerCreate(BaseModel):
    lat: float
    lng: float
    title: str  # nome da cidade (exibido no carimbo)
    city: str = ""  # chave normalizada; se vazio, deriva do title
    subtitle: str = ""
    note: str = ""
    icon: str = "landmark"
    color: str = "stamp"
    sort_order: int = 0
    stamp: bool = True
    # Partida: entra no caminho sem contar como visita (sem carimbo)
    is_departure: bool = False


class MarkerUpdate(BaseModel):
    title: str | None = None
    city: str | None = None
    subtitle: str | None = None
    note: str | None = None
    icon: str | None = None
    color: str | None = None
    lat: float | None = None
    lng: float | None = None
    sort_order: int | None = None
    is_departure: bool | None = None


class MarkerReorder(BaseModel):
    marker_ids: list[str]


class MarkerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    lat: float
    lng: float
    title: str
    city: str = ""
    subtitle: str
    note: str
    icon: str
    color: str
    sort_order: int
    is_departure: bool = False
    has_stamp: bool = False
    primary_photo_url: str | None = None
    annotations: list[AnnotationOut] = []
    attachments: list[AttachmentOut] = []


class JourneyCreate(BaseModel):
    title: str
    subtitle: str = ""
    playlist_url: str | None = None
    started_on: date | None = None
    ended_on: date | None = None
    color: str | None = None


class JourneyUpdate(BaseModel):
    title: str | None = None
    subtitle: str | None = None
    cover_url: str | None = None
    playlist_url: str | None = None
    started_on: date | None = None
    ended_on: date | None = None
    is_public: bool | None = None
    color: str | None = None


class CompanionOut(BaseModel):
    user_id: str
    username: str
    display_name: str
    photo_url: str | None = None


class CompanionAdd(BaseModel):
    username: str = Field(min_length=3, max_length=50)


class PassportSearchHit(BaseModel):
    username: str
    display_name: str
    photo_url: str | None = None


class JourneyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    slug: str
    title: str
    subtitle: str
    cover_url: str | None
    playlist_url: str | None
    started_on: date | None
    ended_on: date | None
    is_public: bool
    color: str | None = None
    owner_username: str | None = None
    owner_display_name: str | None = None
    markers: list[MarkerOut] = []
    companions: list[CompanionOut] = []


class UploadOut(BaseModel):
    url: str


class TravelMarkerOut(BaseModel):
    id: str
    lat: float
    lng: float
    title: str
    sort_order: int
    is_departure: bool = False
    primary_photo_url: str | None = None


class TravelJourneyOut(BaseModel):
    id: str
    slug: str
    title: str
    color: str
    started_on: date | None = None
    ended_on: date | None = None
    markers: list[TravelMarkerOut] = []


class PassportTravelsOut(BaseModel):
    username: str
    display_name: str
    journeys: list[TravelJourneyOut] = []
