"""Video URL recognition, normalisation and playback details.

Authors paste whatever their browser gave them -- a share link, a shortened
link, a URL with a timestamp. Storing that verbatim means playback is a
coin flip, so a pasted URL is parsed once, on write, and stored in a
canonical form.

The embed and thumbnail URLs are derived on read rather than stored: they
are a function of the provider and the id, and deriving them keeps a
provider change from needing a migration.
"""

import re
from dataclasses import dataclass
from urllib.parse import parse_qs, urlparse

YOUTUBE = "YOUTUBE"
VIMEO = "VIMEO"
LOOM = "LOOM"
FILE = "FILE"

# Extensions a browser can play natively from a direct URL.
PLAYABLE_EXTENSIONS = (".mp4", ".webm", ".ogg", ".ogv", ".mov", ".m3u8")

_YOUTUBE_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
_DIGITS = re.compile(r"^\d+$")
_LOOM_ID = re.compile(r"^[A-Za-z0-9]{16,64}$")


@dataclass(frozen=True)
class VideoSource:
    """What the API tells a client about one video."""

    provider: str
    video_id: str | None
    url: str  # canonical, and what gets stored
    embed_url: str
    thumbnail_url: str | None


class UnsupportedVideoUrl(ValueError):
    """The URL is not a recognised provider or a playable file."""


def _youtube_id(parsed) -> str | None:
    host = parsed.netloc.lower().removeprefix("www.")
    path = parsed.path.strip("/")

    if host in ("youtu.be",):
        return path.split("/")[0] or None
    if host in ("youtube.com", "m.youtube.com", "music.youtube.com"):
        if path == "watch":
            values = parse_qs(parsed.query).get("v")
            return values[0] if values else None
        for prefix in ("embed/", "shorts/", "v/", "live/"):
            if path.startswith(prefix):
                return path[len(prefix) :].split("/")[0] or None
    return None


def _vimeo_id(parsed) -> str | None:
    host = parsed.netloc.lower().removeprefix("www.")
    if host not in ("vimeo.com", "player.vimeo.com"):
        return None
    for part in parsed.path.strip("/").split("/"):
        if _DIGITS.match(part):
            return part
    return None


def _loom_id(parsed) -> str | None:
    host = parsed.netloc.lower().removeprefix("www.")
    if host != "loom.com":
        return None
    parts = parsed.path.strip("/").split("/")
    if len(parts) >= 2 and parts[0] in ("share", "embed"):
        return parts[1].split("?")[0] or None
    return None


def parse_video_url(raw: str) -> VideoSource:
    """Recognise a pasted URL, or raise ``UnsupportedVideoUrl``."""
    url = (raw or "").strip()
    if not url:
        raise UnsupportedVideoUrl("A video URL is required.")

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise UnsupportedVideoUrl("A video URL must start with http:// or https://.")
    if not parsed.netloc:
        raise UnsupportedVideoUrl("That does not look like a web address.")

    youtube = _youtube_id(parsed)
    if youtube:
        if not _YOUTUBE_ID.match(youtube):
            raise UnsupportedVideoUrl("That YouTube link does not contain a valid video id.")
        return VideoSource(
            provider=YOUTUBE,
            video_id=youtube,
            url=f"https://www.youtube.com/watch?v={youtube}",
            embed_url=f"https://www.youtube-nocookie.com/embed/{youtube}?rel=0",
            thumbnail_url=f"https://i.ytimg.com/vi/{youtube}/hqdefault.jpg",
        )

    vimeo = _vimeo_id(parsed)
    if vimeo:
        return VideoSource(
            provider=VIMEO,
            video_id=vimeo,
            url=f"https://vimeo.com/{vimeo}",
            embed_url=f"https://player.vimeo.com/video/{vimeo}",
            thumbnail_url=None,  # Vimeo requires an API call for this.
        )

    loom = _loom_id(parsed)
    if loom:
        if not _LOOM_ID.match(loom):
            raise UnsupportedVideoUrl("That Loom link does not contain a valid video id.")
        return VideoSource(
            provider=LOOM,
            video_id=loom,
            url=f"https://www.loom.com/share/{loom}",
            embed_url=f"https://www.loom.com/embed/{loom}",
            thumbnail_url=None,
        )

    if parsed.path.lower().endswith(PLAYABLE_EXTENSIONS):
        # A direct file, served from object storage or any host. Kept
        # verbatim, since signed URLs carry query parameters that matter.
        return VideoSource(
            provider=FILE,
            video_id=None,
            url=url,
            embed_url=url,
            thumbnail_url=None,
        )

    raise UnsupportedVideoUrl(
        "Unrecognised video link. Use YouTube, Vimeo or Loom, or a direct link "
        "to a video file (.mp4, .webm, .mov, .m3u8)."
    )


def normalize_video_url(raw: str) -> str:
    """The canonical URL to store."""
    return parse_video_url(raw).url


def describe(raw: str | None) -> VideoSource | None:
    """Playback details for a stored URL, or None if it is unusable.

    Never raises: a row stored before validation existed must not break the
    read that surfaces it.
    """
    if not raw:
        return None
    try:
        return parse_video_url(raw)
    except UnsupportedVideoUrl:
        return VideoSource(
            provider=FILE, video_id=None, url=raw, embed_url=raw, thumbnail_url=None
        )
