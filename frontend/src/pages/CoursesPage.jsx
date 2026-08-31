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

function CategorySearchSelect({ value, onChange, categories }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || "");
  const containerRef = useRef(null);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const defaultCategories = useMemo(() => {
    const predefined = [
      "AI & Machine Learning",
      "Cloud Computing",
      "Data Science",
      "Design",
      "DevOps",
      "Mobile Development",
      "Product",
      "Security",
      "Web Development",
    ];
    return [...new Set([...predefined, ...categories])].sort();
  }, [categories]);

  const filteredCategories = useMemo(() => {
    if (!query) return defaultCategories;
    return defaultCategories.filter((c) =>
      c.toLowerCase().includes(query.toLowerCase())
    );
  }, [defaultCategories, query]);

  return (
    <div className="relative mt-1.5" ref={containerRef}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            const newQuery = e.target.value;
            setQuery(newQuery);
            onChange(newQuery);
            setOpen(true);
          }}
          placeholder="Select or type category..."
          className="input-field pr-9"
        />
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          <svg
            className={`h-4 w-4 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute left-0 right-0 top-full mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl ring-1 ring-black/5 z-50 origin-top"
          >
            {filteredCategories.length > 0 ? (
              filteredCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    onChange(cat);
                    setQuery(cat);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm rounded-lg transition ${
                    value === cat
                      ? "bg-[#E8F5E9] font-bold text-[#0A6847]"
                      : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <span>{cat}</span>
                  {value === cat && <span className="text-[#0A6847] text-xs font-bold">&#10003;</span>}
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-xs text-slate-500">
                Use custom category <strong className="text-slate-800">"{query}"</strong>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
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
  const [problems, setProblems] = useState([]);
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
            <div className="block">
              <span className="label-field">Category</span>
              <CategorySearchSelect
                value={form.category}
                onChange={(cat) => setForm({ ...form, category: cat })}
                categories={categories}
              />
            </div>
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
          {courses.map((course, index) => {
            const style =
              CATEGORY_STYLES[course.category] ||
              PALETTE_FALLBACKS[index % PALETTE_FALLBACKS.length];
            return (
              <motion.li
                variants={itemFadeUpVariants}
                key={course.id}
                className={`card transition hover:border-slate-300 border-l-4 ${style.topBorder.replace('border-t-', 'border-l-')}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-slate-900 text-base">{course.title}</h3>
                      {course.category && (
                        <span className={`text-xs font-bold uppercase tracking-wider ${style.text}`}>
                          &bull; {course.category}
                        </span>
                      )}
                      {course.status === "DRAFT" && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 font-semibold bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          Draft
                        </span>
                      )}
                      {course.status === "PUBLISHED" && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Published
                        </span>
                      )}
                      {course.status === "ARCHIVED" && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-semibold bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
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

                  <div className="flex flex-wrap items-center gap-2">
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
                          Unpublish
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
            );
          })}
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

