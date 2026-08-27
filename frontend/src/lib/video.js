/**
 * Recognise a pasted video link in the browser.
 *
 * The backend is the authority: it normalises and stores the canonical URL,
 * and returns a `video` object on every content read. This mirror exists
 * only so the authoring form can preview a link *before* saving it, rather
 * than making the author submit to find out whether it works.
 */

const PLAYABLE_EXTENSIONS = [".mp4", ".webm", ".ogg", ".ogv", ".mov", ".m3u8"];

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const DIGITS = /^\d+$/;
const LOOM_ID = /^[A-Za-z0-9]{16,64}$/;

export const PROVIDER_LABELS = {
  YOUTUBE: "YouTube",
  VIMEO: "Vimeo",
  LOOM: "Loom",
  FILE: "Direct file",
};

function youtubeId(url) {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const path = url.pathname.replace(/^\/|\/$/g, "");

  if (host === "youtu.be") return path.split("/")[0] || null;
  if (["youtube.com", "m.youtube.com", "music.youtube.com"].includes(host)) {
    if (path === "watch") return url.searchParams.get("v");
    for (const prefix of ["embed/", "shorts/", "v/", "live/"]) {
      if (path.startsWith(prefix)) return path.slice(prefix.length).split("/")[0] || null;
    }
  }
  return null;
}

function vimeoId(url) {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (!["vimeo.com", "player.vimeo.com"].includes(host)) return null;
  return url.pathname.split("/").find((part) => DIGITS.test(part)) ?? null;
}

function loomId(url) {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host !== "loom.com") return null;
  const parts = url.pathname.replace(/^\//, "").split("/");
  return parts.length >= 2 && ["share", "embed"].includes(parts[0]) ? parts[1] : null;
}

/**
 * @returns {{provider, videoId, url, embedUrl, thumbnailUrl} | null}
 *   null when the link is not recognised.
 */
export function parseVideoUrl(raw) {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(url.protocol)) return null;

  const yt = youtubeId(url);
  if (yt && YOUTUBE_ID.test(yt)) {
    return {
      provider: "YOUTUBE",
      videoId: yt,
      url: `https://www.youtube.com/watch?v=${yt}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${yt}?rel=0`,
      thumbnailUrl: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`,
    };
  }

  const vimeo = vimeoId(url);
  if (vimeo) {
    return {
      provider: "VIMEO",
      videoId: vimeo,
      url: `https://vimeo.com/${vimeo}`,
      embedUrl: `https://player.vimeo.com/video/${vimeo}`,
      thumbnailUrl: null,
    };
  }

  const loom = loomId(url);
  if (loom && LOOM_ID.test(loom)) {
    return {
      provider: "LOOM",
      videoId: loom,
      url: `https://www.loom.com/share/${loom}`,
      embedUrl: `https://www.loom.com/embed/${loom}`,
      thumbnailUrl: null,
    };
  }

  const path = url.pathname.toLowerCase();
  if (PLAYABLE_EXTENSIONS.some((ext) => path.endsWith(ext))) {
    return {
      provider: "FILE",
      videoId: null,
      url: trimmed,
      embedUrl: trimmed,
      thumbnailUrl: null,
    };
  }

  return null;
}

export const UNRECOGNISED_MESSAGE =
  "Unrecognised link. Paste a YouTube, Vimeo or Loom URL, or a direct link to a video file (.mp4, .webm, .mov, .m3u8).";
