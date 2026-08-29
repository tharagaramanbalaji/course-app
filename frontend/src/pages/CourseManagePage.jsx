import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api, getApiErrorMessage, getApiErrorProblems } from "@/api/client";
import { useAuth } from "@/auth/useAuth";
import AddContentModal from "@/components/AddContentModal";
import ConfirmModal from "@/components/ConfirmModal";
import ErrorNote from "@/components/ErrorNote";
import LearnerPreviewModal from "@/components/LearnerPreviewModal";
import ModuleQuizPanel from "@/components/ModuleQuizPanel";
import StructuredAddModuleModal from "@/components/StructuredAddModuleModal";
import VideoPlayer from "@/components/VideoPlayer";
import VideoUrlInput from "@/components/VideoUrlInput";
import { parseVideoUrl } from "@/lib/video";

function ClockIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <polygon points="9,6 19,12 9,18" fill="currentColor" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function QuizIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function estimateMinutes(item) {
  if (!item) return 5;
  if (item.contentType === "VIDEO") return 8;
  const wordCount = (item.contentBody || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(3, Math.ceil(wordCount / 120));
}

export default function CourseManagePage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { isAuthor } = useAuth();
  const queryClient = useQueryClient();

  const [error, setError] = useState("");
  const [problems, setProblems] = useState([]);
  const [successMsg, setSuccessMsg] = useState("");

  const [showLearnerPreview, setShowLearnerPreview] = useState(false);
  const [showAddModule, setShowAddModule] = useState(false);
  const [addContentModule, setAddContentModule] = useState(null); // { id, title }

  // Active Studio Selection State: { type: 'content' | 'quiz' | 'module', moduleId, contentId? }
  const [activeSelection, setActiveSelection] = useState(null);
  const [workspaceTab, setWorkspaceTab] = useState("edit"); // "edit" | "preview"
  const [playlistSearch, setPlaylistSearch] = useState("");
  const [expandedModules, setExpandedModules] = useState({});

  // Editing form states for active item
  const [lessonEditForm, setLessonEditForm] = useState({
    title: "",
    contentType: "TEXT",
    contentBody: "",
    videoUrl: "",
    description: "",
  });
  const [moduleEditForm, setModuleEditForm] = useState({ title: "", description: "" });
  const [editCourseDetailsModal, setEditCourseDetailsModal] = useState(false);
  const [courseDetailsForm, setCourseDetailsForm] = useState({
    title: "",
    description: "",
    category: "",
    allowSelfEnrollment: false,
  });

  // Modal confirm state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    description: "",
    confirmLabel: "Confirm",
    variant: "danger",
    onConfirm: () => {},
  });
  const closeConfirmModal = () => setConfirmModal((prev) => ({ ...prev, isOpen: false }));

  function reportError(mutationError) {
    setError(getApiErrorMessage(mutationError));
    setProblems(getApiErrorProblems(mutationError));
  }

  function clearError() {
    setError("");
    setProblems([]);
  }

  // --- Queries ---
  const courseQuery = useQuery({
    queryKey: ["course-manage", courseId],
    queryFn: async () => (await api.get(`/courses/${courseId}`)).data.data,
  });

  const modulesQuery = useQuery({
    queryKey: ["course-manage-modules", courseId],
    queryFn: async () => (await api.get(`/courses/${courseId}/modules`)).data.data,
  });

  const course = courseQuery.data;
  const modules = useMemo(() => modulesQuery.data ?? [], [modulesQuery.data]);

  // Fetch contents for each module
  const contentsQueries = useQueries({
    queries: modules.map((mod) => ({
      queryKey: ["module-contents", mod.id],
      queryFn: async () =>
        (await api.get(`/courses/${courseId}/modules/${mod.id}/contents`)).data.data,
      enabled: Boolean(courseId && mod.id),
    })),
  });

  // Fetch quiz for each module
  const quizzesQueries = useQueries({
    queries: modules.map((mod) => ({
      queryKey: ["quiz", mod.id],
      queryFn: async () => {
        try {
          return (await api.get(`/courses/${courseId}/modules/${mod.id}/quiz`)).data.data;
        } catch (requestError) {
          if (requestError?.response?.status === 404) return null;
          return null;
        }
      },
      enabled: Boolean(courseId && mod.id),
      retry: false,
    })),
  });

  const contentsByModuleId = useMemo(() => {
    const map = {};
    modules.forEach((mod, i) => {
      map[mod.id] = contentsQueries[i]?.data ?? [];
    });
    return map;
  }, [modules, contentsQueries]);

  const quizzesByModuleId = useMemo(() => {
    const map = {};
    modules.forEach((mod, i) => {
      map[mod.id] = quizzesQueries[i]?.data ?? null;
    });
    return map;
  }, [modules, quizzesQueries]);

  // Sync course details form
  useEffect(() => {
    if (course) {
      setCourseDetailsForm({
        title: course.title || "",
        description: course.description || "",
        category: course.category || "",
        allowSelfEnrollment: Boolean(course.allowSelfEnrollment),
      });
    }
  }, [course]);

  // Auto-expand all modules by default
  useEffect(() => {
    if (modules.length > 0) {
      const map = {};
      modules.forEach((m) => {
        map[m.id] = true;
      });
      setExpandedModules((prev) => ({ ...map, ...prev }));
    }
  }, [modules]);

  // Default to first content or first module if activeSelection is not set
  useEffect(() => {
    if (modules.length > 0 && !activeSelection) {
      const firstMod = modules[0];
      const firstContents = contentsByModuleId[firstMod.id] || [];
      if (firstContents.length > 0) {
        const firstItem = firstContents[0];
        setActiveSelection({ type: "content", moduleId: firstMod.id, contentId: firstItem.id });
        setLessonEditForm({
          title: firstItem.title || "",
          contentType: firstItem.contentType || "TEXT",
          contentBody: firstItem.contentBody || "",
          videoUrl: firstItem.videoUrl || "",
          description: firstItem.description || "",
        });
      } else {
        setActiveSelection({ type: "module", moduleId: firstMod.id });
        setModuleEditForm({
          title: firstMod.title || "",
          description: firstMod.description || "",
        });
      }
    }
  }, [modules, contentsByModuleId, activeSelection]);

  // --- Mutations ---
  const refreshCourse = () => {
    queryClient.invalidateQueries({ queryKey: ["course-manage", courseId] });
    queryClient.invalidateQueries({ queryKey: ["courses"] });
  };

  const refreshModules = () => {
    queryClient.invalidateQueries({ queryKey: ["course-manage-modules", courseId] });
    queryClient.invalidateQueries({ queryKey: ["module-contents"] });
    queryClient.invalidateQueries({ queryKey: ["quiz"] });
  };

  const updateCourseDetails = useMutation({
    mutationFn: (payload) => api.patch(`/courses/${courseId}`, payload),
    onSuccess: () => {
      clearError();
      refreshCourse();
      setEditCourseDetailsModal(false);
      setSuccessMsg("Course settings updated successfully!");
      setTimeout(() => setSuccessMsg(""), 3500);
    },
    onError: reportError,
  });

  const publishCourse = useMutation({
    mutationFn: () => api.post(`/courses/${courseId}/publish`),
    onSuccess: () => {
      clearError();
      refreshCourse();
      setSuccessMsg("Course published successfully to catalogue!");
      setTimeout(() => setSuccessMsg(""), 3500);
    },
    onError: reportError,
  });

  const unpublishCourse = useMutation({
    mutationFn: () => api.post(`/courses/${courseId}/unpublish`),
    onSuccess: () => {
      clearError();
      refreshCourse();
      setSuccessMsg("Course unpublished. You can now edit modules & lessons.");
      setTimeout(() => setSuccessMsg(""), 3500);
    },
    onError: reportError,
  });

  const archiveCourse = useMutation({
    mutationFn: () => api.post(`/courses/${courseId}/archive`),
    onSuccess: () => {
      clearError();
      refreshCourse();
    },
    onError: reportError,
  });

  const deleteCourse = useMutation({
    mutationFn: () => api.delete(`/courses/${courseId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      navigate("/courses");
    },
    onError: reportError,
  });

  const deleteModule = useMutation({
    mutationFn: (moduleId) => api.delete(`/courses/${courseId}/modules/${moduleId}`),
    onSuccess: () => {
      clearError();
      refreshModules();
      setActiveSelection(null);
      setSuccessMsg("Module deleted successfully.");
      setTimeout(() => setSuccessMsg(""), 3500);
    },
    onError: reportError,
  });

  const updateModule = useMutation({
    mutationFn: ({ moduleId, payload }) =>
      api.patch(`/courses/${courseId}/modules/${moduleId}`, payload),
    onSuccess: () => {
      clearError();
      refreshModules();
      setSuccessMsg("Module details saved successfully!");
      setTimeout(() => setSuccessMsg(""), 3500);
    },
    onError: reportError,
  });

  const reorderModules = useMutation({
    mutationFn: (moduleIds) => api.patch(`/courses/${courseId}/modules/reorder`, { moduleIds }),
    onSuccess: () => {
      clearError();
      refreshModules();
    },
    onError: reportError,
  });

  const addContent = useMutation({
    mutationFn: ({ moduleId, payload }) =>
      api.post(`/courses/${courseId}/modules/${moduleId}/contents`, payload),
    onSuccess: (res, variables) => {
      clearError();
      refreshModules();
      setAddContentModule(null);
      setSuccessMsg("New lesson added successfully!");
      setTimeout(() => setSuccessMsg(""), 3500);
      const created = res.data?.data;
      if (created) {
        setActiveSelection({ type: "content", moduleId: variables.moduleId, contentId: created.id });
        setLessonEditForm({
          title: created.title || "",
          contentType: created.contentType || "TEXT",
          contentBody: created.contentBody || "",
          videoUrl: created.videoUrl || "",
          description: created.description || "",
        });
      }
    },
    onError: reportError,
  });

  const updateContent = useMutation({
    mutationFn: ({ contentId, payload }) => api.patch(`/contents/${contentId}`, payload),
    onSuccess: () => {
      clearError();
      refreshModules();
      setSuccessMsg("Lesson changes saved successfully!");
      setTimeout(() => setSuccessMsg(""), 3500);
    },
    onError: reportError,
  });

  const deleteContent = useMutation({
    mutationFn: (contentId) => api.delete(`/contents/${contentId}`),
    onSuccess: () => {
      clearError();
      refreshModules();
      setActiveSelection(null);
      setSuccessMsg("Lesson deleted successfully.");
      setTimeout(() => setSuccessMsg(""), 3500);
    },
    onError: reportError,
  });

  // --- Handlers ---
  function handleMoveModule(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= modules.length) return;
    const reordered = [...modules];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    reorderModules.mutate(reordered.map((m) => m.id));
  }

  function handleSelectContent(module, item) {
    setActiveSelection({ type: "content", moduleId: module.id, contentId: item.id });
    setWorkspaceTab("edit");
    setSuccessMsg("");
    clearError();
    setLessonEditForm({
      title: item.title || "",
      contentType: item.contentType || "TEXT",
      contentBody: item.contentBody || "",
      videoUrl: item.videoUrl || "",
      description: item.description || "",
    });
  }

  function handleSelectModule(module) {
    setActiveSelection({ type: "module", moduleId: module.id });
    setSuccessMsg("");
    clearError();
    setModuleEditForm({
      title: module.title || "",
      description: module.description || "",
    });
  }

  function handleSelectQuiz(module) {
    setActiveSelection({ type: "quiz", moduleId: module.id });
    setSuccessMsg("");
    clearError();
  }

  function handleSaveLesson(e) {
    e.preventDefault();
    if (!activeSelection || activeSelection.type !== "content") return;
    clearError();
    updateContent.mutate({
      contentId: activeSelection.contentId,
      payload: {
        title: lessonEditForm.title,
        contentType: lessonEditForm.contentType,
        contentBody: lessonEditForm.contentType === "TEXT" ? lessonEditForm.contentBody : null,
        videoUrl: lessonEditForm.contentType === "VIDEO" ? lessonEditForm.videoUrl : null,
        description: lessonEditForm.contentType === "VIDEO" ? lessonEditForm.description : null,
      },
    });
  }

  function handleSaveModule(e) {
    e.preventDefault();
    if (!activeSelection || activeSelection.type !== "module") return;
    clearError();
    updateModule.mutate({
      moduleId: activeSelection.moduleId,
      payload: {
        title: moduleEditForm.title,
        description: moduleEditForm.description || null,
      },
    });
  }

  function handleSaveCourseDetails(e) {
    e.preventDefault();
    clearError();
    updateCourseDetails.mutate(courseDetailsForm);
  }

  if (courseQuery.isPending) {
    return (
      <div className="space-y-4">
        <div className="h-44 w-full animate-pulse rounded-3xl bg-slate-200" />
        <div className="h-64 w-full animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  if (courseQuery.isError || !course) {
    return (
      <div className="space-y-4">
        <ErrorNote message={getApiErrorMessage(courseQuery.error) || "Course not found."} />
        <Link to="/courses" className="text-sm font-semibold text-[#0A6847] hover:underline">
          &larr; Back to Courses
        </Link>
      </div>
    );
  }

  const isDraft = course.status === "DRAFT";
  const searchFilter = playlistSearch.trim().toLowerCase();

  // Selected item lookup
  const activeModule = modules.find((m) => m.id === activeSelection?.moduleId);
  const activeModuleContents = activeModule ? contentsByModuleId[activeModule.id] || [] : [];
  const activeContent = activeModuleContents.find((c) => c.id === activeSelection?.contentId);
  const activeQuiz = activeModule ? quizzesByModuleId[activeModule.id] : null;

  // Total estimated course duration
  const totalMinutes = modules.reduce((sum, mod) => {
    const contents = contentsByModuleId[mod.id] || [];
    return sum + contents.reduce((s, c) => s + estimateMinutes(c), 0);
  }, 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Studio Banner */}
      <div className="relative overflow-hidden rounded-3xl brand-gradient p-8 text-white sm:p-10 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            to="/courses"
            className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase text-white/80 hover:text-white transition"
          >
            &uarr; Back to Catalogue
          </Link>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wider ${
                course.status === "PUBLISHED"
                  ? "bg-emerald-400/20 text-emerald-200 border border-emerald-400/30"
                  : "bg-amber-400/20 text-amber-200 border border-amber-400/30"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${course.status === "PUBLISHED" ? "bg-emerald-400" : "bg-amber-400"}`} />
              {course.status}
            </span>
          </div>
        </div>

        <h1 className="mt-4 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-4xl">
          {course.title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-white/80 leading-relaxed">
          {course.description || "Course Authoring Studio — Organize modules, lessons, and quizzes."}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-semibold text-white/85">
          <span className="inline-flex items-center gap-1.5">
            <ListIcon /> {modules.length} Modules
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ClockIcon /> Est. {totalMinutes} mins total
          </span>
          {course.category && (
            <span className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 text-white">
              Category: {course.category}
            </span>
          )}
        </div>

        {/* Studio Controls Header Bar */}
        <div className="mt-8 flex flex-wrap items-center gap-3 pt-4 border-t border-white/15">
          <button
            type="button"
            onClick={() => setShowLearnerPreview(true)}
            className="rounded-xl bg-white/15 px-4 py-2 text-xs font-bold text-white hover:bg-white/25 transition backdrop-blur-xs flex items-center gap-2"
          >
            👁️ Learner Preview Mode
          </button>

          {isAuthor && (
            <button
              type="button"
              onClick={() => setEditCourseDetailsModal(true)}
              className="rounded-xl bg-white/15 px-4 py-2 text-xs font-bold text-white hover:bg-white/25 transition backdrop-blur-xs"
            >
              ⚙️ Course Settings
            </button>
          )}

          {isAuthor && isDraft && (
            <button
              type="button"
              onClick={() => publishCourse.mutate()}
              disabled={publishCourse.isPending}
              className="rounded-xl bg-white text-[#0A6847] px-4 py-2 text-xs font-extrabold hover:bg-emerald-50 transition shadow-md disabled:opacity-50"
            >
              {publishCourse.isPending ? "Publishing..." : "✓ Publish Course"}
            </button>
          )}

          {isAuthor && course.status === "PUBLISHED" && (
            <button
              type="button"
              onClick={() => {
                setConfirmModal({
                  isOpen: true,
                  title: "Unpublish Course?",
                  description:
                    "Unpublishing removes this course from the catalogue so you can edit content. Existing enrolled learners keep access.",
                  confirmLabel: "Unpublish",
                  variant: "warning",
                  onConfirm: () => {
                    unpublishCourse.mutate();
                    closeConfirmModal();
                  },
                });
              }}
              disabled={unpublishCourse.isPending}
              className="rounded-xl bg-amber-500/20 text-amber-200 border border-amber-400/30 px-4 py-2 text-xs font-bold hover:bg-amber-500/30 transition"
            >
              {unpublishCourse.isPending ? "Unpublishing..." : "Unpublish to Edit"}
            </button>
          )}

          {isAuthor && (
            <button
              type="button"
              onClick={() => {
                setConfirmModal({
                  isOpen: true,
                  title: "Delete Course?",
                  description: "Are you sure you want to delete this course? All modules, lessons, and quizzes will be permanently removed.",
                  confirmLabel: "Delete Course",
                  variant: "danger",
                  onConfirm: () => {
                    deleteCourse.mutate();
                    closeConfirmModal();
                  },
                });
              }}
              className="ml-auto text-xs font-bold text-red-200 hover:text-white underline transition"
            >
              Delete Course
            </button>
          )}
        </div>

        <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-white/10" />
      </div>

      <ErrorNote message={error} problems={problems} />

      {/* Success Toast */}
      {successMsg && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-300 p-4 text-xs font-bold text-[#0A6847] flex items-center justify-between shadow-xs">
          <span className="flex items-center gap-2">✓ {successMsg}</span>
          <button type="button" onClick={() => setSuccessMsg("")} className="text-emerald-700 hover:text-emerald-900">
            ✕
          </button>
        </div>
      )}

      {/* Main Studio 2-Column Grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Interactive Studio Workspace Pane (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {!activeSelection ? (
            <div className="card-flush p-12 text-center text-slate-500 space-y-3">
              <p className="text-sm font-semibold">
                Select a module, lesson, or quiz from the curriculum playlist to start editing.
              </p>
              {isAuthor && isDraft && (
                <button
                  type="button"
                  onClick={() => setShowAddModule(true)}
                  className="btn-primary-sm"
                >
                  + Add First Module
                </button>
              )}
            </div>
          ) : activeSelection.type === "content" && activeContent ? (
            /* LESSON STUDIO WORKSPACE */
            <div className="card-flush space-y-6 p-6">
              {/* Studio Stage Header & Mode Switcher */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#0A6847]">
                    Chapter: {activeModule?.title}
                  </span>
                  <h2 className="text-xl font-extrabold text-slate-900 mt-0.5">
                    {activeContent.title}
                  </h2>
                </div>

                <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setWorkspaceTab("edit")}
                    className={`rounded-lg px-3 py-1.5 transition ${
                      workspaceTab === "edit"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    ✏️ Edit Studio
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkspaceTab("preview")}
                    className={`rounded-lg px-3 py-1.5 transition ${
                      workspaceTab === "preview"
                        ? "bg-white text-[#0A6847] shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    👁️ Learner Preview
                  </button>
                </div>
              </div>

              {workspaceTab === "edit" ? (
                /* EDIT LESSON CONTENT FORM */
                <form onSubmit={handleSaveLesson} className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <label className="block sm:col-span-2">
                      <span className="label-field">Lesson Title *</span>
                      <input
                        required
                        value={lessonEditForm.title}
                        onChange={(e) => setLessonEditForm({ ...lessonEditForm, title: e.target.value })}
                        disabled={!isDraft}
                        className="input-field mt-1.5"
                      />
                    </label>

                    <label className="block sm:col-span-1">
                      <span className="label-field">Content Type</span>
                      <select
                        value={lessonEditForm.contentType}
                        onChange={(e) => setLessonEditForm({ ...lessonEditForm, contentType: e.target.value })}
                        disabled={!isDraft}
                        className="input-field mt-1.5 font-bold text-slate-800"
                      >
                        <option value="TEXT">📄 Text Lesson</option>
                        <option value="VIDEO">🎥 Video Lesson</option>
                      </select>
                    </label>
                  </div>

                  {lessonEditForm.contentType === "TEXT" ? (
                    <label className="block">
                      <span className="label-field">Lesson Body (Text / Markdown)</span>
                      <textarea
                        required
                        rows={10}
                        value={lessonEditForm.contentBody}
                        onChange={(e) => setLessonEditForm({ ...lessonEditForm, contentBody: e.target.value })}
                        disabled={!isDraft}
                        className="input-field mt-1.5 font-mono text-sm leading-relaxed"
                        placeholder="Write detailed lesson content, code snippets, or notes..."
                      />
                    </label>
                  ) : (
                    <div className="space-y-4">
                      <VideoUrlInput
                        id="studio-lesson-video-url"
                        value={lessonEditForm.videoUrl}
                        onChange={(url) => setLessonEditForm({ ...lessonEditForm, videoUrl: url })}
                        disabled={!isDraft}
                      />

                      {parseVideoUrl(lessonEditForm.videoUrl) && (
                        <div className="rounded-xl border border-slate-200 bg-slate-900 p-3 shadow-md">
                          <span className="text-[11px] font-bold text-slate-300 block mb-2">
                            Live Video Player Preview
                          </span>
                          <VideoPlayer video={parseVideoUrl(lessonEditForm.videoUrl)} title={lessonEditForm.title} />
                        </div>
                      )}

                      <label className="block">
                        <span className="label-field">Video Description / Objectives</span>
                        <textarea
                          rows={3}
                          value={lessonEditForm.description}
                          onChange={(e) => setLessonEditForm({ ...lessonEditForm, description: e.target.value })}
                          disabled={!isDraft}
                          className="input-field mt-1.5"
                          placeholder="Brief summary of key concepts covered in this video..."
                        />
                      </label>
                    </div>
                  )}

                  {isDraft && (
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmModal({
                            isOpen: true,
                            title: `Delete lesson "${activeContent.title}"?`,
                            description: "This lesson content will be permanently removed.",
                            confirmLabel: "Delete Lesson",
                            variant: "danger",
                            onConfirm: () => {
                              deleteContent.mutate(activeContent.id);
                              closeConfirmModal();
                            },
                          });
                        }}
                        className="text-xs font-bold text-red-600 hover:underline"
                      >
                        Delete Lesson
                      </button>

                      <button
                        type="submit"
                        disabled={updateContent.isPending}
                        className="btn-primary"
                      >
                        {updateContent.isPending ? "Saving..." : "Save Lesson Changes"}
                      </button>
                    </div>
                  )}
                </form>
              ) : (
                /* LEARNER PREVIEW WORKSPACE */
                <div className="space-y-4 rounded-2xl bg-slate-50/50 p-6 border border-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <span className="text-xs font-semibold text-slate-500">
                      Learner Experience View &bull; {activeContent.contentType === "VIDEO" ? "Video Lesson" : "Text Lesson"}
                    </span>
                    <span className="badge-brand">● Unlocked</span>
                  </div>

                  {activeContent.contentType === "VIDEO" ? (
                    <div className="space-y-4">
                      {parseVideoUrl(activeContent.videoUrl) ? (
                        <div className="rounded-2xl border border-slate-200 bg-slate-900 p-3 shadow-lg">
                          <VideoPlayer video={parseVideoUrl(activeContent.videoUrl)} title={activeContent.title} />
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                          No video URL configured for this lesson yet.
                        </div>
                      )}
                      {activeContent.description && (
                        <div className="rounded-xl bg-white p-4 border border-slate-200 text-sm text-slate-700 leading-relaxed">
                          <h4 className="font-bold text-slate-900 mb-1">Lesson Notes</h4>
                          {activeContent.description}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl bg-white p-6 border border-slate-200 text-slate-800 leading-relaxed text-sm whitespace-pre-wrap font-sans">
                      {activeContent.contentBody || "No text content written for this lesson yet."}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : activeSelection.type === "quiz" && activeModule ? (
            /* QUIZ STUDIO WORKSPACE */
            <div className="card-flush p-6 space-y-4">
              <div className="border-b border-slate-100 pb-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#0A6847]">
                  Module Assessment &bull; {activeModule.title}
                </span>
                <h2 className="text-xl font-extrabold text-slate-900 mt-0.5">
                  Module Quiz Builder
                </h2>
              </div>
              <ModuleQuizPanel
                courseId={courseId}
                module={activeModule}
                editable={isDraft}
              />
            </div>
          ) : activeSelection.type === "module" && activeModule ? (
            /* MODULE SETTINGS WORKSPACE */
            <div className="card-flush p-6 space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#0A6847]">
                  Module Chapter Settings
                </span>
                <h2 className="text-xl font-extrabold text-slate-900 mt-0.5">
                  {activeModule.title}
                </h2>
              </div>

              <form onSubmit={handleSaveModule} className="space-y-4">
                <label className="block">
                  <span className="label-field">Module Title *</span>
                  <input
                    required
                    value={moduleEditForm.title}
                    onChange={(e) => setModuleEditForm({ ...moduleEditForm, title: e.target.value })}
                    disabled={!isDraft}
                    className="input-field mt-1.5"
                  />
                </label>

                <label className="block">
                  <span className="label-field">Module Description / Objectives</span>
                  <textarea
                    rows={4}
                    value={moduleEditForm.description}
                    onChange={(e) => setModuleEditForm({ ...moduleEditForm, description: e.target.value })}
                    disabled={!isDraft}
                    className="input-field mt-1.5"
                    placeholder="Describe what learners will accomplish in this chapter..."
                  />
                </label>

                {isDraft && (
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmModal({
                          isOpen: true,
                          title: `Delete module "${activeModule.title}"?`,
                          description: "Deleting this module will also remove all lessons and quiz content inside it.",
                          confirmLabel: "Delete Module",
                          variant: "danger",
                          onConfirm: () => {
                            deleteModule.mutate(activeModule.id);
                            closeConfirmModal();
                          },
                        });
                      }}
                      className="text-xs font-bold text-red-600 hover:underline"
                    >
                      Delete Module
                    </button>

                    <button
                      type="submit"
                      disabled={updateModule.isPending}
                      className="btn-primary"
                    >
                      {updateModule.isPending ? "Saving..." : "Save Module Details"}
                    </button>
                  </div>
                )}
              </form>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Quick Actions</h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setAddContentModule({ id: activeModule.id, title: activeModule.title })}
                    disabled={!isDraft}
                    className="btn-primary-sm"
                  >
                    + Add Lesson to Module
                  </button>
                  {!activeQuiz && (
                    <button
                      type="button"
                      onClick={() => handleSelectQuiz(activeModule)}
                      disabled={!isDraft}
                      className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 transition"
                    >
                      + Add Module Quiz
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Right Column: Interactive Curriculum Playlist Sidebar (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="card-flush p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Curriculum Playlist</h3>
                <p className="text-xs text-slate-500">Modules & Lessons</p>
              </div>

              {isAuthor && isDraft && (
                <button
                  type="button"
                  onClick={() => setShowAddModule(true)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-extrabold text-slate-800 hover:border-[#7ABA78] hover:bg-[#F4FAF4] hover:text-[#0A6847] transition shadow-2xs"
                >
                  + Add Module
                </button>
              )}
            </div>

            {/* Search Playlist Filter */}
            <div className="relative">
              <input
                type="text"
                placeholder="Filter playlist contents..."
                value={playlistSearch}
                onChange={(e) => setPlaylistSearch(e.target.value)}
                className="input-field text-xs py-2 pl-3 pr-8"
              />
              {playlistSearch && (
                <button
                  type="button"
                  onClick={() => setPlaylistSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Modules Accordion List */}
            {modules.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500 space-y-2">
                <p>No modules created for this course yet.</p>
                {isAuthor && isDraft && (
                  <button
                    type="button"
                    onClick={() => setShowAddModule(true)}
                    className="btn-primary-sm"
                  >
                    + Add First Module
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {modules.map((module, mIndex) => {
                  const isExpanded = expandedModules[module.id] ?? true;
                  const moduleContents = contentsByModuleId[module.id] || [];
                  const moduleQuiz = quizzesByModuleId[module.id] || null;

                  const filteredContents = moduleContents.filter(
                    (c) => !searchFilter || c.title.toLowerCase().includes(searchFilter)
                  );
                  const isModuleActive =
                    activeSelection?.type === "module" && activeSelection.moduleId === module.id;

                  return (
                    <div
                      key={module.id}
                      className={`rounded-2xl border transition-all ${
                        isModuleActive
                          ? "border-[#0A6847] ring-1 ring-[#0A6847]/30 bg-emerald-50/20 shadow-xs"
                          : "border-slate-200/90 bg-white hover:border-slate-300"
                      }`}
                    >
                      {/* Module Header Bar */}
                      <div className="flex items-center justify-between p-3.5 gap-2">
                        <button
                          type="button"
                          onClick={() => handleSelectModule(module)}
                          className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#E8F5E9] text-xs font-extrabold text-[#0A6847]">
                            {mIndex + 1}
                          </span>
                          <span className="font-extrabold text-sm text-slate-900 truncate">
                            {module.title}
                          </span>
                        </button>

                        <div className="flex items-center gap-1 shrink-0">
                          {isAuthor && isDraft && (
                            <>
                              <button
                                type="button"
                                disabled={mIndex === 0}
                                onClick={() => handleMoveModule(mIndex, -1)}
                                className="rounded p-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-20"
                                title="Move Module Up"
                              >
                                &uarr;
                              </button>
                              <button
                                type="button"
                                disabled={mIndex === modules.length - 1}
                                onClick={() => handleMoveModule(mIndex, 1)}
                                className="rounded p-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-20"
                                title="Move Module Down"
                              >
                                &darr;
                              </button>
                            </>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              setExpandedModules((prev) => ({
                                ...prev,
                                [module.id]: !isExpanded,
                              }))
                            }
                            className="rounded p-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          >
                            {isExpanded ? "▲" : "▼"}
                          </button>
                        </div>
                      </div>

                      {/* Expandable Module Playlist Items */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 p-2 space-y-1 bg-slate-50/40 rounded-b-2xl">
                          {filteredContents.length === 0 && !moduleQuiz ? (
                            <p className="text-[11px] italic text-slate-400 px-3 py-2">
                              No lessons in this module yet.
                            </p>
                          ) : null}

                          {filteredContents.map((item) => {
                            const isContentActive =
                              activeSelection?.type === "content" && activeSelection.contentId === item.id;
                            const isVideo = item.contentType === "VIDEO";

                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => handleSelectContent(module, item)}
                                className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition ${
                                  isContentActive
                                    ? "bg-[#0A6847] text-white font-bold shadow-xs"
                                    : "text-slate-700 hover:bg-slate-100/80"
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <span className={isContentActive ? "text-white" : "text-[#0A6847]"}>
                                    {isVideo ? <PlayIcon /> : <DocumentIcon />}
                                  </span>
                                  <span className="truncate">{item.title}</span>
                                </div>
                                <span
                                  className={`text-[10px] shrink-0 ml-2 ${
                                    isContentActive ? "text-white/80" : "text-slate-400"
                                  }`}
                                >
                                  {estimateMinutes(item)}m
                                </span>
                              </button>
                            );
                          })}

                          {/* Quiz Item (if present) */}
                          {moduleQuiz && (
                            <button
                              type="button"
                              onClick={() => handleSelectQuiz(module)}
                              className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition ${
                                activeSelection?.type === "quiz" && activeSelection.moduleId === module.id
                                  ? "bg-[#0A6847] text-white font-bold shadow-xs"
                                  : "text-slate-700 hover:bg-slate-100/80"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <span className={activeSelection?.type === "quiz" ? "text-white" : "text-amber-600"}>
                                  <QuizIcon />
                                </span>
                                <span className="truncate">Quiz: {moduleQuiz.title}</span>
                              </div>
                              <span
                                className={`text-[10px] font-semibold shrink-0 ml-2 ${
                                  activeSelection?.type === "quiz" ? "text-white/80" : "text-amber-700"
                                }`}
                              >
                                {moduleQuiz.questions?.length ?? moduleQuiz.questionCount ?? 0} Qs
                              </span>
                            </button>
                          )}

                          {/* Module Quick Action Bar */}
                          {isAuthor && isDraft && (
                            <div className="pt-2 flex items-center gap-2 justify-end border-t border-slate-200/50 mt-1">
                              <button
                                type="button"
                                onClick={() => setAddContentModule({ id: module.id, title: module.title })}
                                className="text-[11px] font-bold text-[#0A6847] hover:underline px-2 py-1"
                              >
                                + Add Lesson
                              </button>
                              {!moduleQuiz && (
                                <button
                                  type="button"
                                  onClick={() => handleSelectQuiz(module)}
                                  className="text-[11px] font-bold text-amber-700 hover:underline px-2 py-1"
                                >
                                  + Add Quiz
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Course Settings Modal */}
      {editCourseDetailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Course Metadata & Settings</h3>
              <button
                type="button"
                onClick={() => setEditCourseDetailsModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCourseDetails} className="space-y-4">
              <label className="block">
                <span className="label-field">Course Title *</span>
                <input
                  required
                  value={courseDetailsForm.title}
                  onChange={(e) => setCourseDetailsForm({ ...courseDetailsForm, title: e.target.value })}
                  disabled={!isDraft}
                  className="input-field mt-1.5"
                />
              </label>

              <label className="block">
                <span className="label-field">Category</span>
                <input
                  value={courseDetailsForm.category}
                  onChange={(e) => setCourseDetailsForm({ ...courseDetailsForm, category: e.target.value })}
                  disabled={!isDraft}
                  placeholder="e.g. AI & Machine Learning"
                  className="input-field mt-1.5"
                />
              </label>

              <label className="block">
                <span className="label-field">Description</span>
                <textarea
                  rows={3}
                  value={courseDetailsForm.description}
                  onChange={(e) => setCourseDetailsForm({ ...courseDetailsForm, description: e.target.value })}
                  disabled={!isDraft}
                  className="input-field mt-1.5"
                />
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={courseDetailsForm.allowSelfEnrollment}
                  onChange={(e) => setCourseDetailsForm({ ...courseDetailsForm, allowSelfEnrollment: e.target.checked })}
                  disabled={!isDraft}
                  className="rounded border-slate-300 text-[#0A6847]"
                />
                Allow self-enrollment for learners
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setEditCourseDetailsModal(false)} className="btn-secondary">
                  Cancel
                </button>
                {isDraft && (
                  <button type="submit" disabled={updateCourseDetails.isPending} className="btn-primary">
                    {updateCourseDetails.isPending ? "Saving..." : "Save Settings"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Structured Add Module Modal */}
      <StructuredAddModuleModal
        isOpen={showAddModule}
        onClose={() => setShowAddModule(false)}
        courseId={courseId}
        onSuccess={() => {
          clearError();
          refreshModules();
          setSuccessMsg("Module and contents added successfully!");
          setTimeout(() => setSuccessMsg(""), 3500);
        }}
        reportError={reportError}
        clearError={clearError}
      />

      {/* Add Content / Lesson Modal */}
      {addContentModule && (
        <AddContentModal
          isOpen={Boolean(addContentModule)}
          onClose={() => setAddContentModule(null)}
          moduleTitle={addContentModule.title}
          isPending={addContent.isPending}
          onAdd={(payload) => addContent.mutate({ moduleId: addContentModule.id, payload })}
        />
      )}

      {/* Learner Full Preview Modal */}
      <LearnerPreviewModal
        isOpen={showLearnerPreview}
        onClose={() => setShowLearnerPreview(false)}
        course={course}
        modules={modules}
      />

      {/* Custom Confirm Modal */}
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
