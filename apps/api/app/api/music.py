"""T-42 / T-43 -- music playlist + oEmbed resolution (MVP, in-memory store).

The design targets a SoundCloud embed (D7/D8: music-plays-throughout-the-run). Resolution returns
the MusicResolveResponse contract (provider + embedUrl + playback knobs); a null embedUrl means the
client's MusicPlayer plays silence (graceful, no crash). The MVP is hermetic: it echoes a public URL
as the oEmbed target (no network) so tests are deterministic; a real oEmbed endpoint is a drop-in
override behind MUSIC_OEMBED_ENDPOINT. No secret is stored -- public oEmbed only.
"""

from __future__ import annotations

import os
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.api.store import STORE

router = APIRouter(prefix="/api/music", tags=["music"])

# Default per-account playlist key when the client is not (yet) an account.
_DEFAULT_ACCOUNT = "default"


def _oembed_url(provider: str, src: str) -> str:
    """Build the oEmbed target. The MVP echoes the public URL; a real endpoint is env-overridable."""
    endpoint = os.environ.get("MUSIC_OEMBED_ENDPOINT")
    if endpoint:
       return f"{endpoint}/{provider}/{src}"
    return src


@router.get("/resolve")
def resolve_music(
    provider: str = Query("soundcloud"),
   url: Optional[str] = Query(None),
   accountId: Optional[str] = Query(None),
) -> dict:
    # Resolve the embed for the account's playlist (or the supplied url). embedUrl null => silence.
    account_id = accountId or _DEFAULT_ACCOUNT
    pl = STORE.get_playlist(account_id)
    pl_provider = pl.get("provider") or provider
    src = url or pl.get("url")
    embed = _oembed_url(pl_provider, src) if src else None
    return {
          "provider": pl_provider,
          "embedUrl": embed,
          "volume": pl.get("volume", 1.0),
          "startOn": pl.get("startOn", "start"),
          "loop": pl.get("loop", False),
          "muted": pl.get("muted", False),
      }


@router.get("")
@router.get("/")
def get_playlist(accountId: Optional[str] = Query(None)) -> dict:
    account_id = accountId or _DEFAULT_ACCOUNT
    return STORE.get_playlist(account_id)


@router.patch("")
@router.patch("/")
def set_playlist(payload: dict) -> dict:
    account_id = payload.get("accountId") or _DEFAULT_ACCOUNT
    pl = STORE.set_playlist(account_id, payload)
    return pl


@router.delete("")
@router.delete("/")
def clear_playlist(accountId: Optional[str] = Query(None)) -> dict:
    account_id = accountId or _DEFAULT_ACCOUNT
    return STORE.clear_playlist(account_id)
