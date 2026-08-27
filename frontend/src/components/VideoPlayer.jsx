import { PROVIDER_LABELS } from "@/lib/video";

/**
 * Plays a video from the `video` object the API returns on content reads.
 *
 * Hosted providers get an iframe; a direct file gets the browser's own
 * player, which is enough for object storage and signed URLs.
 */
export default function VideoPlayer({ video, title = "Video", className = "" }) {
  if (!video) return null;

  const frame = "aspect-video w-full rounded border border-slate-200 bg-black";

  if (video.provider === "FILE") {
    return (
      <video className={`${frame} ${className}`} src={video.embedUrl} controls preload="metadata">
        <track kind="captions" />
        Your browser cannot play this video.
      </video>
    );
  }

  return (
    <iframe
      className={`${frame} ${className}`}
      src={video.embedUrl}
      title={`${title} (${PROVIDER_LABELS[video.provider] ?? "video"})`}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}
