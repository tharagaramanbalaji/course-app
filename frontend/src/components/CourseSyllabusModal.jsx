import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { api, getApiErrorMessage } from "@/api/client";
import ErrorNote from "@/components/ErrorNote";

export default function CourseSyllabusModal({ isOpen, onClose, course, isEnrolled, onEnroll, enrolling }) {
  const [expandedModules, setExpandedModules] = useState({});
  const navigate = useNavigate();

  const syllabusQuery = useQuery({
    queryKey: ["course-syllabus", course?.id],
    queryFn: async () => {
      const res = await api.get(`/courses/${course.id}/syllabus`);
      return res.data.data;
    },
    enabled: isOpen && Boolean(course?.id),
  });

  if (!isOpen || !course) return null;

  const toggleModule = (id) => {
    setExpandedModules((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const syllabus = syllabusQuery.data;
  const modules = syllabus?.modules || [];

  // Calculate statistics
  let textCount = 0;
  let videoCount = 0;
  let quizCount = 0;

  modules.forEach((mod) => {
    (mod.contents || []).forEach((c) => {
      if (c.contentType === "TEXT") textCount++;
      if (c.contentType === "VIDEO") videoCount++;
    });
    if (mod.quiz) quizCount++;
  });

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/75 p-4 backdrop-blur-xs transition-opacity animate-fade-in">
      <div className="relative w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col my-auto z-[101]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-[11px] font-bold text-[#0A6847] uppercase tracking-wider">
              {course.category || "Curriculum"}
            </span>
            <span className="text-xs text-slate-500 font-medium">Syllabus Preview</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Course Info Banner */}
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-snug">
              {course.title}
            </h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              {course.description || "Comprehensive hands-on training module with live interactive guides."}
            </p>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
              <span className="text-lg font-bold text-slate-900">{modules.length}</span>
              <p className="text-[11px] font-medium text-slate-500">Total Modules</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
              <span className="text-lg font-bold text-emerald-700">{textCount}</span>
              <p className="text-[11px] font-medium text-slate-500">Reading Lessons</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
              <span className="text-lg font-bold text-sky-700">{videoCount}</span>
              <p className="text-[11px] font-medium text-slate-500">Video Tutorials</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
              <span className="text-lg font-bold text-purple-700">{quizCount}</span>
              <p className="text-[11px] font-medium text-slate-500">Quizzes & Tests</p>
            </div>
          </div>

          {/* Syllabus Modules List */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-base font-bold text-slate-900">Course Syllabus & Curriculum</h3>
              <span className="text-xs font-semibold text-slate-500">
                {modules.length} Module{modules.length !== 1 ? "s" : ""}
              </span>
            </div>

            {syllabusQuery.isLoading && (
              <div className="p-8 text-center text-sm text-slate-500 animate-pulse">
                Loading curriculum modules...
              </div>
            )}

            {syllabusQuery.isError && (
              <ErrorNote message={getApiErrorMessage(syllabusQuery.error) || "Failed to load syllabus."} />
            )}

            {modules.map((mod, idx) => {
              const isExpanded = expandedModules[mod.id] !== false; // default open
              const contents = mod.contents || [];

              return (
                <div
                  key={mod.id || idx}
                  className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden transition-all"
                >
                  {/* Module Accordion Header */}
                  <button
                    type="button"
                    onClick={() => toggleModule(mod.id)}
                    className="w-full flex items-center justify-between p-4 bg-slate-50/50 hover:bg-slate-50 transition text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0A6847] text-xs font-bold text-white shadow-2xs">
                        {idx + 1}
                      </span>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{mod.title}</h4>
                        {mod.description && (
                          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{mod.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-500">
                        {contents.length} lesson{contents.length !== 1 ? "s" : ""} {mod.quiz ? "+ Quiz" : ""}
                      </span>
                      <svg
                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Module Lessons Breakdown */}
                  {isExpanded && (
                    <div className="p-4 pt-2 border-t border-slate-100 bg-white space-y-2">
                      {contents.map((item, itemIdx) => (
                        <div
                          key={item.id || itemIdx}
                          className="flex items-center justify-between rounded-lg bg-slate-50/70 p-2.5 text-xs border border-slate-100 hover:bg-slate-50 transition"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {item.contentType === "VIDEO" ? (
                              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-100 text-sky-700 text-xs shrink-0">
                                🎥
                              </span>
                            ) : (
                              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-100 text-violet-700 text-xs shrink-0">
                                📄
                              </span>
                            )}
                            <span className="font-medium text-slate-800 truncate">{item.title}</span>
                          </div>

                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md text-slate-500 bg-white border border-slate-200">
                            {item.contentType}
                          </span>
                        </div>
                      ))}

                      {mod.quiz && (
                        <div className="flex items-center justify-between rounded-lg bg-purple-50/70 p-2.5 text-xs border border-purple-100">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-200 text-purple-800 text-xs shrink-0">
                              ✏️
                            </span>
                            <span className="font-bold text-purple-900">{mod.quiz.title}</span>
                          </div>

                          <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
                            Pass: {mod.quiz.passingScore}%
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer CTA */}
        <div className="border-t border-slate-200 bg-slate-50/80 px-6 py-4 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
          >
            Close Preview
          </button>

          {isEnrolled ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate(`/learn/courses/${course.id}`);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0A6847] px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#085438] transition"
            >
              <span>Continue Learning</span>
              <span>&rarr;</span>
            </button>
          ) : course.allowSelfEnrollment ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEnroll(course.id);
              }}
              disabled={enrolling}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0A6847] px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#085438] transition disabled:opacity-50"
            >
              <span>{enrolling ? "Enrolling..." : "Enroll & Start Course Now"}</span>
              <span>&rarr;</span>
            </button>
          ) : (
            <span className="text-xs text-slate-500 font-medium">Assigned by instructor</span>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
