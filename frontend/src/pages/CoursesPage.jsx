import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { api, getApiErrorMessage, getApiErrorProblems } from "@/api/client";
import { useAuth } from "@/auth/useAuth";
import ErrorNote from "@/components/ErrorNote";

const STATUS_STYLES = {
  DRAFT: "badge-amber",
  PUBLISHED: "badge-brand",
  ARCHIVED: "badge-slate",
};

const EMPTY_FORM = {
  title: "",
  description: "",
  category: "",
  allowSelfEnrollment: false,
};

export default function CoursesPage() {
  const { isAuthor } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState(EMPTY_FORM);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");
  const [problems, setProblems] = useState([]);

  const coursesQuery = useQuery({
    queryKey: ["courses"],
    queryFn: async () => (await api.get("/courses")).data,
  });

  const myCoursesQuery = useQuery({
    queryKey: ["my-courses"],
    queryFn: async () => (await api.get("/my/courses")).data.data,
    enabled: !isAuthor,
  });

  const myCoursesByCourseId = new Map(
    (myCoursesQuery.data ?? []).map((row) => [row.courseId, row]),
  );

  function reportError(mutationError) {
    setError(getApiErrorMessage(mutationError));
    setProblems(getApiErrorProblems(mutationError));
  }

  function clearError() {
    setError("");
    setProblems([]);
  }

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["courses"] });

  const createCourse = useMutation({
    mutationFn: (payload) => api.post("/courses", payload),
    onSuccess: () => {
      setForm(EMPTY_FORM);
      setShowCreate(false);
      clearError();
      refresh();
    },
    onError: reportError,
  });

  const publishCourse = useMutation({
    mutationFn: (id) => api.post(`/courses/${id}/publish`),
    onSuccess: () => {
      clearError();
      refresh();
    },
    onError: reportError,
  });

  const deleteCourse = useMutation({
    mutationFn: (id) => api.delete(`/courses/${id}`),
    onSuccess: () => {
      clearError();
      refresh();
    },
    onError: reportError,
  });

  const unpublishCourse = useMutation({
    mutationFn: (id) => api.post(`/courses/${id}/unpublish`),
    onSuccess: () => {
      clearError();
      refresh();
    },
    onError: reportError,
  });

  const archiveCourse = useMutation({
    mutationFn: (id) => api.post(`/courses/${id}/archive`),
    onSuccess: () => {
      clearError();
      refresh();
    },
    onError: reportError,
  });

  const enrollCourse = useMutation({
    mutationFn: (id) => api.post(`/courses/${id}/enroll`),
    onSuccess: (_response, courseId) => {
      clearError();
      queryClient.invalidateQueries({ queryKey: ["my-courses"] });
      navigate(`/learn/courses/${courseId}`);
    },
    onError: reportError,
  });

  function handleCreate(event) {
    event.preventDefault();
    clearError();
    createCourse.mutate({
      title: form.title,
      description: form.description,
      category: form.category || null,
      allowSelfEnrollment: form.allowSelfEnrollment,
    });
  }

  const courses = coursesQuery.data?.data ?? [];
  const pagination = coursesQuery.data?.pagination;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Courses</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isAuthor
              ? "Courses you own. Other authors' courses are filtered out by the backend."
              : "Published courses. Drafts are never returned to learners."}
          </p>
        </div>

        {isAuthor && (
          <button type="button" onClick={() => setShowCreate((open) => !open)} className="btn-primary">
            {showCreate ? "Cancel" : "+ New course"}
          </button>
        )}
      </div>

      <ErrorNote message={error} problems={problems} />

      {isAuthor && showCreate && (
        <form onSubmit={handleCreate} className="card space-y-4">
          <h3 className="font-bold text-slate-900">New course</h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="label-field">Title</span>
              <input
                required
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                className="input-field mt-1.5"
              />
            </label>
            <label className="block">
              <span className="label-field">Category</span>
              <input
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
                className="input-field mt-1.5"
              />
            </label>
          </div>

          <label className="block">
            <span className="label-field">Description</span>
            <textarea
              required
              rows={2}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              className="input-field mt-1.5"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.allowSelfEnrollment}
              onChange={(event) =>
                setForm({ ...form, allowSelfEnrollment: event.target.checked })
              }
              className="rounded border-slate-300 text-[#0A6847] focus:ring-[#0A6847]/30"
            />
            Allow self-enrollment
          </label>

          <button type="submit" disabled={createCourse.isPending} className="btn-primary">
            {createCourse.isPending ? "Creating..." : "Create draft"}
          </button>
        </form>
      )}

      {coursesQuery.isPending && <p className="text-slate-500">Loading courses...</p>}
      {coursesQuery.isError && (
        <ErrorNote message={getApiErrorMessage(coursesQuery.error)} />
      )}

      {coursesQuery.isSuccess && courses.length === 0 && (
        <p className="card border-dashed text-center text-slate-500">No courses yet.</p>
      )}

      <ul className="space-y-3">
        {courses.map((course) => {
          const myCourse = myCoursesByCourseId.get(course.id);

          return (
            <li key={course.id} className="card transition hover:border-[#7ABA78]/60">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900">{course.title}</h3>
                    <span className={STATUS_STYLES[course.status]}>{course.status}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{course.description}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {course.category ?? "Uncategorised"}
                    {course.allowSelfEnrollment && " · self-enrollment open"}
                    {course.publishedAt &&
                      ` · published ${new Date(course.publishedAt).toLocaleDateString()}`}
                  </p>
                  {!isAuthor && myCourse && (
                    <div className="mt-3 flex items-center gap-2">
                      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-[#0A6847]"
                          style={{ width: `${myCourse.progress.percentComplete}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500">
                        {myCourse.progress.completedModules}/{myCourse.progress.totalModules}{" "}
                        modules &middot; {myCourse.progress.percentComplete}%
                      </span>
                    </div>
                  )}
                </div>

                {!isAuthor && (
                  <div className="flex flex-wrap gap-2">
                    {myCourse ? (
                      <Link to={`/learn/courses/${course.id}`} className="btn-primary-sm">
                        {myCourse.enrollment.status === "COMPLETED"
                          ? "Review course"
                          : "Continue learning"}
                      </Link>
                    ) : course.allowSelfEnrollment ? (
                      <button
                        type="button"
                        onClick={() => enrollCourse.mutate(course.id)}
                        disabled={enrollCourse.isPending}
                        className="btn-primary-sm"
                      >
                        {enrollCourse.isPending ? "Enrolling..." : "Start course"}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500">
                        Ask an instructor to assign this course.
                      </span>
                    )}
                  </div>
                )}

                {isAuthor && (
                  <div className="flex flex-wrap gap-2">
                    <Link to={`/courses/${course.id}/manage`} className="btn-primary-sm">
                      Manage Modules & Lessons
                    </Link>

                    {course.status === "PUBLISHED" && (
                      <Link to={`/courses/${course.id}/assignments`} className="btn-secondary-sm">
                        Assign
                      </Link>
                    )}

                    {course.status === "DRAFT" && (
                      <>
                        <button
                          type="button"
                          onClick={() => publishCourse.mutate(course.id)}
                          className="btn-secondary-sm"
                        >
                          Publish
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCourse.mutate(course.id)}
                          className="btn-danger-sm"
                        >
                          Delete
                        </button>
                      </>
                    )}

                    {course.status === "PUBLISHED" && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              confirm(
                                "Unpublish this course so you can edit it? " +
                                  "It leaves the catalogue and new learners can't self-enrol " +
                                  "until you republish. Learners already enrolled keep their access.",
                              )
                            ) {
                              unpublishCourse.mutate(course.id);
                            }
                          }}
                          className="btn-secondary-sm"
                        >
                          Unpublish to edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              confirm(
                                "Archive this course? It leaves the catalogue permanently. " +
                                  "Certificates and learner history are kept, but this can't be undone.",
                              )
                            ) {
                              archiveCourse.mutate(course.id);
                            }
                          }}
                          className="btn-danger-sm"
                        >
                          Archive
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {pagination && (
        <p className="text-xs text-slate-500">
          {pagination.total} course(s), page {pagination.page} of{" "}
          {pagination.totalPages || 1}
        </p>
      )}
    </div>
  );
}
