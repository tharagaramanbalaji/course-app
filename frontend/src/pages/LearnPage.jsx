import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api, getApiErrorMessage } from "@/api/client";
import ErrorNote from "@/components/ErrorNote";
import LearnerQuizPanel from "@/components/LearnerQuizPanel";
import VideoPlayer from "@/components/VideoPlayer";

const STATUS_BADGE = {
  NOT_STARTED: "badge-slate",
  IN_PROGRESS: "badge-amber",
  COMPLETED: "badge-brand",
};

const STATUS_LABEL = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};

/** No stored duration exists for a lesson, so one is estimated for display
 * only: reading speed for text, a flat estimate for video. Never treated as
 * real data anywhere completion or scoring is decided. */
function estimateMinutes(content) {
  if (content.contentType === "TEXT") {
    const words = (content.contentBody ?? "").trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  }
  return 5;
}

function formatDuration(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

/** Module-by-module learner experience styled as a playlist: pick a lesson
 * from the sidebar, work through it, then the quiz. Locking, completion and
 * scoring all come from the backend - this page only renders what it's told. */
export default function LearnPage() {
  const { courseId } = useParams();
  const queryClient = useQueryClient();
  const [selection, setSelection] = useState(null); // { moduleId, type: "content" | "quiz", contentId? }
  const [autoPlay, setAutoPlay] = useState(true);
  const [playlistSearch, setPlaylistSearch] = useState("");
  const [collapsedModuleIds, setCollapsedModuleIds] = useState(() => new Set());
  const [error, setError] = useState("");

  const courseQuery = useQuery({
    queryKey: ["my-course", courseId],
    queryFn: async () => (await api.get(`/my/courses/${courseId}`)).data.data,
  });

  const modulesQuery = useQuery({
    queryKey: ["learner-modules", courseId],
    queryFn: async () => (await api.get(`/courses/${courseId}/modules`)).data.data,
  });

  const modules = modulesQuery.data ?? [];
  const unlockedModules = modules.filter((m) => m.unlocked);

  // Every unlocked module's contents, fetched together so the playlist can
  // show the whole course at once instead of only the selected module.
  const contentQueries = useQueries({
    queries: unlockedModules.map((module) => ({
      queryKey: ["learner-contents", courseId, module.id],
      queryFn: async () =>
        (await api.get(`/courses/${courseId}/modules/${module.id}/contents`)).data.data,
    })),
  });
  const contentsByModuleId = useMemo(() => {
    const map = {};
    unlockedModules.forEach((module, index) => {
      map[module.id] = contentQueries[index]?.data ?? [];
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlockedModules, contentQueries.map((q) => q.dataUpdatedAt).join(",")]);

  // The lesson worth landing on: the first incomplete item in the first
  // unlocked, not-yet-complete module - or that module's quiz once its
  // content is done, or the very first lesson if the course is finished.
  const defaultSelection = useMemo(() => {
    const target = modules.find((m) => m.unlocked && m.status !== "COMPLETED") ?? modules[0];
    if (!target) return null;
    const contents = contentsByModuleId[target.id] ?? [];
    const nextContent = contents.find((c) => !c.completed);
    if (nextContent) return { moduleId: target.id, type: "content", contentId: nextContent.id };
    if (target.hasQuiz && !target.quizPassed) return { moduleId: target.id, type: "quiz" };
    if (contents.length > 0) {
      return { moduleId: target.id, type: "content", contentId: contents[0].id };
    }
    if (target.hasQuiz) return { moduleId: target.id, type: "quiz" };
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modules.map((m) => `${m.id}:${m.status}`).join(","), contentsByModuleId]);

  const effectiveSelection = selection ?? defaultSelection;
  const selectedModule = modules.find((m) => m.id === effectiveSelection?.moduleId) ?? null;
  const selectedModuleContents = selectedModule ? contentsByModuleId[selectedModule.id] ?? [] : [];
  const selectedContent =
    effectiveSelection?.type === "content"
      ? selectedModuleContents.find((c) => c.id === effectiveSelection.contentId) ?? null
      : null;

  const certificateQuery = useQuery({
    queryKey: ["course-certificate", courseId],
    queryFn: async () => (await api.get(`/my/courses/${courseId}/certificate`)).data.data,
    enabled: courseQuery.data?.enrollment.status === "COMPLETED",
    retry: false,
  });

  function selectLesson(moduleId, type, contentId) {
    setSelection({ moduleId, type, contentId });
  }

  const completeContent = useMutation({
    mutationFn: ({ moduleId, contentId }) =>
      api.post(`/my/courses/${courseId}/modules/${moduleId}/contents/${contentId}/complete`),
    onSuccess: (_response, { moduleId, contentId }) => {
      setError("");
      queryClient.invalidateQueries({ queryKey: ["learner-contents", courseId, moduleId] });
      queryClient.invalidateQueries({ queryKey: ["learner-modules", courseId] });
      queryClient.invalidateQueries({ queryKey: ["my-course", courseId] });

      if (!autoPlay) return;
      const contents = contentsByModuleId[moduleId] ?? [];
      const index = contents.findIndex((c) => c.id === contentId);
      const next = contents[index + 1];
      if (next) {
        selectLesson(moduleId, "content", next.id);
      } else if (selectedModule?.hasQuiz) {
        selectLesson(moduleId, "quiz");
      }
    },
    onError: (mutationError) => setError(getApiErrorMessage(mutationError)),
  });

  async function downloadCertificate() {
    const certificate = certificateQuery.data;
    if (!certificate) return;
    const response = await api.get(`/my/certificates/${certificate.id}/download`, {
      responseType: "blob",
    });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${certificate.certificateNumber}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function shareCourse() {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      // Clipboard access can be denied by the browser; nothing to recover.
    }
  }

  function toggleModule(moduleId) {
    setCollapsedModuleIds((current) => {
      const next = new Set(current);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  }

  if (courseQuery.isPending || modulesQuery.isPending) {
    return <p className="text-slate-500">Loading course...</p>;
  }

  if (courseQuery.isError || !courseQuery.data) {
    return (
      <div className="space-y-4">
        <ErrorNote
          message={getApiErrorMessage(courseQuery.error) || "You are not enrolled in this course."}
        />
        <Link to="/courses" className="text-sm font-semibold text-[#0A6847] hover:underline">
          &larr; Back to Courses
        </Link>
      </div>
    );
  }

  const course = courseQuery.data;

  // A rough total: known minutes for unlocked modules, a flat estimate per
  // item for modules not yet reached (their content isn't fetchable yet).
  const totalMinutes = modules.reduce((sum, module) => {
    const contents = contentsByModuleId[module.id];
    if (contents) return sum + contents.reduce((s, c) => s + estimateMinutes(c), 0);
    return sum + module.contentCount * 5;
  }, 0);

  const search = playlistSearch.trim().toLowerCase();
  const matchesSearch = (title) => !search || title.toLowerCase().includes(search);

  return (
    <div className="space-y-6 pb-12">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl brand-gradient p-8 text-white sm:p-10">
        <Link
          to="/courses"
          className="inline-flex items-center gap-1 text-sm font-medium text-white/80 hover:text-white"
        >
          &uarr; Back to Courses
        </Link>
        <h1 className="mt-4 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">
          {course.title}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/85">
          <span className="inline-flex items-center gap-1.5">
            <UserIcon /> All Users
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ListIcon /> {modules.length} Modules
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ClockIcon /> {formatDuration(totalMinutes)}
          </span>
        </div>
        <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-white/10" />
      </div>

      {/* Title bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-slate-900">{course.title}</h2>
          <span className="badge-brand">Course</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 sm:flex">
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[#0A6847]"
                style={{ width: `${course.progress.percentComplete}%` }}
              />
            </div>
            <span className="text-xs text-slate-500">{course.progress.percentComplete}%</span>
          </div>
          <button
            type="button"
            onClick={shareCourse}
            title="Copy link to this course"
            className="btn-secondary-sm"
          >
            <ShareIcon /> Share
          </button>
        </div>
      </div>

      {course.enrollment.status === "COMPLETED" && (
        <div className="brand-gradient-subtle flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#7ABA78]/40 p-5">
          <div>
            <p className="font-bold text-[#063F2A]">🎉 You have completed this course.</p>
            <p className="mt-0.5 text-xs text-[#0A6847]/80">
              Your certificate is ready to download.
            </p>
          </div>
          {certificateQuery.data && (
            <button type="button" onClick={downloadCertificate} className="btn-primary-sm">
              Download certificate ({certificateQuery.data.certificateNumber})
            </button>
          )}
        </div>
      )}

      <ErrorNote message={error} />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Main lesson pane */}
        <div className="min-w-0 space-y-4">
          {!selectedModule && <p className="text-slate-500">Select a lesson to begin.</p>}

          {selectedModule && (
            <>
              <div>
                <p className="label-field">
                  Module {selectedModule.displayOrder}: {selectedModule.title}
                </p>
              </div>

              {effectiveSelection?.type === "content" && selectedContent && (
                <div className="card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          selectedContent.contentType === "VIDEO"
                            ? "bg-sky-100 text-sky-700"
                            : "bg-violet-100 text-violet-700"
                        }`}
                      >
                        {selectedContent.contentType}
                      </span>
                      <h3 className="mt-1.5 text-lg font-bold text-slate-900">
                        {selectedContent.title}
                      </h3>
                    </div>
                    <button
                      type="button"
                      disabled={selectedContent.completed || completeContent.isPending}
                      onClick={() =>
                        completeContent.mutate({
                          moduleId: selectedModule.id,
                          contentId: selectedContent.id,
                        })
                      }
                      className={
                        selectedContent.completed
                          ? "badge-brand shrink-0 px-3 py-1.5"
                          : "btn-primary-sm shrink-0"
                      }
                    >
                      {selectedContent.completed ? "✓ Completed" : "Mark complete"}
                    </button>
                  </div>

                  {selectedContent.contentType === "TEXT" ? (
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                      {selectedContent.contentBody}
                    </p>
                  ) : (
                    <div className="mt-4 space-y-4">
                      <VideoPlayer video={selectedContent.video} title={selectedContent.title} />
                      {selectedContent.description && (
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                          {selectedContent.description}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {effectiveSelection?.type === "quiz" && (
                <LearnerQuizPanel
                  key={selectedModule.id}
                  courseId={courseId}
                  module={selectedModule}
                  onProgress={() => {
                    queryClient.invalidateQueries({ queryKey: ["course-certificate", courseId] });
                  }}
                />
              )}
            </>
          )}
        </div>

        {/* Playlist sidebar */}
        <aside className="card-flush h-fit lg:sticky lg:top-20">
          <div className="space-y-3 border-b border-slate-100 p-4">
            <h3 className="font-bold text-slate-900">Playlist</h3>
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <circle cx="11" cy="11" r="7" />
                <path strokeLinecap="round" d="m20 20-3.5-3.5" />
              </svg>
              <input
                value={playlistSearch}
                onChange={(event) => setPlaylistSearch(event.target.value)}
                placeholder="Search playlist"
                className="input-field pl-9 text-sm"
              />
            </div>
            <label className="flex items-center justify-end gap-2 text-xs font-medium text-slate-600">
              <input
                type="checkbox"
                checked={autoPlay}
                onChange={(event) => setAutoPlay(event.target.checked)}
                className="rounded border-slate-300 text-[#0A6847] focus:ring-[#0A6847]/30"
              />
              Auto Play
            </label>
          </div>

          <div className="max-h-[70vh] overflow-y-auto">
            {modules.map((module) => {
              const contents = contentsByModuleId[module.id];
              const lessonMatches =
                (contents ?? []).some((c) => matchesSearch(c.title)) ||
                matchesSearch(module.title);
              if (search && !lessonMatches) return null;

              const collapsed = collapsedModuleIds.has(module.id);

              return (
                <div key={module.id} className="border-b border-slate-100 last:border-0">
                  <button
                    type="button"
                    onClick={() => toggleModule(module.id)}
                    className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-50"
                  >
                    <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
                      {module.displayOrder}. {module.title}
                      {!module.unlocked && <span title="Locked">🔒</span>}
                    </span>
                    <svg
                      className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${collapsed ? "-rotate-90" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                    </svg>
                  </button>

                  {!collapsed && (
                    <div className="pb-2">
                      {!module.unlocked && (
                        <p className="px-4 pb-2 text-xs text-slate-400">
                          {module.contentCount} item(s) &middot; locked
                        </p>
                      )}

                      {module.unlocked &&
                        (contents ?? [])
                          .filter((content) => matchesSearch(content.title) || !search)
                          .map((content) => {
                            const active =
                              effectiveSelection?.type === "content" &&
                              effectiveSelection.contentId === content.id;
                            return (
                              <button
                                key={content.id}
                                type="button"
                                onClick={() => selectLesson(module.id, "content", content.id)}
                                className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition ${
                                  active
                                    ? "bg-[#F4FAF4] text-[#0A6847]"
                                    : "text-slate-700 hover:bg-slate-50"
                                }`}
                              >
                                {content.completed ? (
                                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#0A6847] text-[10px] text-white">
                                    &#10003;
                                  </span>
                                ) : (
                                  <span className="h-4 w-4 shrink-0 rounded-full border-2 border-slate-300" />
                                )}
                                <span className="min-w-0 flex-1 truncate">{content.title}</span>
                                <span className="shrink-0 text-xs text-slate-400">
                                  {estimateMinutes(content)}m
                                </span>
                              </button>
                            );
                          })}

                      {module.unlocked && module.hasQuiz && (!search || matchesSearch("quiz")) && (
                        <button
                          type="button"
                          onClick={() => selectLesson(module.id, "quiz")}
                          className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition ${
                            effectiveSelection?.type === "quiz" &&
                            effectiveSelection.moduleId === module.id
                              ? "bg-[#F4FAF4] text-[#0A6847]"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {module.quizPassed ? (
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#0A6847] text-[10px] text-white">
                              &#10003;
                            </span>
                          ) : (
                            <span className="h-4 w-4 shrink-0 rounded-full border-2 border-slate-300" />
                          )}
                          <span className="min-w-0 flex-1 truncate">Module Quiz</span>
                          <span className={`shrink-0 ${STATUS_BADGE[module.status]}`}>
                            {STATUS_LABEL[module.status]}
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="border-t border-slate-100 p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-900">Course Duration</span>
              <span className="text-slate-500">{formatDuration(totalMinutes)}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[#0A6847]"
                style={{ width: `${course.progress.percentComplete}%` }}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function UserIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="8" r="4" />
      <path strokeLinecap="round" d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path strokeLinecap="round" d="m8.3 10.7 7.4-4.4M8.3 13.3l7.4 4.4" />
    </svg>
  );
}
