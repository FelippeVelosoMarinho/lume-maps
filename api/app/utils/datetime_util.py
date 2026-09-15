from datetime import datetime, timezone


def utc_now_naive() -> datetime:
    """UTC naive — compatível com Postgres TIMESTAMP WITHOUT TIME ZONE e SQLite."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
