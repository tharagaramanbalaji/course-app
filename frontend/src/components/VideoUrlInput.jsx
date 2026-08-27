import { useMemo } from "react";

import VideoPlayer from "@/components/VideoPlayer";
import { PROVIDER_LABELS, UNRECOGNISED_MESSAGE, parseVideoUrl } from "@/lib/video";

const PROVIDER_BADGE = {
  YOUTUBE: "bg-red-100 text-red-800",
  VIMEO: "bg-sky-100 text-sky-800",
  LOOM: "bg-violet-100 text-violet-800",
  FILE: "bg-slate-200 text-slate-700",
};

/**
 * A video URL field that shows what it recognised, and plays it.
 *
 * Authors paste share links, shortened links and links with timestamps.
 * Previewing here means a broken or region-locked video is caught while
 * authoring rather than by a learner weeks later. The backend re-parses and
 * stores the canonical form regardless of what is typed.
 */
export default function VideoUrlInput({ value, onChange, label = "Video URL", id }) {
  const parsed = useMemo(() => parseVideoUrl(value), [value]);
  const hasInput = Boolean((value ?? "").trim());
  const inputId = id ?? "video-url";

  return (
    <div className="space-y-2">
      <label className="block" htmlFor={inputId}>
        <span className="text-sm font-medium">{label}</span>
        <input
          id={inputId}
          type="url"
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://www.youtube.com/watch?v=... or https://cdn.example.com/lesson.mp4"
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
        />
      </label>

      <p className="text-xs text-slate-500">
        YouTube, Vimeo, Loom, or a direct link to a video file. Share links and
        timestamps are fine, they get tidied up on save.
      </p>

      {hasInput && !parsed && (
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {UNRECOGNISED_MESSAGE}
        </p>
      )}

      {parsed && (
        <div className="space-y-2 rounded border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${
                PROVIDER_BADGE[parsed.provider]
              }`}
            >
              {PROVIDER_LABELS[parsed.provider]}
            </span>
            <span className="text-xs text-slate-500">Preview</span>
          </div>
          <VideoPlayer video={parsed} title="Preview" />
          {parsed.url !== (value ?? "").trim() && (
            <p className="text-xs text-slate-500">
              Will be saved as <span className="font-mono">{parsed.url}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
