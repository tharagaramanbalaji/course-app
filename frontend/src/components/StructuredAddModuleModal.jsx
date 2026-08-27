import { useEffect, useRef, useState } from "react";
import { api } from "@/api/client";
import VideoUrlInput from "@/components/VideoUrlInput";

const PRESET_TEMPLATES = [
  {
    name: "Video & Notes + Quiz",
    description: "Introductory video, key notes, and a 2-question quiz.",
    title: "Module: Core Concepts",
    moduleDescription: "Master key concepts through video, reading, and self-assessment.",
    lessons: [
      {
        title: "Video Overview & Explanation",
        contentType: "VIDEO",
        contentBody: "",
        videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      },
      {
        title: "Lecture Notes & Key Takeaways",
        contentType: "TEXT",
        contentBody: "Here are the key concepts and reference material covered in this lesson.",
        videoUrl: "",
      },
    ],
    quiz: {
      title: "Core Concepts Quiz",
      passingScore: 70,
      maxAttempts: 3,
      randomizeQuestions: false,
      questions: [
        {
          questionText: "Which HTTP status code represents success?",
          points: 10,
          answers: [
            { answerText: "200 OK", isCorrect: true },
            { answerText: "404 Not Found", isCorrect: false },
            { answerText: "500 Server Error", isCorrect: false },
          ],
        },
        {
          questionText: "True or False: HTTP is a stateless protocol.",
          points: 10,
          answers: [
            { answerText: "True", isCorrect: true },
            { answerText: "False", isCorrect: false },
          ],
        },
      ],
    },
  },
  {
    name: "Standard Lecture",
    description: "Written concept overview, video demonstration, and review.",
    title: "Module: Fundamentals",
    moduleDescription: "Foundational knowledge and hands-on demonstrations.",
    lessons: [
      {
        title: "1. Introduction & Objectives",
        contentType: "TEXT",
        contentBody: "Welcome to this module. In this section, we will explore fundamental principles.",
        videoUrl: "",
      },
      {
        title: "2. Deep Dive Video Lesson",
        contentType: "VIDEO",
        contentBody: "",
        videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      },
      {
        title: "3. Summary & Best Practices",
        contentType: "TEXT",
        contentBody: "Review of key principles and reference guidelines for practical applications.",
        videoUrl: "",
      },
    ],
    quiz: null,
  },
];

