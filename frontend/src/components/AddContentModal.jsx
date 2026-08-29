import { useState } from "react";
import VideoPlayer from "@/components/VideoPlayer";
import VideoUrlInput from "@/components/VideoUrlInput";
import { parseVideoUrl } from "@/lib/video";

export default function AddContentModal({
  isOpen,
  onClose,
  moduleTitle,
  onAdd,
  isPending = false,
}) {
  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState("TEXT"); // "TEXT" | "VIDEO"
  const [contentBody, setContentBody] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [description, setDescription] = useState("");
  const [showPreview, setShowPreview] = useState(true);

  if (!isOpen) return null;

  const parsedVideo = parseVideoUrl(videoUrl);

  function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;

    onAdd({
      title: title.trim(),
      contentType,
      contentBody: contentType === "TEXT" ? contentBody : null,
      videoUrl: contentType === "VIDEO" ? videoUrl : null,
      description: contentType === "VIDEO" ? description || null : null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition-all my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">Add Lesson to Module</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Module: <span className="font-semibold text-slate-700">{moduleTitle}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            ✕
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-4 space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block sm:col-span-2">
              <span className="label-field">Lesson Title *</span>
              <input
                required
                placeholder="e.g. 1. Introduction to Neural Networks"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input-field mt-1.5"
              />
            </label>

            <label className="block sm:col-span-1">
              <span className="label-field">Lesson Type</span>
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
                className="input-field mt-1.5 font-semibold text-slate-800"
              >
                <option value="TEXT">📄 Text Lesson</option>
                <option value="VIDEO">🎥 Video Lesson</option>
              </select>
            </label>
          </div>

          {contentType === "TEXT" ? (
            <label className="block">
              <span className="label-field">Lesson Body (Text / Markdown)</span>
              <textarea
                required
                rows={6}
                placeholder="Write lesson text, reference notes, code snippets, or reading materials..."
                value={contentBody}
                onChange={(e) => setContentBody(e.target.value)}
                className="input-field mt-1.5 font-mono text-sm leading-relaxed"
              />
            </label>
          ) : (
            <div className="space-y-4">
              <VideoUrlInput
                id="add-content-video-url"
                value={videoUrl}
                onChange={setVideoUrl}
              />

              <label className="block">
                <span className="label-field">Video Description / Summary (Optional)</span>
                <textarea
                  rows={2}
                  placeholder="Key summary or instructions for watching this video..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input-field mt-1.5"
                />
              </label>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !title.trim()}
              className="btn-primary"
            >
              {isPending ? "Adding Lesson..." : "+ Add Lesson"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
