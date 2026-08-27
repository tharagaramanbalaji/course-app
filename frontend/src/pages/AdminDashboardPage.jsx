import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

import { api, getApiErrorMessage } from "@/api/client";
import ErrorNote from "@/components/ErrorNote";

const TABS = [
  ["courses", "Courses"],
  ["users", "Learners"],
  ["progress", "Progress"],
  ["quiz-results", "Quiz results"],
  ["completions", "Completions"],
];

const STATUS_STYLES = {
  DRAFT: "badge-amber",
  PUBLISHED: "badge-brand",
  ARCHIVED: "badge-slate",
};

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : "—";
}

function Stat({ label, value, hint }) {
  return (
    <div className="card">
      <p className="label-field">{label}</p>
      <p className="mt-1.5 text-2xl font-extrabold text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Table({ columns, rows, empty, renderRow }) {
  if (rows.length === 0) {
    return <p className="card border-dashed text-center text-slate-500">{empty}</p>;
  }
  return (
    <div className="card-flush overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-100 bg-slate-50/70 text-left">
          <tr>
            {columns.map((column) => (
              <th key={column} className="whitespace-nowrap px-4 py-2.5 font-semibold text-slate-600">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{rows.map(renderRow)}</tbody>
      </table>
    </div>
  );
}

function Bar({ percent }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-[#0A6847]" style={{ width: `${percent}%` }} />
      </div>
      <span className="text-xs text-slate-600">{percent}%</span>
    </div>
  );
}

/**
 * Requirement 4: courses, users, assignments, progress, quiz results and
 * completion status. Every figure comes from an owner-scoped endpoint, so
 * an instructor sees their own courses and nobody else's.
 */
export default function AdminDashboardPage() {
  const [tab, setTab] = useState("courses");

  const overview = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: async () => (await api.get("/admin/dashboard/overview")).data.data,
  });

  const detail = useQuery({
    queryKey: ["admin", tab],
    queryFn: async () => (await api.get(`/admin/dashboard/${tab}`)).data.data,
  });

  const rows = detail.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Analytics</h1>
        <p className="mt-1 text-sm text-slate-500">
          Everything below is scoped to courses you own.
        </p>
      </div>

      {overview.isError && <ErrorNote message={getApiErrorMessage(overview.error)} />}
      {overview.isPending && <p className="text-slate-500">Loading overview...</p>}

      {overview.isSuccess && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Courses"
            value={overview.data.totalCourses}
            hint={`${overview.data.publishedCourses} published · ${overview.data.draftCourses} draft`}
          />
          <Stat label="Assigned learners" value={overview.data.totalAssignedUsers} />
          <Stat
            label="Enrollments"
            value={overview.data.activeEnrollments + overview.data.completedEnrollments}
            hint={`${overview.data.activeEnrollments} active · ${overview.data.completedEnrollments} completed`}
          />
          <Stat
            label="Certificates"
            value={overview.data.certificatesIssued}
            hint={`avg quiz score ${overview.data.averageQuizScore}%`}
          />
        </div>
      )}

      {overview.isSuccess && (
        <div className="card">
          <p className="label-field">Completion rate</p>
          <div className="mt-2">
            <Bar percent={Math.round(Number(overview.data.completionRate))} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-t-lg px-3.5 py-2 text-sm font-semibold transition ${
              tab === key
                ? "border-b-2 border-[#0A6847] text-[#0A6847]"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {detail.isPending && <p className="text-slate-500">Loading...</p>}
      {detail.isError && <ErrorNote message={getApiErrorMessage(detail.error)} />}

      {detail.isSuccess && tab === "courses" && (
        <Table
          columns={["Course", "Status", "Modules", "Assigned", "Enrolled", "Completed", ""]}
          rows={rows}
          empty="You do not own any courses yet."
          renderRow={(row) => (
            <tr key={row.courseId} className="border-b border-slate-100 last:border-0">
              <td className="px-4 py-2.5 font-semibold text-slate-900">{row.title}</td>
              <td className="px-4 py-2.5">
                <span className={STATUS_STYLES[row.status]}>{row.status}</span>
              </td>
              <td className="px-4 py-2.5">{row.modules}</td>
              <td className="px-4 py-2.5">{row.assignments}</td>
              <td className="px-4 py-2.5">{row.enrollments}</td>
              <td className="px-4 py-2.5">
                {row.completed} <span className="text-xs text-slate-500">({row.completionRate}%)</span>
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right">
                <Link
                  to={`/courses/${row.courseId}/manage`}
                  className="text-xs font-semibold text-[#0A6847] hover:underline"
                >
                  Manage
                </Link>
                <Link
                  to={`/courses/${row.courseId}/assignments`}
                  className="ml-3 text-xs font-semibold text-[#0A6847] hover:underline"
                >
                  Assign
                </Link>
              </td>
            </tr>
          )}
        />
      )}

      {detail.isSuccess && tab === "users" && (
        <Table
          columns={["Learner", "Email", "Enrolled", "Completed", "Certificates"]}
          rows={rows}
          empty="No learners are enrolled on your courses yet."
          renderRow={(row) => (
            <tr key={row.userId} className="border-b border-slate-100 last:border-0">
              <td className="px-4 py-2.5">
                {row.firstName} {row.lastName}
              </td>
              <td className="px-4 py-2.5 font-mono text-xs">{row.email}</td>
              <td className="px-4 py-2.5">{row.enrolledCourses}</td>
              <td className="px-4 py-2.5">{row.completedCourses}</td>
              <td className="px-4 py-2.5">{row.certificates}</td>
            </tr>
          )}
        />
      )}

      {detail.isSuccess && tab === "progress" && (
        <Table
          columns={["Learner", "Course", "Status", "Modules", "Progress"]}
          rows={rows}
          empty="No progress to report yet."
          renderRow={(row) => (
            <tr
              key={`${row.userId}-${row.courseId}`}
              className="border-b border-slate-100 last:border-0"
            >
              <td className="px-4 py-2.5">
                {row.participantName}
                <span className="block font-mono text-xs text-slate-500">{row.email}</span>
              </td>
              <td className="px-4 py-2.5">{row.courseTitle}</td>
              <td className="px-4 py-2.5 text-xs">{row.enrollmentStatus}</td>
              <td className="px-4 py-2.5">
                {row.completedModules}/{row.totalModules}
              </td>
              <td className="px-4 py-2.5">
                <Bar percent={row.percentComplete} />
              </td>
            </tr>
          )}
        />
      )}

      {detail.isSuccess && tab === "quiz-results" && (
        <Table
          columns={["Learner", "Course", "Module", "Attempt", "Score", "Result", "Submitted"]}
          rows={rows}
          empty="No quiz attempts yet."
          renderRow={(row) => (
            <tr key={row.attemptId} className="border-b border-slate-100 last:border-0">
              <td className="px-4 py-2.5">{row.participantName}</td>
              <td className="px-4 py-2.5">{row.courseTitle}</td>
              <td className="px-4 py-2.5">{row.moduleTitle}</td>
              <td className="px-4 py-2.5">#{row.attemptNumber}</td>
              <td className="px-4 py-2.5">{row.score ?? "—"}</td>
              <td className="px-4 py-2.5">
                {row.passed === null ? (
                  <span className="badge-slate">in progress</span>
                ) : (
                  <span className={row.passed ? "badge-brand" : "badge-red"}>
                    {row.passed ? "PASSED" : "FAILED"}
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5">{formatDate(row.submittedAt)}</td>
            </tr>
          )}
        />
      )}

      {detail.isSuccess && tab === "completions" && (
        <Table
          columns={["Learner", "Course", "Completed", "Final score", "Certificate"]}
          rows={rows}
          empty="Nobody has completed one of your courses yet."
          renderRow={(row) => (
            <tr
              key={`${row.userId}-${row.courseId}`}
              className="border-b border-slate-100 last:border-0"
            >
              <td className="px-4 py-2.5">{row.participantName}</td>
              <td className="px-4 py-2.5">{row.courseTitle}</td>
              <td className="px-4 py-2.5">{formatDate(row.completedAt)}</td>
              <td className="px-4 py-2.5">{row.finalScore ?? "—"}</td>
              <td className="px-4 py-2.5 font-mono text-xs">{row.certificateNumber ?? "—"}</td>
            </tr>
          )}
        />
      )}
    </div>
  );
}
