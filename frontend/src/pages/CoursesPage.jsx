import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

import { api, getApiErrorMessage, getApiErrorProblems } from "@/api/client";
import { useAuth } from "@/auth/useAuth";
import ErrorNote from "@/components/ErrorNote";

const STATUS_STYLES = {
  DRAFT: "bg-amber-100 text-amber-800",
  PUBLISHED: "bg-green-100 text-green-800",
  ARCHIVED: "bg-slate-200 text-slate-700",
};

const EMPTY_FORM = {
  title: "",
  description: "",
  category: "",
  allowSelfEnrollment: false,
};

export default function CoursesPage() {
  const { isAuthor } = useAuth();
  const queryClient = useQueryClient();

  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [problems, setProblems] = useState([]);

  const coursesQuery = useQuery({
    queryKey: ["courses"],
    queryFn: async () => (await api.get("/courses")).data,
  });

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
      <div>
        <h2 className="text-xl font-medium">Courses</h2>
        <p className="mt-1 text-sm text-slate-600">
          {isAuthor
            ? "Courses you own. Other authors' courses are filtered out by the backend."
            : "Published courses. Drafts are never returned to learners."}
        </p>
      </div>

      <ErrorNote message={error} problems={problems} />

      {isAuthor && (
        <form
          onSubmit={handleCreate}
          className="space-y-3 rounded border border-slate-200 bg-white p-4"
        >
          <h3 className="font-medium">New course</h3>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">Title</span>
              <input
                required
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Category</span>
              <input
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium">Description</span>
            <textarea
              required
              rows={2}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.allowSelfEnrollment}
              onChange={(event) =>
                setForm({ ...form, allowSelfEnrollment: event.target.checked })
              }
            />
            Allow self-enrollment
          </label>

          <button
            type="submit"
            disabled={createCourse.isPending}
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {createCourse.isPending ? "Creating..." : "Create draft"}
          </button>
        </form>
      )}

      {coursesQuery.isPending && <p className="text-slate-500">Loading courses...</p>}
      {coursesQuery.isError && (
        <ErrorNote message={getApiErrorMessage(coursesQuery.error)} />
      )}

      {coursesQuery.isSuccess && courses.length === 0 && (
        <p className="rounded border border-dashed border-slate-300 p-6 text-center text-slate-500">
          No courses yet.
        </p>
      )}

      <ul className="space-y-3">
        {courses.map((course) => (
          <li
            key={course.id}
            className="rounded border border-slate-200 bg-white p-4"
          >
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{course.title}</h3>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      STATUS_STYLES[course.status]
                    }`}
                  >
                    {course.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{course.description}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {course.category ?? "Uncategorised"}
                  {course.allowSelfEnrollment && " - self-enrollment open"}
                  {course.publishedAt &&
                    ` - published ${new Date(course.publishedAt).toLocaleDateString()}`}
                </p>
              </div>

              {isAuthor && (
                <div className="flex flex-wrap gap-2">
                  <Link
                    to={`/courses/${course.id}/manage`}
                    className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    Manage Modules & Lessons
                  </Link>

                  {course.status === "DRAFT" && (
                    <>
                      <button
                        type="button"
                        onClick={() => publishCourse.mutate(course.id)}
                        className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100"
                      >
                        Publish
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCourse.mutate(course.id)}
                        className="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
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
