import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

/** Module-by-module learner experience: pick a module, work through its
 * content, then pass its quiz. Locking, completion and scoring all come
 * from the backend - this page only renders what it is told. */
export default function LearnPage() {
  const { courseId } = useParams();
  const queryClient = useQueryClient();
  const [selectedModuleId, setSelectedModuleId] = useState(null);
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

  // The first module worth landing on: whatever is unlocked and not yet
  // complete, or the first module if everything is already done.
  const defaultModuleId = useMemo(() => {
    const next = modules.find((m) => m.unlocked && m.status !== "COMPLETED") ?? modules[0];
    return next?.id ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modulesQuery.data]);

  const effectiveModuleId = selectedModuleId ?? defaultModuleId;
  const selectedModule = modules.find((m) => m.id === effectiveModuleId) ?? null;

  const contentsQuery = useQuery({
    queryKey: ["learner-contents", courseId, effectiveModuleId],
    queryFn: async () =>
      (await api.get(`/courses/${courseId}/modules/${effectiveModuleId}/contents`)).data.data,
    enabled: Boolean(effectiveModuleId && selectedModule?.unlocked),
  });

  const certificateQuery = useQuery({
    queryKey: ["course-certificate", courseId],
    queryFn: async () => (await api.get(`/my/courses/${courseId}/certificate`)).data.data,
    enabled: courseQuery.data?.enrollment.status === "COMPLETED",
    retry: false,
  });

  const completeContent = useMutation({
    mutationFn: (contentId) =>
      api.post(
        `/my/courses/${courseId}/modules/${effectiveModuleId}/contents/${contentId}/complete`,
      ),
    onSuccess: () => {
      setError("");
      queryClient.invalidateQueries({
        queryKey: ["learner-contents", courseId, effectiveModuleId],
      });
      queryClient.invalidateQueries({ queryKey: ["learner-modules", courseId] });
      queryClient.invalidateQueries({ queryKey: ["my-course", courseId] });
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
  const contents = contentsQuery.data ?? [];

  return (
    <div className="space-y-6 pb-12">
      <div>
        <Link to="/courses" className="text-sm font-semibold text-[#0A6847] hover:underline">
          &larr; Back to Courses
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
          {course.title}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{course.description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="h-2 w-48 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#0A6847]"
              style={{ width: `${course.progress.percentComplete}%` }}
            />
          </div>
          <span className="text-xs text-slate-500">
            {course.progress.completedModules} of {course.progress.totalModules} modules
            complete ({course.progress.percentComplete}%)
          </span>
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

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <nav className="space-y-2">
          {modules.map((module) => (
            <button
              key={module.id}
              type="button"
              disabled={!module.unlocked}
              onClick={() => setSelectedModuleId(module.id)}
              className={`w-full rounded-xl border p-3.5 text-left text-sm transition ${
                module.id === effectiveModuleId
                  ? "border-[#0A6847] bg-white shadow-sm ring-1 ring-[#0A6847]/20"
                  : "border-slate-200 bg-white"
              } ${!module.unlocked ? "cursor-not-allowed opacity-50" : "hover:border-[#7ABA78]"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-900">
                  {module.displayOrder}. {module.title}
                </span>
                {!module.unlocked && <span title="Locked">🔒</span>}
              </div>
              <span className={`mt-1.5 inline-block ${STATUS_BADGE[module.status]}`}>
                {STATUS_LABEL[module.status]}
              </span>
            </button>
          ))}
        </nav>

        <div className="space-y-4">
          {!selectedModule && <p className="text-slate-500">Select a module to begin.</p>}

          {selectedModule && !selectedModule.unlocked && (
            <p className="card border-dashed text-center text-sm text-slate-500">
              This module is locked. Complete the previous module first.
            </p>
          )}

          {selectedModule && selectedModule.unlocked && (
            <>
              <div>
                <h2 className="text-lg font-bold text-slate-900">{selectedModule.title}</h2>
                {selectedModule.description && (
                  <p className="mt-1 text-sm text-slate-500">{selectedModule.description}</p>
                )}
              </div>

              {contentsQuery.isPending && (
                <p className="text-sm text-slate-500">Loading content...</p>
              )}

              {contentsQuery.isSuccess && contents.length === 0 && (
                <p className="card border-dashed text-sm text-slate-500">
                  This module has no content yet.
                </p>
              )}

              <ul className="space-y-3">
                {contents.map((item) => (
                  <li key={item.id} className="card">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                              item.contentType === "VIDEO"
                                ? "bg-sky-100 text-sky-700"
                                : "bg-violet-100 text-violet-700"
                            }`}
                          >
                            {item.contentType}
                          </span>
                          <h3 className="font-semibold text-slate-900">
                            {item.displayOrder}. {item.title}
                          </h3>
                        </div>

                        {item.contentType === "TEXT" ? (
                          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                            {item.contentBody}
                          </p>
                        ) : (
                          <div className="mt-2 max-w-xl">
                            <VideoPlayer video={item.video} title={item.title} />
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={item.completed || completeContent.isPending}
                        onClick={() => completeContent.mutate(item.id)}
                        className={
                          item.completed ? "badge-brand shrink-0 px-3 py-1.5" : "btn-primary-sm shrink-0"
                        }
                      >
                        {item.completed ? "✓ Completed" : "Mark complete"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <LearnerQuizPanel
                key={selectedModule.id}
                courseId={courseId}
                module={selectedModule}
                onProgress={() => {
                  queryClient.invalidateQueries({ queryKey: ["course-certificate", courseId] });
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