export default function StructuredAddModuleModal({
  isOpen,
  onClose,
  courseId,
  onSuccess,
  reportError,
  clearError,
}) {
  const [activeTab, setActiveTab] = useState("form"); // "form" | "json"
  const [moduleForm, setModuleForm] = useState({
    title: "",
    description: "",
  });
  const [initialLessons, setInitialLessons] = useState([]);
  
  // Quiz state
  const [hasQuiz, setHasQuiz] = useState(false);
  const [quizForm, setQuizForm] = useState({
    title: "Module Quiz",
    passingScore: 70,
    maxAttempts: 3,
    randomizeQuestions: false,
  });
  const [quizQuestions, setQuizQuestions] = useState([]);

  // JSON Mode state & File Upload ref
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [fileUploadName, setFileUploadName] = useState("");
  const fileInputRef = useRef(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");

  // Sync to JSON when switching to JSON tab
  useEffect(() => {
    if (activeTab === "json") {
      const data = {
        title: moduleForm.title || "Sample Module Title",
        description: moduleForm.description || "",
        lessons: initialLessons.map((l) => ({
          title: l.title,
          contentType: l.contentType,
          ...(l.contentType === "TEXT"
            ? { contentBody: l.contentBody }
            : { videoUrl: l.videoUrl }),
        })),
        ...(hasQuiz
          ? {
              quiz: {
                title: quizForm.title,
                passingScore: Number(quizForm.passingScore),
                maxAttempts: Number(quizForm.maxAttempts),
                randomizeQuestions: quizForm.randomizeQuestions,
                questions: quizQuestions.map((q) => ({
                  questionText: q.questionText,
                  points: Number(q.points),
                  answers: q.answers.map((a) => ({
                    answerText: a.answerText,
                    isCorrect: Boolean(a.isCorrect),
                  })),
                })),
              },
            }
          : {}),
      };
      setJsonText(JSON.stringify(data, null, 2));
      setJsonError("");
    }
  }, [activeTab]);

  if (!isOpen) return null;

  // --- Lessons Handlers ---
  function handleAddLesson() {
    setInitialLessons([
      ...initialLessons,
      {
        id: `temp-${Date.now()}-${Math.random()}`,
        title: "",
        contentType: "TEXT",
        contentBody: "",
        videoUrl: "",
      },
    ]);
  }

  function handleRemoveLesson(index) {
    setInitialLessons(initialLessons.filter((_, i) => i !== index));
  }

  function handleMoveLesson(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= initialLessons.length) return;
    const reordered = [...initialLessons];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    setInitialLessons(reordered);
  }

  function handleUpdateLesson(index, field, value) {
    const updated = [...initialLessons];
    updated[index] = { ...updated[index], [field]: value };
    setInitialLessons(updated);
  }

  // --- Quiz Handlers ---
  function handleAddQuestion() {
    setQuizQuestions([
      ...quizQuestions,
      {
        id: `q-${Date.now()}-${Math.random()}`,
        questionText: "",
        points: 10,
        answers: [
          { id: `a1-${Date.now()}`, answerText: "", isCorrect: true },
          { id: `a2-${Date.now()}`, answerText: "", isCorrect: false },
        ],
      },
    ]);
  }

  function handleRemoveQuestion(qIndex) {
    setQuizQuestions(quizQuestions.filter((_, i) => i !== qIndex));
  }

  function handleUpdateQuestion(qIndex, field, value) {
    const updated = [...quizQuestions];
    updated[qIndex] = { ...updated[qIndex], [field]: value };
    setQuizQuestions(updated);
  }

  function handleAddAnswer(qIndex) {
    const updated = [...quizQuestions];
    updated[qIndex].answers.push({
      id: `a-${Date.now()}-${Math.random()}`,
      answerText: "",
      isCorrect: false,
    });
    setQuizQuestions(updated);
  }

  function handleRemoveAnswer(qIndex, aIndex) {
    const updated = [...quizQuestions];
    updated[qIndex].answers = updated[qIndex].answers.filter((_, i) => i !== aIndex);
    setQuizQuestions(updated);
  }

  function handleUpdateAnswer(qIndex, aIndex, field, value) {
    const updated = [...quizQuestions];
    updated[qIndex].answers[aIndex] = {
      ...updated[qIndex].answers[aIndex],
      [field]: value,
    };
    setQuizQuestions(updated);
  }

  // --- Presets Handler ---
  function applyPreset(preset) {
    setModuleForm({
      title: preset.title,
      description: preset.moduleDescription,
    });
    setInitialLessons(
      preset.lessons.map((l, i) => ({
        id: `preset-${i}-${Date.now()}`,
        ...l,
      }))
    );
    if (preset.quiz) {
      setHasQuiz(true);
      setQuizForm({
        title: preset.quiz.title,
        passingScore: preset.quiz.passingScore,
        maxAttempts: preset.quiz.maxAttempts,
        randomizeQuestions: preset.quiz.randomizeQuestions,
      });
      setQuizQuestions(
        preset.quiz.questions.map((q, qI) => ({
          id: `preset-q-${qI}-${Date.now()}`,
          questionText: q.questionText,
          points: q.points,
          answers: q.answers.map((a, aI) => ({
            id: `preset-a-${qI}-${aI}-${Date.now()}`,
            answerText: a.answerText,
            isCorrect: a.isCorrect,
          })),
        }))
      );
    } else {
      setHasQuiz(false);
      setQuizQuestions([]);
    }
  }

  // --- JSON File Upload Handler ---
  function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileUploadName(file.name);
    setJsonError("");

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === "string") {
        setJsonText(content);
        try {
          JSON.parse(content);
        } catch (err) {
          setJsonError(`File "${file.name}" contains invalid JSON.`);
        }
      }
    };
    reader.onerror = () => {
      setJsonError("Failed to read file.");
    };
    reader.readAsText(file);
  }

  function handleApplyJson() {
    setJsonError("");
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed.title || typeof parsed.title !== "string") {
        throw new Error("JSON must contain a 'title' string property.");
      }
      setModuleForm({
        title: parsed.title,
        description: parsed.description || "",
      });

      if (Array.isArray(parsed.lessons)) {
        const parsedLessons = parsed.lessons.map((l, i) => ({
          id: `json-parsed-${i}-${Date.now()}`,
          title: l.title || `Lesson ${i + 1}`,
          contentType: l.contentType === "VIDEO" ? "VIDEO" : "TEXT",
          contentBody: l.contentBody || "",
          videoUrl: l.videoUrl || "",
        }));
        setInitialLessons(parsedLessons);
      }

      if (parsed.quiz && typeof parsed.quiz === "object") {
        setHasQuiz(true);
        setQuizForm({
          title: parsed.quiz.title || "Module Quiz",
          passingScore: parsed.quiz.passingScore ?? 70,
          maxAttempts: parsed.quiz.maxAttempts ?? 3,
          randomizeQuestions: Boolean(parsed.quiz.randomizeQuestions),
        });
        if (Array.isArray(parsed.quiz.questions)) {
          const parsedQs = parsed.quiz.questions.map((q, qI) => ({
            id: `json-q-${qI}-${Date.now()}`,
            questionText: q.questionText || "",
            points: q.points ?? 10,
            answers: Array.isArray(q.answers)
              ? q.answers.map((a, aI) => ({
                  id: `json-a-${qI}-${aI}-${Date.now()}`,
                  answerText: a.answerText || "",
                  isCorrect: Boolean(a.isCorrect),
                }))
              : [],
          }));
          setQuizQuestions(parsedQs);
        }
      } else {
        setHasQuiz(false);
      }

      setActiveTab("form");
    } catch (err) {
      setJsonError(err.message || "Invalid JSON syntax.");
    }
  }

  // --- Sequential Submission Handler ---
  async function handleSubmit(e) {
    e.preventDefault();
    if (!moduleForm.title.trim()) return;

    if (clearError) clearError();
    setIsSubmitting(true);
    setProgressMsg("Creating module...");

    try {
      // 1. Create Module
      const moduleRes = await api.post(`/courses/${courseId}/modules`, {
        title: moduleForm.title.trim(),
        description: moduleForm.description.trim() || null,
      });

      const createdModule = moduleRes.data?.data;
      if (!createdModule || !createdModule.id) {
        throw new Error("Failed to obtain created module response.");
      }

      // 2. Create Initial Lessons sequentially
      const validLessons = initialLessons.filter((l) => l.title.trim());
      for (let i = 0; i < validLessons.length; i++) {
        const l = validLessons[i];
        setProgressMsg(`Adding initial lesson ${i + 1} of ${validLessons.length}...`);
        await api.post(`/courses/${courseId}/modules/${createdModule.id}/contents`, {
          title: l.title.trim(),
          contentType: l.contentType,
          contentBody: l.contentType === "TEXT" ? l.contentBody : null,
          videoUrl: l.contentType === "VIDEO" ? l.videoUrl : null,
        });
      }

      // 3. Create Quiz & Questions if enabled
      if (hasQuiz && quizForm.title.trim()) {
        setProgressMsg("Creating module quiz...");
        const quizRes = await api.post(`/courses/${courseId}/modules/${createdModule.id}/quiz`, {
          title: quizForm.title.trim(),
          passingScore: Number(quizForm.passingScore) || 70,
          maxAttempts: Number(quizForm.maxAttempts) || 3,
          randomizeQuestions: quizForm.randomizeQuestions,
        });

        const createdQuiz = quizRes.data?.data;
        if (createdQuiz && createdQuiz.id) {
          const validQuestions = quizQuestions.filter((q) => q.questionText.trim());
          for (let qI = 0; qI < validQuestions.length; qI++) {
            const q = validQuestions[qI];
            setProgressMsg(`Adding question ${qI + 1} of ${validQuestions.length}...`);
            const qRes = await api.post(`/quizzes/${createdQuiz.id}/questions`, {
              questionText: q.questionText.trim(),
              points: Number(q.points) || 10,
            });

            const createdQuestion = qRes.data?.data;
            if (createdQuestion && createdQuestion.id) {
              const validAnswers = q.answers.filter((a) => a.answerText.trim());
              for (let aI = 0; aI < validAnswers.length; aI++) {
                const a = validAnswers[aI];
                await api.post(`/questions/${createdQuestion.id}/answers`, {
                  answerText: a.answerText.trim(),
                  isCorrect: Boolean(a.isCorrect),
                });
              }
            }
          }
        }
      }

      setIsSubmitting(false);
      setProgressMsg("");
      // Reset state
      setModuleForm({ title: "", description: "" });
      setInitialLessons([]);
      setHasQuiz(false);
      setQuizQuestions([]);
      onSuccess();
      onClose();
    } catch (err) {
      setIsSubmitting(false);
      setProgressMsg("");
      if (reportError) reportError(err);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-2xl transition-all my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Add Module (Structured Builder)</h2>
            <p className="text-xs text-slate-500">
              Provide structured module details, lessons, quizzes, and file JSON upload.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            &times;
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-4 flex items-center justify-between border-b border-slate-200 text-sm font-medium">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setActiveTab("form")}
              className={`pb-2 border-b-2 transition-colors ${
                activeTab === "form"
                  ? "border-slate-900 text-slate-900 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Visual Builder
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("json")}
              className={`pb-2 border-b-2 transition-colors ${
                activeTab === "json"
                  ? "border-slate-900 text-slate-900 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              JSON Outline & File Upload Mode
            </button>
          </div>

          {activeTab === "form" && (
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>Lessons: <strong>{initialLessons.length}</strong></span>
              {hasQuiz && (
                <span>
                  Quiz Qs: <strong>{quizQuestions.length}</strong>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Modal Content Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          {activeTab === "form" ? (
            <form id="structured-module-form" onSubmit={handleSubmit} className="space-y-6">
              {/* Presets Bar */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Quick Presets
                </span>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PRESET_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.name}
                      type="button"
                      onClick={() => applyPreset(tmpl)}
                      className="text-left p-2.5 rounded border border-slate-200 bg-white hover:border-slate-400 hover:shadow-xs transition"
                    >
                      <div className="text-xs font-semibold text-slate-800">{tmpl.name}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                        {tmpl.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Module Metadata Form */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  1. Module Details
                </h3>
                <div className="grid gap-3">
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Module Title *</span>
                    <input
                      required
                      placeholder="e.g. Module 1: Core Principles"
                      value={moduleForm.title}
                      onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                      className="input-field mt-1"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">
                      Module Description / Objectives (Optional)
                    </span>
                    <textarea
                      rows={2}
                      placeholder="Summary of what learners will master in this module..."
                      value={moduleForm.description}
                      onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
                      className="input-field mt-1"
                    />
                  </label>
                </div>
              </div>

              {/* Initial Content / Lessons Builder */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                      2. Initial Lessons (Optional)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Add structured text or video lessons to populate this module immediately.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddLesson}
                    className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-800 transition hover:border-[#7ABA78] hover:bg-[#F4FAF4] hover:text-[#0A6847]"
                  >
                    + Add Lesson
                  </button>
                </div>

                {initialLessons.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">
                    No initial lessons added yet. Click <strong>+ Add Lesson</strong> above or choose a Quick Preset to get started.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {initialLessons.map((lesson, index) => (
                      <div
                        key={lesson.id}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3 relative"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-300 text-[10px] font-bold text-slate-700">
                              {index + 1}
                            </span>
                            <span className="text-xs font-semibold text-slate-700">
                              Lesson Item #{index + 1}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => handleMoveLesson(index, -1)}
                              className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                              title="Move Up"
                            >
                              &uarr;
                            </button>
                            <button
                              type="button"
                              disabled={index === initialLessons.length - 1}
                              onClick={() => handleMoveLesson(index, 1)}
                              className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                              title="Move Down"
                            >
                              &darr;
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveLesson(index)}
                              className="ml-2 rounded border border-red-200 bg-white px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
                            >
                              Remove
                            </button>
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block">
                            <span className="text-xs font-medium text-slate-700">Lesson Title *</span>
                            <input
                              required
                              placeholder="e.g. Overview & Objectives"
                              value={lesson.title}
                              onChange={(e) =>
                                handleUpdateLesson(index, "title", e.target.value)
                              }
                              className="input-field mt-1"
                            />
                          </label>

                          <label className="block">
                            <span className="text-xs font-medium text-slate-700">Content Type</span>
                            <select
                              value={lesson.contentType}
                              onChange={(e) =>
                                handleUpdateLesson(index, "contentType", e.target.value)
                              }
                              className="input-field mt-1"
                            >
                              <option value="TEXT">Text Lesson</option>
                              <option value="VIDEO">Video Lesson</option>
                            </select>
                          </label>
                        </div>

                        {lesson.contentType === "TEXT" ? (
                          <label className="block">
                            <span className="text-xs font-medium text-slate-700">
                              Lesson Text Content
                            </span>
                            <textarea
                              rows={3}
                              placeholder="Enter lesson text or markdown content..."
                              value={lesson.contentBody}
                              onChange={(e) =>
                                handleUpdateLesson(index, "contentBody", e.target.value)
                              }
                              className="input-field mt-1"
                            />
                          </label>
                        ) : (
                          <VideoUrlInput
                            id={`structured-video-${lesson.id}`}
                            value={lesson.videoUrl}
                            onChange={(url) => handleUpdateLesson(index, "videoUrl", url)}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Module Quiz Builder Section */}
              <div className="space-y-4 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                      3. Module Quiz (Optional)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Configure a quiz with assessment questions for this module.
                    </p>
                  </div>

                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-800 transition hover:border-[#7ABA78] hover:bg-[#F4FAF4] hover:text-[#0A6847]">
                    <input
                      type="checkbox"
                      checked={hasQuiz}
                      onChange={(e) => setHasQuiz(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    Include Quiz in Module
                  </label>
                </div>

                {hasQuiz && (
                  <div className="rounded-lg border border-slate-300 bg-slate-50 p-4 space-y-4">
                    {/* Quiz Settings */}
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className="block sm:col-span-1">
                        <span className="text-xs font-medium text-slate-700">Quiz Title *</span>
                        <input
                          required
                          value={quizForm.title}
                          onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })}
                          className="input-field mt-1"
                        />
                      </label>

                      <label className="block">
                        <span className="text-xs font-medium text-slate-700">Passing Score (%)</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={quizForm.passingScore}
                          onChange={(e) =>
                            setQuizForm({ ...quizForm, passingScore: e.target.value })
                          }
                          className="input-field mt-1"
                        />
                      </label>

                      <label className="block">
                        <span className="text-xs font-medium text-slate-700">Max Attempts</span>
                        <input
                          type="number"
                          min={1}
                          value={quizForm.maxAttempts}
                          onChange={(e) =>
                            setQuizForm({ ...quizForm, maxAttempts: e.target.value })
                          }
                          className="input-field mt-1"
                        />
                      </label>
                    </div>

                    <label className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={quizForm.randomizeQuestions}
                        onChange={(e) =>
                          setQuizForm({ ...quizForm, randomizeQuestions: e.target.checked })
                        }
                        className="rounded border-slate-300"
                      />
                      Randomize question order for each learner attempt
                    </label>

                    {/* Quiz Questions List */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 uppercase">
                          Questions ({quizQuestions.length})
                        </span>
                        <button
                          type="button"
                          onClick={handleAddQuestion}
                          className="btn-primary-sm"
                        >
                          + Add Question
                        </button>
                      </div>

                      {quizQuestions.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">
                          No quiz questions added yet. Click <strong>+ Add Question</strong> above.
                        </p>
                      ) : (
                        <div className="space-y-4">
                          {quizQuestions.map((q, qIdx) => (
                            <div
                              key={q.id}
                              className="rounded border border-slate-200 bg-white p-3.5 space-y-3 shadow-2xs"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-800">
                                  Question #{qIdx + 1}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveQuestion(qIdx)}
                                  className="text-xs text-red-600 hover:underline font-medium"
                                >
                                  Remove Question
                                </button>
                              </div>

                              <div className="grid gap-3 sm:grid-cols-4">
                                <label className="block sm:col-span-3">
                                  <span className="text-xs font-medium text-slate-700">
                                    Question Text *
                                  </span>
                                  <input
                                    required
                                    placeholder="e.g. What is the default HTTP port?"
                                    value={q.questionText}
                                    onChange={(e) =>
                                      handleUpdateQuestion(qIdx, "questionText", e.target.value)
                                    }
                                    className="input-field mt-1 text-xs"
                                  />
                                </label>

                                <label className="block sm:col-span-1">
                                  <span className="text-xs font-medium text-slate-700">Points</span>
                                  <input
                                    type="number"
                                    min={1}
                                    value={q.points}
                                    onChange={(e) =>
                                      handleUpdateQuestion(qIdx, "points", e.target.value)
                                    }
                                    className="input-field mt-1 text-xs"
                                  />
                                </label>
                              </div>

                              {/* Answers List */}
                              <div className="space-y-2 pt-1 border-t border-slate-100">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-semibold text-slate-600">
                                    Answer Choices
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleAddAnswer(qIdx)}
                                    className="text-[11px] font-medium text-blue-600 hover:underline"
                                  >
                                    + Add Answer Choice
                                  </button>
                                </div>

                                {q.answers.map((a, aIdx) => (
                                  <div key={a.id} className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      title="Mark as correct answer"
                                      checked={a.isCorrect}
                                      onChange={(e) =>
                                        handleUpdateAnswer(qIdx, aIdx, "isCorrect", e.target.checked)
                                      }
                                      className="rounded border-slate-300"
                                    />
                                    <input
                                      required
                                      placeholder={`Option ${aIdx + 1}`}
                                      value={a.answerText}
                                      onChange={(e) =>
                                        handleUpdateAnswer(qIdx, aIdx, "answerText", e.target.value)
                                      }
                                      className="input-field flex-1 text-xs"
                                    />
                                    {a.isCorrect ? (
                                      <span className="text-[10px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">
                                        Correct
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-medium text-slate-400">
                                        Incorrect
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveAnswer(qIdx, aIdx)}
                                      className="text-xs text-red-500 hover:text-red-700 px-1"
                                    >
                                      &times;
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {/* File Upload Controls */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 uppercase">
                      Upload JSON File
                    </h4>
                    <p className="text-xs text-slate-500">
                      Select a structured `.json` file from your device or paste code below.
                    </p>
                  </div>

                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,application/json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="btn-primary-sm"
                    >
                      📁 Choose JSON File
                    </button>
                  </div>
                </div>

                {fileUploadName && (
                  <p className="text-xs font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2.5 py-1">
                    Loaded file: <strong>{fileUploadName}</strong>
                  </p>
                )}
              </div>

              {/* JSON Textarea */}
              <div>
                <p className="text-xs text-slate-600 mb-2">
                  Direct JSON Editor (Paste or edit structure):
                </p>
                <textarea
                  rows={13}
                  value={jsonText}
                  onChange={(e) => {
                    setJsonText(e.target.value);
                    setJsonError("");
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-slate-900 p-3 font-mono text-xs text-slate-100 focus:outline-none"
                />
              </div>

              {jsonError && (
                <div className="rounded border border-red-300 bg-red-50 p-3 text-xs text-red-700">
                  {jsonError}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleApplyJson}
                  className="btn-primary-sm"
                >
                  Apply JSON to Visual Builder
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-200 pt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-medium text-slate-600">
            {isSubmitting && <span className="animate-pulse">{progressMsg}</span>}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="structured-module-form"
              disabled={isSubmitting || !moduleForm.title.trim()}
              className="btn-primary"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Saving...
                </>
              ) : (
                "Save Structured Module"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
