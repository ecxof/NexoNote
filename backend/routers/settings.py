from fastapi import APIRouter, Body
from db import get_conn, settings_get, settings_set

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("")
def settings_get_endpoint():
    with get_conn() as c:
        return settings_get(c)


@router.put("")
def settings_set_endpoint(partial: dict = Body(default={})):
    with get_conn() as c:
        return settings_set(c, partial)
