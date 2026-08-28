import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
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

/** Small delay so typing in the search box doesn't fire a request per
 * keystroke - the value only reaches the query once the user pauses. */
function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export default function CoursesPage() {
  const { isAuthor } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState(EMPTY_FORM);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");
  const [problems, setProblems] = useState([]);

  const [searchInput, setSearchInput] = useState("");
  const [category, setCategory] = useState("");
  const search = useDebouncedValue(searchInput, 300);

  const coursesQuery = useQuery({
    queryKey: ["courses", search, category],
    queryFn: async () =>
      (
        await api.get("/courses", {
          params: {
            ...(search ? { search } : {}),
            ...(category ? { category } : {}),
          },
        })
      ).data,
  });

  // A separate, unfiltered fetch just to populate the category dropdown -
  // filtering the visible list must not also shrink the filter's own options.
  const allCoursesQuery = useQuery({
    queryKey: ["courses", "all-for-categories"],
    queryFn: async () => (await api.get("/courses", { params: { limit: 100 } })).data,
  });

  const categories = useMemo(() => {
    const rows = allCoursesQuery.data?.data ?? [];
    return [...new Set(rows.map((c) => c.category).filter(Boolean))].sort();
  }, [allCoursesQuery.data]);

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
  const hasFilters = Boolean(search || category);

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

      {/* Search & filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
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
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search courses..."
            className="input-field pl-9"
          />
        </div>

        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-700 focus:border-[#0A6847] focus:outline-none focus:ring-2 focus:ring-[#0A6847]/20"
        >
          <option value="">All categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              setCategory("");
            }}
            className="text-sm font-semibold text-[#0A6847] hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {coursesQuery.isPending && <p className="text-slate-500">Loading courses...</p>}
      {coursesQuery.isError && (
        <ErrorNote message={getApiErrorMessage(coursesQuery.error)} />
      )}

      {coursesQuery.isSuccess && courses.length === 0 && (
        <p className="card border-dashed text-center text-slate-500">
          {hasFilters ? "No courses match your search." : "No courses yet."}
        </p>
      )}

      {isAuthor ? (
        <ul className="space-y-3">
          {courses.map((course) => (
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
                </div>

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
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course, index) => {
            const myCourse = myCoursesByCourseId.get(course.id);
            return (
              <CourseCard
                key={course.id}
                course={course}
                myCourse={myCourse}
                index={index}
                onEnroll={() => enrollCourse.mutate(course.id)}
                enrolling={enrollCourse.isPending}
              />
            );
          })}
        </div>
      )}

      {pagination && (
        <p className="text-xs text-slate-500">
          {pagination.total} course(s), page {pagination.page} of{" "}
          {pagination.totalPages || 1}
        </p>
      )}
    </div>
  );
}

// A handful of brand-toned gradients, cycled by card position, so a course
// with no thumbnail still reads as a distinct catalogue entry.
const BANNER_GRADIENTS = [
  "from-[#0A6847] to-[#15803D]",
  "from-[#15803D] to-[#7ABA78]",
  "from-[#063F2A] to-[#0A6847]",
  "from-[#7ABA78] to-[#0A6847]",
];

function CourseCard({ course, myCourse, index, onEnroll, enrolling }) {
  const gradient = BANNER_GRADIENTS[index % BANNER_GRADIENTS.length];

  return (
    <div className="card-flush flex flex-col transition hover:-translate-y-0.5 hover:shadow-md">
      <div className={`relative flex h-28 items-end bg-gradient-to-br ${gradient} p-4`}>
        {course.category && (
          <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#0A6847]">
            {course.category}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-bold text-slate-900">{course.title}</h3>
        <p className="mt-1.5 line-clamp-3 flex-1 text-sm text-slate-500">
          {course.description}
        </p>

        {myCourse && (
          <div className="mt-4 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[#0A6847]"
                style={{ width: `${myCourse.progress.percentComplete}%` }}
              />
            </div>
            <span className="text-xs text-slate-500">{myCourse.progress.percentComplete}%</span>
          </div>
        )}

        <div className="mt-4">
          {myCourse ? (
            <Link
              to={`/learn/courses/${course.id}`}
              className="btn-primary-sm w-full justify-center"
            >
              {myCourse.enrollment.status === "COMPLETED" ? "Review course" : "Continue learning"}
            </Link>
          ) : course.allowSelfEnrollment ? (
            <button
              type="button"
              onClick={onEnroll}
              disabled={enrolling}
              className="btn-primary-sm w-full justify-center"
            >
              {enrolling ? "Enrolling..." : "Start course"}
            </button>
          ) : (
            <p className="text-center text-xs text-slate-500">
              Ask an instructor to assign this course.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
