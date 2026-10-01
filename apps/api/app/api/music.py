"""T-42 / T-43 -- music playlist + oEmbed resolution (MVP, in-memory store).

The design targets a SoundCloud embed (D7/D8: music-plays-throughout-the-run). Resolution returns
the MusicResolveResponse contract (provider + embedUrl + playback knobs); a null embedUrl means the
client's MusicPlayer plays silence (graceful, no crash).

MVP, hermetic, no secret (D8): a *public* SoundCloud URL (track / set / playlist / user) is turned
into a player embed on SoundCloud's *public* oEmbed proxy `w.soundcloud.com/player` -- no token, no
OAuth, no network to *our* side. That is what actually renders/PLAYS a pasted public set. A real
token-based oEmbed is a drop-in override behind MUSIC_OEMBED_ENDPOINT (F-08 auto-pull, the future path).
Non-SoundCloud / unknown URLs are echoed through unchanged (back-compatible MVP behaviour).
"""

from __future__ import annotations

import os
from typing import Optional
from urllib.parse import quote

from fastapi import APIRouter, Query

from app.api.store import STORE

router = APIRouter(prefix="/api/music", tags=["music"])

# Default per-account playlist key when the client is not (yet) an account.
_DEFAULT_ACCOUNT = "default"

# Hosts that mark a URL as "a SoundCloud URL we can embed publicly".
_SOUNDCLOUD_HOSTS = ("soundcloud.com", "on.soundcloud.com", "ondemand.soundcloud.com")


def is_soundcloud_url(url: Optional[str]) -> bool:
    """True when `url` points at a public SoundCloud resource (track/set/playlist/user)."""
    if not url:
        return False
    low = url.lower()
    return any(host in low for host in _SOUNDCLOUD_HOSTS)


def build_embed_url(provider: str, src: str, *, endpoint: Optional[str] = None) -> str:
    """Turn a source URL into a player embed URL.

    - SoundCloud public URL -> `https://w.soundcloud.com/player/?url=<enc(src)>` (renders a
      track/set/playlist; no token, D8). This is the embed the client actually plays.
    - A custom oEmbed endpoint (env MUSIC_OEMBED_ENDPOINT) overrides for a real token-based resolve
      (F-08); it wins over the public proxy when set.
    - Anything else is echoed through unchanged (MVP passthrough / back-compat).
    """
    if endpoint:
        return f"{endpoint.rstrip('/')}/{provider}/{quote(src, safe='')}"
    if provider == "soundcloud" and is_soundcloud_url(src):
        target = src.split("?", 1)[0]         # strip ?si= / ?utm_ tracking off the resource
        tail = f"show_artwork=true&visual=true&url={quote(target, safe='')}"
        return "https://w.soundcloud.com/player/?" + tail
    return src   # non-soundcloud / unknown provider -> echo (MVP passthrough)


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
    endpoint = os.environ.get("MUSIC_OEMBED_ENDPOINT")
    embed = build_embed_url(pl_provider, src, endpoint=endpoint) if src else None
    return {
        "provider": pl_provider,
        "source": src,
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