const CATEGORY_STYLES = {
  "AI & Machine Learning": {
    topBorder: "border-t-emerald-500",
    text: "text-emerald-700",
    iconBg: "bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
  "Data Science": {
    topBorder: "border-t-indigo-500",
    text: "text-indigo-700",
    iconBg: "bg-indigo-50 text-indigo-700",
    dot: "bg-indigo-500",
  },
  "Web Development": {
    topBorder: "border-t-cyan-500",
    text: "text-cyan-700",
    iconBg: "bg-cyan-50 text-cyan-700",
    dot: "bg-cyan-500",
  },
  "Cloud Computing": {
    topBorder: "border-t-sky-500",
    text: "text-sky-700",
    iconBg: "bg-sky-50 text-sky-700",
    dot: "bg-sky-500",
  },
  Design: {
    topBorder: "border-t-purple-500",
    text: "text-purple-700",
    iconBg: "bg-purple-50 text-purple-700",
    dot: "bg-purple-500",
  },
  "Mobile Development": {
    topBorder: "border-t-amber-500",
    text: "text-amber-700",
    iconBg: "bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
  },
  Security: {
    topBorder: "border-t-rose-500",
    text: "text-rose-700",
    iconBg: "bg-rose-50 text-rose-700",
    dot: "bg-rose-500",
  },
  Product: {
    topBorder: "border-t-teal-500",
    text: "text-teal-700",
    iconBg: "bg-teal-50 text-teal-700",
    dot: "bg-teal-500",
  },
  DevOps: {
    topBorder: "border-t-blue-500",
    text: "text-blue-700",
    iconBg: "bg-blue-50 text-blue-700",
    dot: "bg-blue-500",
  },
  Development: {
    topBorder: "border-t-emerald-500",
    text: "text-emerald-700",
    iconBg: "bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
};

const PALETTE_FALLBACKS = [
  {
    topBorder: "border-t-emerald-500",
    text: "text-emerald-700",
    iconBg: "bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
  {
    topBorder: "border-t-indigo-500",
    text: "text-indigo-700",
    iconBg: "bg-indigo-50 text-indigo-700",
    dot: "bg-indigo-500",
  },
  {
    topBorder: "border-t-sky-500",
    text: "text-sky-700",
    iconBg: "bg-sky-50 text-sky-700",
    dot: "bg-sky-500",
  },
  {
    topBorder: "border-t-purple-500",
    text: "text-purple-700",
    iconBg: "bg-purple-50 text-purple-700",
    dot: "bg-purple-500",
  },
];

function CourseCard({ course, myCourse, index, onEnroll, enrolling }) {
  const style =
    CATEGORY_STYLES[course.category] ||
    PALETTE_FALLBACKS[index % PALETTE_FALLBACKS.length];

  return (
    <div className={`h-full flex flex-col rounded-2xl border border-slate-200/90 bg-white shadow-xs hover:shadow-xl hover:border-slate-300 transition-all duration-300 overflow-hidden group border-t-4 ${style.topBorder}`}>
      {/* Top Header Section without Pills */}
      <div className="p-4 pb-0 flex items-center justify-between">
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider ${style.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
          {course.category || "Curriculum"}
        </span>

        <div className={`p-2 rounded-xl ${style.iconBg}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="flex flex-1 flex-col p-4 pt-3">
        <h3 className="font-bold text-slate-900 text-base group-hover:text-[#0A6847] transition-colors line-clamp-2 leading-snug">
          {course.title}
        </h3>
        <p className="mt-2 line-clamp-2 flex-1 text-xs text-slate-500 leading-relaxed">
          {course.description || "Comprehensive hands-on training module with live interactive guides."}
        </p>

        {myCourse && (
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-slate-600">Progress</span>
              <span className="font-bold text-[#0A6847]">{myCourse.progress.percentComplete}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#0A6847] to-[#15803D] transition-all duration-500"
                style={{ width: `${myCourse.progress.percentComplete}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-slate-100">
          {myCourse ? (
            <Link
              to={`/learn/courses/${course.id}`}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#0A6847] px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#085438] transition group/btn"
            >
              <span>{myCourse.enrollment.status === "COMPLETED" ? "Review Course" : "Continue Learning"}</span>
              <span className="transition-transform duration-200 group-hover/btn:translate-x-1.5">&rarr;</span>
            </Link>
          ) : course.allowSelfEnrollment ? (
            <button
              type="button"
              onClick={onEnroll}
              disabled={enrolling}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#0A6847] px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#085438] transition disabled:opacity-50 group/btn"
            >
              <span>{enrolling ? "Enrolling..." : "Enroll & Start Course"}</span>
              <span className="transition-transform duration-200 group-hover/btn:translate-x-1.5">&rarr;</span>
            </button>
          ) : (
            <p className="text-center text-xs text-slate-500 py-2 font-medium bg-slate-50 rounded-xl border border-slate-100">
              Assigned by enterprise instructor
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
