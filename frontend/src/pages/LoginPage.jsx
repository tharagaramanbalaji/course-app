import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { getApiErrorMessage } from "@/api/client";
import { useAuth } from "@/auth/useAuth";
import ErrorNote from "@/components/ErrorNote";
import { containerStaggerVariants, itemFadeUpVariants } from "@/utils/motion";

const ADMIN_PATHS = ["/admin", "/users"];
const AUTHOR_PATHS_RE = /^\/courses\/[^/]+\/(manage|assignments)/;

function canAccess(role, path) {
  if (ADMIN_PATHS.includes(path)) return role === "ADMIN";
  if (AUTHOR_PATHS_RE.test(path)) return role === "ADMIN" || role === "INSTRUCTOR";
  return true;
}

// Development seed accounts, printed by backend/scripts/seed.py.
const SEED_LOGINS = [
  ["admin@example.com", "Admin123!", "ADMIN"],
  ["instructor@example.com", "Teach123!", "INSTRUCTOR"],
  ["user1@gmail.com", "tharak28", "USER"],
];

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const loggedIn = await login(email, password);
      const from = location.state?.from;
      navigate(from && canAccess(loggedIn.role, from) ? from : "/", { replace: true });
    } catch (loginError) {
      setError(getApiErrorMessage(loginError));
    } finally {
      setSubmitting(false);
    }
  }

  function fillWith(seedEmail, seedPassword) {
    setEmail(seedEmail);
    setPassword(seedPassword);
    setError("");
  }

  return (
    <div className="w-full max-w-[1500px] mx-auto py-2 sm:py-6">
      <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xl shadow-slate-200/50 grid lg:grid-cols-12 min-h-[640px]">
        {/* Left Side: Rich Enterprise Showcase Panel with Dark Emerald Neumorphism (7 cols) */}
        <div className="lg:col-span-7 neu-panel p-8 sm:p-10 lg:p-14 text-white flex flex-col justify-between relative overflow-hidden">


          {/* Top Hero Header */}
          <div className="relative z-10 space-y-3">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight text-white font-brand-logo" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Enterprise Training & Intelligence Platform
            </h1>
            <p className="text-sm sm:text-base text-emerald-100/80 max-w-2xl leading-relaxed">
              Streamline course authoring, track workforce skill development with real-time analytics, and automatically issue verified compliance credentials.
            </p>
          </div>

          {/* Core Enterprise Highlights with Neumorphic Cards */}
          <motion.div
            variants={containerStaggerVariants}
            initial="hidden"
            animate="visible"
            className="relative z-10 my-8 grid gap-4 sm:grid-cols-2"
          >
            <motion.div variants={itemFadeUpVariants} className="neu-card p-4 rounded-2xl flex items-start gap-3.5 group">
              <div className="neu-inset p-2.5 rounded-xl shrink-0 text-emerald-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wide">Structured Learning Modules</h4>
                <p className="text-xs text-emerald-100/70 mt-1 leading-relaxed">Interactive multimedia lessons, rich guides, and knowledge check quizzes.</p>
              </div>
            </motion.div>

            <motion.div variants={itemFadeUpVariants} className="neu-card p-4 rounded-2xl flex items-start gap-3.5 group">
              <div className="neu-inset p-2.5 rounded-xl shrink-0 text-emerald-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wide">Real-Time Cohort Analytics</h4>
                <p className="text-xs text-emerald-100/70 mt-1 leading-relaxed">Live pass rate tracking, student progress metrics, and completion rates.</p>
              </div>
            </motion.div>

            <motion.div variants={itemFadeUpVariants} className="neu-card p-4 rounded-2xl flex items-start gap-3.5 group">
              <div className="neu-inset p-2.5 rounded-xl shrink-0 text-emerald-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wide">Granular Role Governance</h4>
                <p className="text-xs text-emerald-100/70 mt-1 leading-relaxed">Admin, Instructor, and Learner permission scoping with full auditability.</p>
              </div>
            </motion.div>

            <motion.div variants={itemFadeUpVariants} className="neu-card p-4 rounded-2xl flex items-start gap-3.5 group">
              <div className="neu-inset p-2.5 rounded-xl shrink-0 text-emerald-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wide">Automated Certificates</h4>
                <p className="text-xs text-emerald-100/70 mt-1 leading-relaxed">Instant verifiable certificate generation upon passing all course modules.</p>
              </div>
            </motion.div>
          </motion.div>

          {/* Enterprise Capabilities Row - Real Platform Features */}
          <motion.div
            variants={containerStaggerVariants}
            initial="hidden"
            animate="visible"
            className="relative z-10 pt-5 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-3.5"
          >
            {/* Real Feature Widget 1 */}
            <motion.div variants={itemFadeUpVariants} className="neu-card rounded-xl flex items-center overflow-hidden h-11">
              <div className="flex-1 flex items-center gap-2 px-3 neu-divider h-full">
                <span className="text-emerald-400 text-xs">📚</span>
                <span className="text-xs font-bold text-white uppercase tracking-wider">Lessons</span>
              </div>
              <div className="px-3.5 text-xs font-bold text-emerald-300 h-full flex items-center bg-black/15">
                Video & Text
              </div>
            </motion.div>

            {/* Real Feature Widget 2 */}
            <motion.div variants={itemFadeUpVariants} className="neu-card rounded-xl flex items-center overflow-hidden h-11">
              <div className="flex-1 flex items-center gap-2 px-3 neu-divider h-full">
                <span className="text-emerald-400 text-xs">🎯</span>
                <span className="text-xs font-bold text-white uppercase tracking-wider">Quizzes</span>
              </div>
              <div className="px-3.5 text-xs font-bold text-emerald-300 h-full flex items-center bg-black/15">
                Auto-Graded
              </div>
            </motion.div>

            {/* Real Feature Widget 3 */}
            <motion.div variants={itemFadeUpVariants} className="neu-card rounded-xl flex items-center overflow-hidden h-11">
              <div className="flex-1 flex items-center gap-2 px-3 neu-divider h-full">
                <span className="text-emerald-400 text-xs">🏆</span>
                <span className="text-xs font-bold text-white uppercase tracking-wider">Certificates</span>
              </div>
              <div className="px-3.5 text-xs font-bold text-emerald-300 h-full flex items-center bg-black/15">
                Verifiable
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Right Side: Enterprise Login Form (5 cols) */}
        <div className="lg:col-span-5 p-8 sm:p-10 lg:p-12 flex flex-col justify-center bg-white">
          <div className="max-w-md w-full mx-auto space-y-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-brand-logo" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Sign in to your account
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-500">
                Enter your registered enterprise credentials to access your dashboard.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Email</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0A6847] focus:ring-2 focus:ring-[#0A6847]/20 focus:outline-none transition"
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Password</span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0A6847] focus:ring-2 focus:ring-[#0A6847]/20 focus:outline-none transition"
                />
              </label>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: -4 }}
                    animate={{ opacity: 1, height: "auto", y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ErrorNote message={error} />
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                type="submit"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.985 }}
                disabled={submitting}
                className="w-full rounded-xl bg-[#0A6847] px-4 py-3 text-sm font-bold text-white shadow-md shadow-[#0A6847]/20 hover:bg-[#085438] transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </motion.button>
            </form>

            {/* Seed Quick Logins */}
            <div className="pt-5 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Quick Dev Accounts
                </span>
                <span className="text-[10px] text-slate-400">Click to autofill</span>
              </div>
              <div className="space-y-2">
                {SEED_LOGINS.map(([seedEmail, seedPassword, role]) => (
                  <button
                    key={seedEmail}
                    type="button"
                    onClick={() => fillWith(seedEmail, seedPassword)}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-200/90 bg-slate-50/80 px-3.5 py-2.5 text-left text-xs text-slate-700 hover:border-[#7ABA78] hover:bg-[#E8F5E9]/50 transition group"
                  >
                    <span className="font-mono font-medium group-hover:text-[#0A6847] transition-colors">
                      {seedEmail}
                    </span>
                    <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600 group-hover:border-[#7ABA78] group-hover:text-[#0A6847]">
                      {role}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
