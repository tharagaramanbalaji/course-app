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
  DRAFT: "bg-amber-100 text-amber-800",
  PUBLISHED: "bg-green-100 text-green-800",
  ARCHIVED: "bg-slate-200 text-slate-700",
};

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : "—";
}

function Stat({ label, value, hint }) {
  return (
    <div className="rounded border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Table({ columns, rows, empty, renderRow }) {
  if (rows.length === 0) {
    return (
      <p className="rounded border border-dashed border-slate-300 p-6 text-center text-slate-500">
        {empty}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left">
          <tr>
            {columns.map((column) => (
              <th key={column} className="whitespace-nowrap px-4 py-2 font-medium">
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
      <div className="h-2 w-24 overflow-hidden rounded bg-slate-200">
        <div className="h-full rounded bg-slate-900" style={{ width: `${percent}%` }} />
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
        <h2 className="text-xl font-medium">Dashboard</h2>
        <p className="mt-1 text-sm text-slate-600">
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
        <div className="rounded border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Completion rate</p>
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
            className={`rounded-t px-3 py-2 text-sm font-medium ${
              tab === key
                ? "border-b-2 border-slate-900 text-slate-900"
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
              <td className="px-4 py-2 font-medium">{row.title}</td>
              <td className="px-4 py-2">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    STATUS_STYLES[row.status]
                  }`}
                >
                  {row.status}
                </span>
              </td>
              <td className="px-4 py-2">{row.modules}</td>
              <td className="px-4 py-2">{row.assignments}</td>
              <td className="px-4 py-2">{row.enrollments}</td>
              <td className="px-4 py-2">
                {row.completed} <span className="text-xs text-slate-500">({row.completionRate}%)</span>
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-right">
                <Link
                  to={`/courses/${row.courseId}/manage`}
                  className="text-xs text-slate-600 hover:underline"
                >
                  Manage
                </Link>
                <Link
                  to={`/courses/${row.courseId}/assignments`}
                  className="ml-3 text-xs text-slate-600 hover:underline"
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
              <td className="px-4 py-2">
                {row.firstName} {row.lastName}
              </td>
              <td className="px-4 py-2 font-mono text-xs">{row.email}</td>
              <td className="px-4 py-2">{row.enrolledCourses}</td>
              <td className="px-4 py-2">{row.completedCourses}</td>
              <td className="px-4 py-2">{row.certificates}</td>
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
              <td className="px-4 py-2">
                {row.participantName}
                <span className="block font-mono text-xs text-slate-500">{row.email}</span>
              </td>
              <td className="px-4 py-2">{row.courseTitle}</td>
              <td className="px-4 py-2 text-xs">{row.enrollmentStatus}</td>
              <td className="px-4 py-2">
                {row.completedModules}/{row.totalModules}
              </td>
              <td className="px-4 py-2">
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
              <td className="px-4 py-2">{row.participantName}</td>
              <td className="px-4 py-2">{row.courseTitle}</td>
              <td className="px-4 py-2">{row.moduleTitle}</td>
              <td className="px-4 py-2">#{row.attemptNumber}</td>
              <td className="px-4 py-2">{row.score ?? "—"}</td>
              <td className="px-4 py-2">
                {row.passed === null ? (
                  <span className="text-xs text-slate-500">in progress</span>
                ) : (
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      row.passed ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                    }`}
                  >
                    {row.passed ? "PASSED" : "FAILED"}
                  </span>
                )}
              </td>
              <td className="px-4 py-2">{formatDate(row.submittedAt)}</td>
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
              <td className="px-4 py-2">{row.participantName}</td>
              <td className="px-4 py-2">{row.courseTitle}</td>
              <td className="px-4 py-2">{formatDate(row.completedAt)}</td>
              <td className="px-4 py-2">{row.finalScore ?? "—"}</td>
              <td className="px-4 py-2 font-mono text-xs">{row.certificateNumber ?? "—"}</td>
            </tr>
          )}
        />
      )}
    </div>
  );
}
