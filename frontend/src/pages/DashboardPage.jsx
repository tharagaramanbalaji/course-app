import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { api, getApiErrorMessage } from "@/api/client";
import { useAuth } from "@/auth/useAuth";
import ErrorNote from "@/components/ErrorNote";

function StatCard({ label, value, hint }) {
  return (
    <div className="card">
      <p className="label-field">{label}</p>
      <p className="mt-1.5 text-3xl font-extrabold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function ActionCard({ to, title, description, cta }) {
  return (
    <Link
      to={to}
      className="card flex flex-col justify-between transition hover:-translate-y-0.5 hover:border-[#7ABA78] hover:shadow-md"
    >
      <div>
        <h3 className="font-bold text-slate-900">{title}</h3>
        <p className="mt-1.5 text-sm text-slate-500">{description}</p>
      </div>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#0A6847]">
        {cta} <span aria-hidden="true">&rarr;</span>
      </span>
    </Link>
  );
}

function LearnerDashboard() {
  const dashboardQuery = useQuery({
    queryKey: ["my-dashboard"],
    queryFn: async () => (await api.get("/my/dashboard")).data.data,
  });

  if (dashboardQuery.isPending) {
    return <p className="text-slate-500">Loading your dashboard...</p>;
  }
  if (dashboardQuery.isError) {
    return <ErrorNote message={getApiErrorMessage(dashboardQuery.error)} />;
  }

  const data = dashboardQuery.data;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Assigned" value={data.assignedCourses} />
        <StatCard label="Self-enrolled" value={data.selfEnrolledCourses} />
        <StatCard label="In progress" value={data.activeCourses} />
        <StatCard label="Completed" value={data.completedCourses} />
        <StatCard label="Certificates" value={data.certificates} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card-flush lg:col-span-2">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="font-bold text-slate-900">Your courses</h2>
          </div>
          {data.courses.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-slate-500">
              You are not enrolled in any courses yet.{" "}
              <Link to="/courses" className="font-semibold text-[#0A6847] hover:underline">
                Browse the catalogue
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.courses.map((row) => (
                <li key={row.courseId} className="flex items-center gap-4 px-6 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">{row.title}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-[#0A6847]"
                          style={{ width: `${row.progress.percentComplete}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500">
                        {row.progress.percentComplete}%
                      </span>
                    </div>
                  </div>
                  <Link
                    to={`/learn/courses/${row.courseId}`}
                    className="btn-secondary-sm shrink-0"
                  >
                    {row.enrollment.status === "COMPLETED" ? "Review" : "Continue"}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card-flush">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="font-bold text-slate-900">Recent quiz attempts</h2>
          </div>
          {data.recentQuizAttempts.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-slate-500">
              No quiz attempts yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.recentQuizAttempts.map((attempt) => (
                <li key={attempt.attemptId} className="px-6 py-3">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {attempt.moduleTitle}
                  </p>
                  <p className="truncate text-xs text-slate-500">{attempt.courseTitle}</p>
                  <div className="mt-1 flex items-center gap-2">
                    {attempt.passed === null ? (
                      <span className="badge-slate">in progress</span>
                    ) : attempt.passed ? (
                      <span className="badge-brand">Passed · {attempt.score}%</span>
                    ) : (
                      <span className="badge-red">Failed · {attempt.score}%</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function AuthorDashboard({ isAdmin }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <ActionCard
        to="/courses"
        title="Courses"
        description="Create, edit and publish the courses you own."
        cta="Manage courses"
      />
      <ActionCard
        to="/admin"
        title="Analytics"
        description="Enrollment, progress, quiz results and completions for your courses."
        cta="View analytics"
      />
      {isAdmin && (
        <ActionCard
          to="/users"
          title="Users"
          description="Create accounts and manage roles across the platform."
          cta="Manage users"
        />
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user, isAuthor, isAdmin } = useAuth();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          Welcome back, {user.firstName}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {isAuthor
            ? "Here's a quick way into everything you own."
            : "Here's where you left off."}
        </p>
      </div>

      {isAuthor ? <AuthorDashboard isAdmin={isAdmin} /> : <LearnerDashboard />}
    </div>
  );
}
