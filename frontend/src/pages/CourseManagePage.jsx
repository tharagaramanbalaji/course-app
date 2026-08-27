import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api, getApiErrorMessage, getApiErrorProblems } from "@/api/client";
import { useAuth } from "@/auth/useAuth";
import ErrorNote from "@/components/ErrorNote";
import LearnerPreviewModal from "@/components/LearnerPreviewModal";
import ModuleQuizPanel from "@/components/ModuleQuizPanel";
import StructuredAddModuleModal from "@/components/StructuredAddModuleModal";
import VideoPlayer from "@/components/VideoPlayer";
import VideoUrlInput from "@/components/VideoUrlInput";
import { parseVideoUrl } from "@/lib/video";

const STATUS_STYLES = {
  DRAFT: "badge-amber",
  PUBLISHED: "badge-brand",
  ARCHIVED: "badge-slate",
};

export default function CourseManagePage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { isAuthor } = useAuth();
  const queryClient = useQueryClient();

  const [error, setError] = useState("");
  const [problems, setProblems] = useState([]);

  // Edit course state
  const [isEditingCourse, setIsEditingCourse] = useState(false);
  const [courseForm, setCourseForm] = useState({
    title: "",
    description: "",
    category: "",
    allowSelfEnrollment: false,
  });

  // Learner Preview state
  const [showLearnerPreview, setShowLearnerPreview] = useState(false);

  // Module creation/edit state
  const [showAddModule, setShowAddModule] = useState(false);
  const [moduleForm, setModuleForm] = useState({ title: "", description: "" });
  const [editingModuleId, setEditingModuleId] = useState(null);
  const [editModuleForm, setEditModuleForm] = useState({ title: "", description: "" });

  // Content creation/edit state per module
  const [addingContentModuleId, setAddingContentModuleId] = useState(null);
  const [contentForm, setContentForm] = useState({
    title: "",
    contentType: "TEXT",
    contentBody: "",
    videoUrl: "",
  });
  const [editingContent, setEditingContent] = useState(null); // { id, moduleId, title, contentBody, videoUrl }

  function reportError(mutationError) {
    setError(getApiErrorMessage(mutationError));
    setProblems(getApiErrorProblems(mutationError));
  }

  function clearError() {
    setError("");
    setProblems([]);
  }

  // Fetch Course details
  const courseQuery = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => (await api.get(`/courses/${courseId}`)).data,
  });

  // Fetch Modules
  const modulesQuery = useQuery({
    queryKey: ["course-modules", courseId],
    queryFn: async () => (await api.get(`/courses/${courseId}/modules`)).data,
  });

  const refreshCourse = () => {
    queryClient.invalidateQueries({ queryKey: ["course", courseId] });
    queryClient.invalidateQueries({ queryKey: ["courses"] });
  };

  const refreshModules = () => {
    queryClient.invalidateQueries({ queryKey: ["course-modules", courseId] });
  };

  // Course Mutations
  const updateCourse = useMutation({
    mutationFn: (payload) => api.patch(`/courses/${courseId}`, payload),
    onSuccess: () => {
      setIsEditingCourse(false);
      clearError();
      refreshCourse();
    },
    onError: reportError,
  });

  const publishCourse = useMutation({
    mutationFn: () => api.post(`/courses/${courseId}/publish`),
    onSuccess: () => {
      clearError();
      refreshCourse();
    },
    onError: reportError,
  });

  const deleteCourse = useMutation({
    mutationFn: () => api.delete(`/courses/${courseId}`),
    onSuccess: () => {
      navigate("/courses");
    },
    onError: reportError,
  });

  // Module Mutations
  const createModule = useMutation({
    mutationFn: (payload) => api.post(`/courses/${courseId}/modules`, payload),
    onSuccess: () => {
      setShowAddModule(false);
      setModuleForm({ title: "", description: "" });
      clearError();
      refreshModules();
    },
    onError: reportError,
  });

  const updateModule = useMutation({
    mutationFn: ({ moduleId, payload }) =>
      api.patch(`/courses/${courseId}/modules/${moduleId}`, payload),
    onSuccess: () => {
      setEditingModuleId(null);
      clearError();
      refreshModules();
    },
    onError: reportError,
  });

  const deleteModule = useMutation({
    mutationFn: (moduleId) => api.delete(`/courses/${courseId}/modules/${moduleId}`),
    onSuccess: () => {
      clearError();
      refreshModules();
    },
    onError: reportError,
  });

  const reorderModules = useMutation({
    mutationFn: (moduleIds) =>
      api.patch(`/courses/${courseId}/modules/reorder`, { moduleIds }),
    onSuccess: () => {
      clearError();
      refreshModules();
    },
    onError: reportError,
  });

  const course = courseQuery.data?.data;
  const modules = modulesQuery.data?.data ?? [];

  function startEditCourse() {
    if (!course) return;
    setCourseForm({
      title: course.title || "",
      description: course.description || "",
      category: course.category || "",
      allowSelfEnrollment: course.allowSelfEnrollment || false,
    });
    setIsEditingCourse(true);
    clearError();
  }

  function handleUpdateCourse(e) {
    e.preventDefault();
    clearError();
    updateCourse.mutate({
      title: courseForm.title,
      description: courseForm.description,
      category: courseForm.category || null,
      allowSelfEnrollment: courseForm.allowSelfEnrollment,
    });
  }

  function handleCreateModule(e) {
    e.preventDefault();
    clearError();
    createModule.mutate({
      title: moduleForm.title,
      description: moduleForm.description || null,
    });
  }

  function handleUpdateModule(e, moduleId) {
    e.preventDefault();
    clearError();
    updateModule.mutate({
      moduleId,
      payload: {
        title: editModuleForm.title,
        description: editModuleForm.description || null,
      },
    });
  }

  function handleMoveModule(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= modules.length) return;
    const reordered = [...modules];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    reorderModules.mutate(reordered.map((m) => m.id));
  }

  if (courseQuery.isPending) {
    return <p className="text-slate-500">Loading course details...</p>;
  }

  if (courseQuery.isError || !course) {
    return (
      <div className="space-y-4">
        <ErrorNote message={getApiErrorMessage(courseQuery.error) || "Course not found"} />
        <Link to="/courses" className="text-sm font-medium text-slate-700 hover:underline">
          &larr; Back to Courses
        </Link>
      </div>
    );
  }

  const isDraft = course.status === "DRAFT";

  return (
    <div className="space-y-8 pb-12">
      {/* Header breadcrumb & top nav */}
      <div className="flex items-center justify-between">
        <Link
          to="/courses"
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          &larr; Back to Courses
        </Link>
        <span className={`${STATUS_STYLES[course.status]} uppercase tracking-wide`}>
          {course.status}
        </span>
      </div>

      <ErrorNote message={error} problems={problems} />

      {/* Course Detail / Editor Header */}
      <div className="card">
        {isEditingCourse ? (
          <form onSubmit={handleUpdateCourse} className="space-y-4">
            <h3 className="text-lg font-medium">Edit Course Details</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Title</span>
                <input
                  required
                  value={courseForm.title}
                  onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                  className="input-field mt-1"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Category</span>
                <input
                  value={courseForm.category}
                  onChange={(e) => setCourseForm({ ...courseForm, category: e.target.value })}
                  className="input-field mt-1"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Description</span>
              <textarea
                required
                rows={3}
                value={courseForm.description}
                onChange={(e) =>
                  setCourseForm({ ...courseForm, description: e.target.value })
                }
                className="input-field mt-1"
              />
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={courseForm.allowSelfEnrollment}
                onChange={(e) =>
                  setCourseForm({ ...courseForm, allowSelfEnrollment: e.target.checked })
                }
                className="rounded border-slate-300"
              />
              Allow self-enrollment by learners
            </label>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={updateCourse.isPending}
                className="btn-primary"
              >
                {updateCourse.isPending ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={() => setIsEditingCourse(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{course.title}</h1>
                <p className="mt-1 text-slate-600">{course.description}</p>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  <span>Category: <strong>{course.category || "Uncategorised"}</strong></span>
                  <span>
                    Self Enrollment: <strong>{course.allowSelfEnrollment ? "Allowed" : "Admin Only"}</strong>
                  </span>
                  {course.publishedAt && (
                    <span>
                      Published: <strong>{new Date(course.publishedAt).toLocaleDateString()}</strong>
                    </span>
                  )}
                </div>
              </div>

              {isAuthor && isDraft && (
                <div className="flex flex-wrap gap-2">
                  {/* Learner Preview Action */}
                  <button
                    type="button"
                    onClick={() => setShowLearnerPreview(true)}
                    className="flex items-center gap-1.5 rounded-xl bg-[#7ABA78] px-3.5 py-1.5 text-sm font-semibold text-[#063F2A] transition hover:bg-[#5C9E5A] hover:text-white"
                  >
                    👁️ Learner Preview
                  </button>

                  <button
                    type="button"
                    onClick={startEditCourse}
                    className="btn-secondary"
                  >
                    Edit Details
                  </button>
                  <button
                    type="button"
                    onClick={() => publishCourse.mutate()}
                    disabled={publishCourse.isPending}
                    className="btn-primary"
                  >
                    {publishCourse.isPending ? "Validating & Publishing..." : "Publish Course"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this draft course?")) {
                        deleteCourse.mutate();
                      }
                    }}
                    disabled={deleteCourse.isPending}
                    className="btn-danger"
                  >
                    Delete Course
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Learner Preview Modal */}
      <LearnerPreviewModal
        isOpen={showLearnerPreview}
        onClose={() => setShowLearnerPreview(false)}
        course={course}
        modules={modules}
      />

      {/* Modules & Content Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Course Modules & Lessons</h2>
            <p className="text-sm text-slate-600">
              Modules are sequential chapters. Each module can contain text & video training content.
            </p>
          </div>

          {isAuthor && isDraft && (
            <button
              type="button"
              onClick={() => {
                setShowAddModule(true);
                clearError();
              }}
              className="btn-primary"
            >
              + Add Module (Structured)
            </button>
          )}
        </div>

        {/* Structured Add Module Modal */}
        <StructuredAddModuleModal
          isOpen={showAddModule}
          onClose={() => setShowAddModule(false)}
          courseId={courseId}
          onSuccess={() => {
            clearError();
            refreshModules();
          }}
          reportError={reportError}
          clearError={clearError}
        />

        {/* Module List */}
        {modulesQuery.isPending && (
          <p className="text-slate-500">Loading modules...</p>
        )}

        {modulesQuery.isSuccess && modules.length === 0 && !showAddModule && (
          <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
            No modules added to this course yet.
            {isAuthor && isDraft && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModule(true)}
                  className="text-sm font-medium text-slate-900 underline hover:text-slate-700"
                >
                  Create the first module
                </button>
              </div>
            )}
          </div>
        )}

        <div className="space-y-4">
          {modules.map((mod, index) => (
            <ModuleCard
              key={mod.id}
              courseId={courseId}
              module={mod}
              index={index}
              totalModules={modules.length}
              isAuthor={isAuthor}
              isDraft={isDraft}
              editingModuleId={editingModuleId}
              setEditingModuleId={setEditingModuleId}
              editModuleForm={editModuleForm}
              setEditModuleForm={setEditModuleForm}
              handleUpdateModule={handleUpdateModule}
              deleteModule={deleteModule}
              handleMoveModule={handleMoveModule}
              reportError={reportError}
              clearError={clearError}
              addingContentModuleId={addingContentModuleId}
              setAddingContentModuleId={setAddingContentModuleId}
              contentForm={contentForm}
              setContentForm={setContentForm}
              editingContent={editingContent}
              setEditingContent={setEditingContent}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ModuleCard({
  courseId,
  module,
  index,
  totalModules,
  isAuthor,
  isDraft,
  editingModuleId,
  setEditingModuleId,
  editModuleForm,
  setEditModuleForm,
  handleUpdateModule,
  deleteModule,
  handleMoveModule,
  reportError,
  clearError,
  addingContentModuleId,
  setAddingContentModuleId,
  contentForm,
  setContentForm,
  editingContent,
  setEditingContent,
}) {
  const queryClient = useQueryClient();

  // Fetch content list for this module
  const contentsQuery = useQuery({
    queryKey: ["module-contents", courseId, module.id],
    queryFn: async () =>
      (await api.get(`/courses/${courseId}/modules/${module.id}/contents`)).data,
  });

  const refreshContents = () => {
    queryClient.invalidateQueries({
      queryKey: ["module-contents", courseId, module.id],
    });
  };

  const createContent = useMutation({
    mutationFn: (payload) =>
      api.post(`/courses/${courseId}/modules/${module.id}/contents`, payload),
    onSuccess: () => {
      setAddingContentModuleId(null);
      setContentForm({ title: "", contentType: "TEXT", contentBody: "", videoUrl: "" });
      clearError();
      refreshContents();
    },
    onError: reportError,
  });

  const updateContent = useMutation({
    mutationFn: ({ contentId, payload }) =>
      api.patch(`/courses/${courseId}/modules/${module.id}/contents/${contentId}`, payload),
    onSuccess: () => {
      setEditingContent(null);
      clearError();
      refreshContents();
    },
    onError: reportError,
  });

  const deleteContent = useMutation({
    mutationFn: (contentId) =>
      api.delete(`/courses/${courseId}/modules/${module.id}/contents/${contentId}`),
    onSuccess: () => {
      clearError();
      refreshContents();
    },
    onError: reportError,
  });

  const reorderContents = useMutation({
    mutationFn: (contentIds) =>
      api.patch(`/courses/${courseId}/modules/${module.id}/contents/reorder`, {
        contentIds,
      }),
    onSuccess: () => {
      clearError();
      refreshContents();
    },
    onError: reportError,
  });

  const contents = contentsQuery.data?.data ?? [];

  function handleCreateContentSubmit(e) {
    e.preventDefault();
    clearError();
    const payload = {
      title: contentForm.title,
      contentType: contentForm.contentType,
      contentBody: contentForm.contentType === "TEXT" ? contentForm.contentBody : null,
      videoUrl: contentForm.contentType === "VIDEO" ? contentForm.videoUrl : null,
    };
    createContent.mutate(payload);
  }

  function handleUpdateContentSubmit(e) {
    e.preventDefault();
    if (!editingContent) return;
    clearError();
    const payload = {
      title: editingContent.title,
      contentBody: editingContent.contentType === "TEXT" ? editingContent.contentBody : null,
      videoUrl: editingContent.contentType === "VIDEO" ? editingContent.videoUrl : null,
    };
    updateContent.mutate({ contentId: editingContent.id, payload });
  }

  function handleMoveContent(cIndex, direction) {
    const targetIndex = cIndex + direction;
    if (targetIndex < 0 || targetIndex >= contents.length) return;
    const reordered = [...contents];
    const [moved] = reordered.splice(cIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    reorderContents.mutate(reordered.map((c) => c.id));
  }

  const isEditingThisModule = editingModuleId === module.id;

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Module Header */}
      <div className="border-b border-slate-100 bg-slate-50 p-4">
        {isEditingThisModule ? (
          <form onSubmit={(e) => handleUpdateModule(e, module.id)} className="space-y-3">
            <input
              required
              value={editModuleForm.title}
              onChange={(e) =>
                setEditModuleForm({ ...editModuleForm, title: e.target.value })
              }
              className="input-field"
            />
            <input
              placeholder="Description"
              value={editModuleForm.description}
              onChange={(e) =>
                setEditModuleForm({ ...editModuleForm, description: e.target.value })
              }
              className="input-field"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="btn-primary-sm"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingModuleId(null)}
                className="btn-secondary-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
                {module.displayOrder}
              </span>
              <div>
                <h3 className="font-semibold text-slate-900">{module.title}</h3>
                {module.description && (
                  <p className="text-xs text-slate-600">{module.description}</p>
                )}
              </div>
            </div>

            {isAuthor && isDraft && (
              <div className="flex items-center gap-1">
                {/* Reorder Buttons */}
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => handleMoveModule(index, -1)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 transition hover:border-[#7ABA78] hover:bg-[#F4FAF4] disabled:opacity-30"
                  title="Move Module Up"
                >
                  &uarr;
                </button>
                <button
                  type="button"
                  disabled={index === totalModules - 1}
                  onClick={() => handleMoveModule(index, 1)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 transition hover:border-[#7ABA78] hover:bg-[#F4FAF4] disabled:opacity-30"
                  title="Move Module Down"
                >
                  &darr;
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingModuleId(module.id);
                    setEditModuleForm({
                      title: module.title,
                      description: module.description || "",
                    });
                    clearError();
                  }}
                  className="ml-2 btn-secondary-sm"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Delete module "${module.title}"?`)) {
                      deleteModule.mutate(module.id);
                    }
                  }}
                  className="btn-danger-sm"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Module Content Items */}
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Training Content ({contents.length})
          </h4>

          {isAuthor && isDraft && addingContentModuleId !== module.id && (
            <button
              type="button"
              onClick={() => {
                setAddingContentModuleId(module.id);
                setContentForm({
                  title: "",
                  contentType: "TEXT",
                  contentBody: "",
                  videoUrl: "",
                });
                clearError();
              }}
              className="text-xs font-medium text-slate-900 hover:underline"
            >
              + Add Content
            </button>
          )}
        </div>

        {/* Add Content Form */}
        {addingContentModuleId === module.id && (
          <form
            onSubmit={handleCreateContentSubmit}
            className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4"
          >
            <h5 className="text-sm font-medium text-slate-800">Add Lesson / Content</h5>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Content Title</span>
                <input
                  required
                  placeholder="e.g. Introduction to Variables"
                  value={contentForm.title}
                  onChange={(e) => setContentForm({ ...contentForm, title: e.target.value })}
                  className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm bg-white"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-slate-700">Content Type</span>
                <select
                  value={contentForm.contentType}
                  onChange={(e) =>
                    setContentForm({ ...contentForm, contentType: e.target.value })
                  }
                  className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm bg-white"
                >
                  <option value="TEXT">Text Lesson</option>
                  <option value="VIDEO">Video Lesson</option>
                </select>
              </label>
            </div>

            {contentForm.contentType === "TEXT" ? (
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Lesson Body (Text / Markdown)</span>
                <textarea
                  required
                  rows={4}
                  placeholder="Write lesson text or instructions here..."
                  value={contentForm.contentBody}
                  onChange={(e) =>
                    setContentForm({ ...contentForm, contentBody: e.target.value })
                  }
                  className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm bg-white"
                />
              </label>
            ) : (
              <VideoUrlInput
                id={`new-content-video-${module.id}`}
                value={contentForm.videoUrl}
                onChange={(videoUrl) => setContentForm({ ...contentForm, videoUrl })}
              />
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={createContent.isPending}
                className="btn-primary-sm"
              >
                {createContent.isPending ? "Adding..." : "Save Content"}
              </button>
              <button
                type="button"
                onClick={() => setAddingContentModuleId(null)}
                className="btn-secondary-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Content List */}
        {contentsQuery.isPending && (
          <p className="text-xs text-slate-400">Loading lessons...</p>
        )}

        {contentsQuery.isSuccess && contents.length === 0 && (
          <p className="text-xs text-slate-500 italic">No content items added to this module yet.</p>
        )}

        <ul className="space-y-2">
          {contents.map((item, cIndex) => {
            const isEditingThisContent = editingContent?.id === item.id;

            return (
              <li
                key={item.id}
                className="rounded-xl border border-slate-200 bg-white p-4 text-sm"
              >
                {isEditingThisContent ? (
                  <form onSubmit={handleUpdateContentSubmit} className="space-y-3">
                    <input
                      required
                      value={editingContent.title}
                      onChange={(e) =>
                        setEditingContent({ ...editingContent, title: e.target.value })
                      }
                      className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                    />

                    {editingContent.contentType === "TEXT" ? (
                      <textarea
                        required
                        rows={3}
                        value={editingContent.contentBody || ""}
                        onChange={(e) =>
                          setEditingContent({ ...editingContent, contentBody: e.target.value })
                        }
                        className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm"
                      />
                    ) : (
                      <VideoUrlInput
                        id={`edit-content-video-${editingContent.id}`}
                        value={editingContent.videoUrl || ""}
                        onChange={(videoUrl) =>
                          setEditingContent({ ...editingContent, videoUrl })
                        }
                      />
                    )}

                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={updateContent.isPending}
                        className="btn-primary-sm"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingContent(null)}
                        className="rounded border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                            item.contentType === "VIDEO"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-purple-100 text-purple-700"
                          }`}
                        >
                          {item.contentType}
                        </span>
                        <h5 className="font-medium text-slate-900">
                          {item.displayOrder}. {item.title}
                        </h5>
                      </div>

                      {item.contentType === "TEXT" ? (
                        <p className="text-xs text-slate-600 whitespace-pre-wrap pl-2 border-l-2 border-slate-200">
                          {item.contentBody}
                        </p>
                      ) : (
                        <VideoLessonPreview item={item} />
                      )}
                    </div>

                    {isAuthor && isDraft && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={cIndex === 0}
                          onClick={() => handleMoveContent(cIndex, -1)}
                          className="rounded-lg border border-slate-200 px-1.5 py-0.5 text-xs transition hover:border-[#7ABA78] hover:bg-[#F4FAF4] disabled:opacity-30"
                          title="Move Lesson Up"
                        >
                          &uarr;
                        </button>
                        <button
                          type="button"
                          disabled={cIndex === contents.length - 1}
                          onClick={() => handleMoveContent(cIndex, 1)}
                          className="rounded-lg border border-slate-200 px-1.5 py-0.5 text-xs transition hover:border-[#7ABA78] hover:bg-[#F4FAF4] disabled:opacity-30"
                          title="Move Lesson Down"
                        >
                          &darr;
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingContent({
                              id: item.id,
                              moduleId: module.id,
                              title: item.title,
                              contentType: item.contentType,
                              contentBody: item.contentBody || "",
                              videoUrl: item.videoUrl || "",
                            });
                            clearError();
                          }}
                          className="ml-1 rounded-lg border border-slate-200 px-2 py-0.5 text-xs text-slate-700 transition hover:border-[#7ABA78] hover:bg-[#F4FAF4]"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Delete content "${item.title}"?`)) {
                              deleteContent.mutate(item.id);
                            }
                          }}
                          className="rounded-lg border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <div className="mt-4">
          <ModuleQuizPanel courseId={courseId} module={module} editable={isDraft} />
        </div>
      </div>
    </div>
  );
}

function VideoLessonPreview({ item }) {
  const [showPreview, setShowPreview] = useState(false);
  const videoObj = item.video || parseVideoUrl(item.videoUrl);

  return (
    <div className="space-y-2 pl-2 border-l-2 border-slate-200">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-slate-600">
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

        {videoObj && (
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="inline-flex items-center gap-1 rounded bg-slate-100 border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-200 transition"
          >
            ▶ {showPreview ? "Hide Preview" : "Mini Preview"}
          </button>
        )}
      </div>

      {showPreview && videoObj && (
        <div className="mt-2 max-w-lg rounded-lg border border-slate-200 bg-slate-900 p-2.5 shadow-md">
          <div className="flex items-center justify-between pb-2 px-1">
            <span className="text-[11px] font-semibold text-slate-300">
              Mini Video Preview ({videoObj.provider})
            </span>
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              className="text-[11px] font-bold text-slate-400 hover:text-white"
            >
              ✕ Close
            </button>
          </div>
          <VideoPlayer video={videoObj} title={item.title} />
        </div>
      )}
    </div>
  );
}
