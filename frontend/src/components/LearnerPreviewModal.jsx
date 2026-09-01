import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import VideoPlayer from "@/components/VideoPlayer";
import { parseVideoUrl } from "@/lib/video";

export default function LearnerPreviewModal({ isOpen, onClose, course, modules = [] }) {
  if (!isOpen || !course) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-900/75 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-4xl rounded-xl border border-slate-200 bg-slate-50 shadow-2xl transition-all my-8 max-h-[90vh] flex flex-col overflow-hidden z-[101]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 uppercase tracking-wide">
              Learner Published Preview
            </span>
            <span className="text-xs text-slate-500">
              (How learners will view this course once published)
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Course Banner */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {course.category || "General Course"}
                </span>
                <h1 className="text-2xl font-extrabold text-slate-900 mt-1">{course.title}</h1>
                <p className="text-slate-600 mt-2 text-sm leading-relaxed">{course.description}</p>
              </div>

              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 space-y-1">
                <div>
                  Enrollment: <strong>{course.allowSelfEnrollment ? "Self Enrollment Allowed" : "Assigned Only"}</strong>
                </div>
                <div>
                  Total Modules: <strong>{modules.length}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Modules List */}
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-2">
              Course Modules & Learning Path
            </h2>

            {modules.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                No modules added to this course yet.
              </div>
            ) : (
              modules.map((mod, modIdx) => (
                <LearnerModulePreviewCard
                  key={mod.id || modIdx}
                  courseId={course.id}
                  mod={mod}
                  modIdx={modIdx}
                />
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-white px-6 py-3 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Clicking close will return you to Course Authoring Mode.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="btn-primary"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function LearnerModulePreviewCard({ courseId, mod, modIdx }) {
  // Fetch contents for this module if mod.contents is not provided
  const contentsQuery = useQuery({
    queryKey: ["module-contents", courseId, mod.id],
    queryFn: async () =>
      (await api.get(`/courses/${courseId}/modules/${mod.id}/contents`)).data,
    enabled: Boolean(courseId && mod.id),
  });

  // Fetch quiz for this module
  const quizQuery = useQuery({
    queryKey: ["quiz", mod.id],
    queryFn: async () => {
      try {
        return (await api.get(`/courses/${courseId}/modules/${mod.id}/quiz`)).data.data;
      } catch (err) {
        if (err?.response?.status === 404) return null;
        throw err;
      }
    },
    enabled: Boolean(courseId && mod.id),
    retry: false,
  });

  const contents = mod.contents || contentsQuery.data?.data || [];
  const quiz = quizQuery.data;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden space-y-0">
      {/* Module Title Bar */}
      <div className="border-b border-slate-200 bg-slate-100/80 px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0A6847] text-xs font-bold text-white">
            {mod.displayOrder || modIdx + 1}
          </span>
          <div>
            <h3 className="font-bold text-slate-900 text-base">{mod.title}</h3>
            {mod.description && (
              <p className="text-xs text-slate-600 mt-0.5">{mod.description}</p>
            )}
          </div>
        </div>

        <span className="rounded bg-slate-200/70 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
          Module {modIdx + 1}
        </span>
      </div>

      {/* Module Lessons & Contents */}
      <div className="p-5 space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Lessons & Learning Resources ({contents.length})
        </h4>

        {contentsQuery.isPending && !mod.contents ? (
          <p className="text-xs text-slate-400">Loading lesson content...</p>
        ) : contents.length === 0 ? (
          <p className="text-xs text-slate-500 italic">No content lessons in this module yet.</p>
        ) : (
          <div className="space-y-3">
            {contents.map((item, itemIdx) => {
              const videoObj =
                item.contentType === "VIDEO"
                  ? item.video || parseVideoUrl(item.videoUrl)
                  : null;

              return (
                <div
                  key={item.id || itemIdx}
                  className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                        item.contentType === "VIDEO"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-purple-100 text-purple-800"
                      }`}
                    >
                      {item.contentType}
                    </span>
                    <h5 className="text-sm font-semibold text-slate-900">
                      {item.displayOrder || itemIdx + 1}. {item.title}
                    </h5>
                  </div>

                  {item.contentType === "TEXT" ? (
                    <div className="rounded-lg bg-white p-3 border border-slate-200">
                      <MarkdownRenderer content={item.contentBody || ""} />
                    </div>
                  ) : (
                    <div className="space-y-2 pt-1">
                      {videoObj ? (
                        <div className="max-w-xl rounded-lg overflow-hidden shadow-sm">
                          <VideoPlayer video={videoObj} title={item.title} />
                        </div>
                      ) : (
                        <p className="text-xs text-slate-600 pl-2 border-l-2 border-slate-300">
                          URL:{" "}
                          <a
                            href={item.videoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 underline"
                          >
                            {item.videoUrl}
                          </a>
                        </p>
                      )}
                      {item.description && (
                        <p className="text-xs text-slate-700 whitespace-pre-wrap pl-2 border-l-2 border-slate-300 leading-relaxed">
                          {item.description}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Quiz Section in Learner Preview */}
        <div className="pt-3 border-t border-slate-100">
          {quizQuery.isPending ? (
            <p className="text-xs text-slate-400">Loading module quiz...</p>
          ) : quiz ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/60 pb-2">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-900 uppercase">
                    Module Quiz
                  </span>
                  <h5 className="text-sm font-bold text-slate-900">{quiz.title}</h5>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-700 font-medium">
                  <span>Passing Score: <strong>{quiz.passingScore}%</strong></span>
                  <span>Max Attempts: <strong>{quiz.maxAttempts ?? "Unlimited"}</strong></span>
                  <span>Questions: <strong>{quiz.questions?.length ?? 0}</strong></span>
                </div>
              </div>

              {quiz.questions && quiz.questions.length > 0 ? (
                <div className="space-y-2 pt-1">
                  <span className="text-[11px] font-semibold text-slate-600 uppercase">
                    Assessment Questions Preview ({quiz.questions.length}):
                  </span>
                  <div className="space-y-2">
                    {quiz.questions.map((q, qIdx) => (
                      <div
                        key={q.id || qIdx}
                        className="rounded border border-amber-200/80 bg-white p-3 text-xs space-y-1.5 shadow-2xs"
                      >
                        <div className="flex items-center justify-between font-semibold text-slate-900">
                          <span>
                            Q{qIdx + 1}: {q.questionText}
                          </span>
                          <span className="text-slate-500 font-normal">{q.points} pts</span>
                        </div>

                        {q.answers && q.answers.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 pl-2">
                            {q.answers.map((ans, aIdx) => (
                              <div
                                key={ans.id || aIdx}
                                className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700 text-[11px]"
                              >
                                • {ans.answerText}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-600">
                  Quiz configured. Questions will be loaded when learner starts an attempt.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-center text-xs text-slate-500">
              No quiz created for this module yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
