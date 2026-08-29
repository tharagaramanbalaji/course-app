import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

import { api, getApiErrorMessage } from "@/api/client";
import { useAuth } from "@/auth/useAuth";
import ErrorNote from "@/components/ErrorNote";
import { containerStaggerVariants, itemFadeUpVariants } from "@/utils/motion";

function StatCard({ label, value, hint, icon }) {
  return (
    <div className="card hover:border-[#7ABA78]/60 transition group">
      <div className="flex items-center justify-between">
        <p className="label-field">{label}</p>
        {icon && <div className="text-slate-400 group-hover:text-[#0A6847] transition-colors">{icon}</div>}
      </div>
      <p className="mt-2 text-3xl font-extrabold text-slate-900 tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function ActionCard({ to, title, description, cta, icon, badge }) {
  return (
    <Link
      to={to}
      className="card flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:border-[#0A6847]/40 hover:shadow-md p-6 group"
    >
      <div>
        <div className="flex items-center justify-between">
          <div className="p-2.5 rounded-xl bg-[#E8F5E9] text-[#0A6847] group-hover:bg-[#0A6847] group-hover:text-white transition-colors duration-200">
            {icon}
          </div>
          {badge && <span className="badge-brand">{badge}</span>}
        </div>
        <h3 className="mt-4 text-lg font-bold text-slate-900 group-hover:text-[#0A6847] transition-colors">{title}</h3>
        <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{description}</p>
      </div>
      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-[#0A6847]">
        {cta}{" "}
        <span
          aria-hidden="true"
          className="inline-block transition-transform duration-200 group-hover:translate-x-1.5"
        >
          &rarr;
        </span>
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
    return (
      <div className="card p-12 text-center text-slate-500">
        <div className="animate-spin inline-block w-6 h-6 border-2 border-current border-t-transparent text-[#0A6847] rounded-full mb-2" />
        <p className="text-sm">Loading your enterprise dashboard...</p>
      </div>
    );
  }
  if (dashboardQuery.isError) {
    return <ErrorNote message={getApiErrorMessage(dashboardQuery.error)} />;
  }

  const data = dashboardQuery.data;

  return (
    <div className="space-y-6">
      {/* Top 5 KPI Metrics */}
      <motion.div
        variants={containerStaggerVariants}
        initial="hidden"
        animate="visible"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <motion.div variants={itemFadeUpVariants}>
          <StatCard
            label="Assigned"
            value={data.assignedCourses}
            hint="Mandatory training"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            }
          />
        </motion.div>
        <motion.div variants={itemFadeUpVariants}>
          <StatCard
            label="Self-enrolled"
            value={data.selfEnrolledCourses}
            hint="Elective learning"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            }
          />
        </motion.div>
        <motion.div variants={itemFadeUpVariants}>
          <StatCard
            label="In progress"
            value={data.activeCourses}
            hint="Active curriculum"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }
          />
        </motion.div>
        <motion.div variants={itemFadeUpVariants}>
          <StatCard
            label="Completed"
            value={data.completedCourses}
            hint="Finished pathways"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        </motion.div>
        <motion.div variants={itemFadeUpVariants}>
          <StatCard
            label="Certificates"
            value={data.certificates}
            hint="Verified credentials"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            }
          />
        </motion.div>
      </motion.div>

      {/* Main Wide 2-Column Section */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column (8 cols): Enrolled Courses */}
        <div className="lg:col-span-8 space-y-6">
          <div className="card-flush">
            <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-900 text-lg">Your Courses</h2>
                <p className="text-xs text-slate-500">Track and continue your assigned and elective training</p>
              </div>
              <Link to="/courses" className="text-xs font-bold text-[#0A6847] hover:underline">
                Browse Catalogue &rarr;
              </Link>
            </div>

            {data.courses.length === 0 ? (
              <div className="px-6 py-12 text-center text-slate-500">
                <p className="text-sm">You are not enrolled in any courses yet.</p>
                <Link to="/courses" className="mt-3 btn-primary-sm inline-flex">
                  Browse the catalogue
                </Link>
              </div>
            ) : (
              <motion.ul
                variants={containerStaggerVariants}
                initial="hidden"
                animate="visible"
                className="divide-y divide-slate-100"
              >
                {data.courses.map((row) => (
                  <motion.li
                    variants={itemFadeUpVariants}
                    key={row.courseId}
                    className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 hover:bg-slate-50/60 transition"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <p className="truncate font-bold text-slate-900 text-base">{row.title}</p>
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                          <span className={`h-1.5 w-1.5 rounded-full ${row.enrollment.status === "COMPLETED" ? "bg-[#0A6847]" : "bg-emerald-500"}`} />
                          {row.enrollment.status === "COMPLETED" ? "Completed" : "In Progress"}
                        </span>
                      </div>
                      <div className="mt-2.5 flex items-center gap-3">
                        <div className="h-2 w-48 overflow-hidden rounded-md bg-slate-100">
                          <div
                            className="h-full rounded-md bg-[#0A6847]"
                            style={{ width: `${row.progress.percentComplete}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-slate-600">
                          {row.progress.percentComplete}% Complete
                        </span>
                      </div>
                    </div>
                    <Link
                      to={`/learn/courses/${row.courseId}`}
                      className={row.enrollment.status === "COMPLETED" ? "btn-secondary-sm shrink-0" : "btn-primary-sm shrink-0"}
                    >
                      {row.enrollment.status === "COMPLETED" ? "Review Course" : "Continue Lesson"}
                    </Link>
                  </motion.li>
                ))}
              </motion.ul>
            )}
          </div>
        </div>

        {/* Right Column (4 cols): Assessment Activity & Certification */}
        <div className="lg:col-span-4 space-y-6">
          {/* Recent Quiz Attempts */}
          <div className="card-flush">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="font-bold text-slate-900">Recent Quiz Attempts</h2>
              <p className="text-xs text-slate-500">Latest module evaluation results</p>
            </div>
            {data.recentQuizAttempts.length === 0 ? (
              <p className="px-6 py-8 text-center text-xs text-slate-500">
                No quiz attempts recorded yet.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.recentQuizAttempts.map((attempt) => (
                  <li key={attempt.attemptId} className="px-6 py-3.5">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {attempt.moduleTitle}
                    </p>
                    <p className="truncate text-xs text-slate-500">{attempt.courseTitle}</p>
                    <div className="mt-1.5 flex items-center justify-between">
                      <div>
                        {attempt.passed === null ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                            In progress
                          </span>
                        ) : attempt.passed ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-[#0A6847] font-semibold">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#0A6847]" />
                            Passed ({attempt.score}%)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-red-600 font-semibold">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                            Failed ({attempt.score}%)
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">Score</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Compliance & Certification Assurance */}
          <div className="card p-5 bg-gradient-to-br from-[#042A1C] to-[#0A6847] text-white">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-white/10 text-emerald-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Certification Status</h4>
                <p className="text-[11px] text-emerald-200">{data.certificates} Verified Certificate(s)</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-emerald-100/80 leading-relaxed">
              Complete all lessons and pass the final module quizzes to unlock official corporate completion certificates.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthorDashboard({ isAdmin }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <ActionCard
        to="/courses"
        title="Course Management"
        description="Author, organize, structure, and publish multi-lesson curriculum and quizzes."
        cta="Manage courses"
        badge="Curriculum"
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        }
      />
      <ActionCard
        to="/admin"
        title="Cohort Analytics"
        description="Inspect enrollment funnels, student completion rates, and granular quiz performance."
        cta="View analytics"
        badge="Reporting"
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        }
      />
      {isAdmin && (
        <ActionCard
          to="/users"
          title="User Governance"
          description="Provision enterprise user accounts, assign roles, and audit organization security."
          cta="Manage users"
          badge="Administration"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        />
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user, isAuthor, isAdmin } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-brand-logo">
            Welcome back, {user.firstName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isAuthor
              ? "Enterprise course authoring and student performance analytics portal."
              : "Track your corporate learning progress, upcoming assessments, and achievements."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/courses" className="btn-primary">
            {isAuthor ? "+ Create Course" : "Explore Courses"}
          </Link>
        </div>
      </div>

      {isAuthor ? <AuthorDashboard isAdmin={isAdmin} /> : <LearnerDashboard />}
    </div>
  );
}
