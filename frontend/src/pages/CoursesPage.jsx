import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { api, getApiErrorMessage, getApiErrorProblems } from "@/api/client";
import { useAuth } from "@/auth/useAuth";
import ConfirmModal from "@/components/ConfirmModal";
import ErrorNote from "@/components/ErrorNote";
import { containerStaggerVariants, dropdownVariants, itemFadeUpVariants } from "@/utils/motion";

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

function CategoryFilterDropdown({ value, onChange, categories }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLabel = value || "All categories";

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between gap-3 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-700 hover:border-slate-400 focus:border-[#0A6847] focus:outline-none focus:ring-2 focus:ring-[#0A6847]/20 min-w-[190px] transition"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate font-medium">{selectedLabel}</span>
        <svg
          className={`h-4 w-4 text-slate-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute left-0 top-full mt-1.5 w-60 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl ring-1 ring-black/5 z-50 origin-top-left"
          >
            <div className="max-h-60 overflow-y-auto space-y-0.5">
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm rounded-lg transition ${
                  !value
                    ? "bg-[#E8F5E9] font-bold text-[#0A6847]"
                    : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span>All categories</span>
                {!value && <span className="text-[#0A6847] text-xs font-bold">&#10003;</span>}
              </button>

              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    onChange(cat);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm rounded-lg transition ${
                    value === cat
                      ? "bg-[#E8F5E9] font-bold text-[#0A6847]"
                      : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <span className="truncate">{cat}</span>
                  {value === cat && <span className="text-[#0A6847] text-xs font-bold">&#10003;</span>}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function CoursesPage() {
  const { isAuthor } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState(EMPTY_FORM);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    description: "",
    confirmLabel: "Confirm",
    variant: "danger",
    onConfirm: () => {},
  });

  const closeConfirmModal = () => setConfirmModal((prev) => ({ ...prev, isOpen: false }));

  const [searchInput, setSearchInput] = useState("");
  const [category, setCategory] = useState("");
  const [enrolledOnly, setEnrolledOnly] = useState(false);
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
  });

  const myCoursesByCourseId = useMemo(
    () => new Map((myCoursesQuery.data ?? []).map((row) => [row.courseId, row])),
    [myCoursesQuery.data],
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

  const rawCourses = coursesQuery.data?.data ?? [];
  const courses = useMemo(() => {
    if (!enrolledOnly) return rawCourses;
    return rawCourses.filter((course) => myCoursesByCourseId.has(course.id));
  }, [rawCourses, enrolledOnly, myCoursesByCourseId]);
  const pagination = coursesQuery.data?.pagination;
  const hasFilters = Boolean(search || category || enrolledOnly);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Courses</h1>
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

        <CategoryFilterDropdown
          value={category}
          onChange={setCategory}
          categories={categories}
        />

        <button
          type="button"
          onClick={() => setEnrolledOnly(!enrolledOnly)}
          className={`flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-medium border transition ${
            enrolledOnly
              ? "bg-[#E8F5E9] border-[#0A6847] text-[#0A6847] shadow-xs"
              : "bg-white border-slate-300 text-slate-700 hover:border-slate-400"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${enrolledOnly ? "bg-[#0A6847]" : "bg-slate-300"}`} />
          Enrolled only
        </button>

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              setCategory("");
              setEnrolledOnly(false);
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
        <motion.ul
          variants={containerStaggerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-3"
        >
          {courses.map((course) => (
            <motion.li
              variants={itemFadeUpVariants}
              key={course.id}
              className="card transition hover:border-[#7ABA78]/60"
            >
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold text-slate-900 text-base">{course.title}</h3>
                    {course.category && (
                      <span className="text-xs font-semibold text-[#0A6847]">
                        {course.category}
                      </span>
                    )}
                    {course.status === "DRAFT" && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        Draft
                      </span>
                    )}
                    {course.status === "ARCHIVED" && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        Archived
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{course.description}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                    {course.allowSelfEnrollment && <span>Self-enrollment open</span>}
                    {course.allowSelfEnrollment && course.publishedAt && <span>&bull;</span>}
                    {course.publishedAt && (
                      <span>Published {new Date(course.publishedAt).toLocaleDateString()}</span>
                    )}
                  </div>
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
                          setConfirmModal({
                            isOpen: true,
                            title: "Unpublish Course?",
                            description:
                              "Unpublishing removes this course from the catalogue so you can edit it. New learners won't be able to self-enrol until republished, but existing enrolled learners keep access.",
                            confirmLabel: "Unpublish",
                            variant: "warning",
                            onConfirm: () => {
                              unpublishCourse.mutate(course.id);
                              closeConfirmModal();
                            },
                          });
                        }}
                        className="btn-secondary-sm"
                      >
                        Unpublish to edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmModal({
                            isOpen: true,
                            title: "Archive Course?",
                            description:
                              "Archiving permanently removes this course from the catalogue. Learner history and certificates are retained.",
                            confirmLabel: "Archive",
                            variant: "danger",
                            onConfirm: () => {
                              archiveCourse.mutate(course.id);
                              closeConfirmModal();
                            },
                          });
                        }}
                        className="btn-danger-sm"
                      >
                        Archive
                      </button>
                    </>
                  )}

                  {course.status === "ARCHIVED" && (
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmModal({
                          isOpen: true,
                          title: "Delete Course Permanently?",
                          description:
                            "This action cannot be undone. All course modules, lessons, and metadata will be permanently deleted.",
                          confirmLabel: "Delete Course",
                          variant: "danger",
                          onConfirm: () => {
                            deleteCourse.mutate(course.id);
                            closeConfirmModal();
                          },
                        });
                      }}
                      className="btn-danger-sm"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </motion.li>
          ))}
        </motion.ul>
      ) : (
        <motion.div
          variants={containerStaggerVariants}
          initial="hidden"
          animate="visible"
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {courses.map((course, index) => {
            const myCourse = myCoursesByCourseId.get(course.id);
            return (
              <motion.div variants={itemFadeUpVariants} key={course.id}>
                <CourseCard
                  course={course}
                  myCourse={myCourse}
                  index={index}
                  onEnroll={() => enrollCourse.mutate(course.id)}
                  enrolling={enrollCourse.isPending}
                />
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {pagination && (
        <div className="flex items-center justify-between border-t border-slate-200/80 pt-4">
          <p className="text-xs text-slate-500">
            Showing {courses.length} of {pagination.total} course(s) &bull; Page {pagination.page} of{" "}
            {pagination.totalPages || 1}
          </p>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmLabel={confirmModal.confirmLabel}
        variant={confirmModal.variant}
      />
    </div>
  );
}

// A handful of brand-toned gradients, cycled by card position, so a course
// with no thumbnail still reads as a distinct catalogue entry.
const BANNER_GRADIENTS = [
  "from-[#042A1C] to-[#0A6847]",
  "from-[#0A6847] to-[#15803D]",
  "from-[#15803D] to-[#2E7D32]",
  "from-[#063F2A] to-[#15803D]",
];

function CourseCard({ course, myCourse, index, onEnroll, enrolling }) {
  const gradient = BANNER_GRADIENTS[index % BANNER_GRADIENTS.length];

  return (
    <div className="card-flush flex flex-col transition hover:-translate-y-1 hover:shadow-lg hover:border-[#7ABA78]/60 group">
      <div className={`relative flex h-32 items-end justify-between bg-gradient-to-br ${gradient} p-4`}>
        {course.category ? (
          <span className="rounded-md bg-white/95 backdrop-blur-xs px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#0A6847] shadow-xs">
            {course.category}
          </span>
        ) : (
          <span className="rounded-md bg-white/80 backdrop-blur-xs px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-700">
            Curriculum
          </span>
        )}
        <div className="p-1.5 rounded-md bg-white/10 text-white">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-bold text-slate-900 text-base group-hover:text-[#0A6847] transition-colors">{course.title}</h3>
        <p className="mt-2 line-clamp-2 flex-1 text-xs sm:text-sm text-slate-500 leading-relaxed">
          {course.description}
        </p>

        {myCourse && (
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-slate-600">Progress</span>
              <span className="font-bold text-[#0A6847]">{myCourse.progress.percentComplete}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-md bg-slate-100">
              <div
                className="h-full rounded-md bg-[#0A6847]"
                style={{ width: `${myCourse.progress.percentComplete}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-5 pt-3 border-t border-slate-100">
          {myCourse ? (
            <Link
              to={`/learn/courses/${course.id}`}
              className="btn-primary-sm w-full justify-center py-2"
            >
              {myCourse.enrollment.status === "COMPLETED" ? "Review Course" : "Continue Learning"}
            </Link>
          ) : course.allowSelfEnrollment ? (
            <button
              type="button"
              onClick={onEnroll}
              disabled={enrolling}
              className="btn-primary-sm w-full justify-center py-2"
            >
              {enrolling ? "Enrolling..." : "Enroll & Start Course"}
            </button>
          ) : (
            <p className="text-center text-xs text-slate-500 py-1 font-medium">
              Assigned by enterprise instructor
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
