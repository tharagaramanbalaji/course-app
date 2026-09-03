import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { api, getApiErrorMessage } from "@/api/client";
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
  ["learner@example.com", "Learn123!", "USER"],
];

export default function LoginPage() {
  const { user, login, loginWithSSO } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);

  // Handle SSO OAuth2 Callback when returning with ?code=... or ?mock=true
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    const state = params.get("state");
    const mock = params.get("mock");

    if (code || mock) {
      const ssoCode = code || "mock_google_code_::workspace.user@example.com";
      setSsoLoading(true);
      setError("");

      if (loginWithSSO) {
        loginWithSSO(ssoCode, state)
          .then((loggedIn) => {
            const from = location.state?.from;
            navigate(from && canAccess(loggedIn.role, from) ? from : "/", { replace: true });
          })
          .catch((err) => {
            setError(getApiErrorMessage(err));
            setSsoLoading(false);
          });
      }
    }
  }, [location.search, location.state, loginWithSSO, navigate]);

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

  async function handleGoogleSSO() {
    setError("");
    setSsoLoading(true);
    try {
      const redirectUri = `${window.location.origin}/login`;
      const res = await api.get("/auth/sso/google/authorize", {
        params: { redirect_uri: redirectUri },
      });
      const authUrl = res.data?.data?.authorizationUrl || res.data?.data?.authorization_url;
      if (authUrl) {
        window.location.href = authUrl;
      } else {
        setSsoLoading(false);
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
      setSsoLoading(false);
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
                <h4 className="text-xs font-bold text-white uppercase tracking-wide">Cohort Progress Tracking</h4>
                <p className="text-xs text-emerald-100/70 mt-1 leading-relaxed">Granular insights on student completion velocity and quiz score distributions.</p>
              </div>
            </motion.div>

            <motion.div variants={itemFadeUpVariants} className="neu-card p-4 rounded-2xl flex items-start gap-3.5 group">
              <div className="neu-inset p-2.5 rounded-xl shrink-0 text-emerald-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wide">Verified Certifications</h4>
                <p className="text-xs text-emerald-100/70 mt-1 leading-relaxed">Cryptographically signed, tamper-proof completion credentials.</p>
              </div>
            </motion.div>

            <motion.div variants={itemFadeUpVariants} className="neu-card p-4 rounded-2xl flex items-start gap-3.5 group">
              <div className="neu-inset p-2.5 rounded-xl shrink-0 text-emerald-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wide">Enterprise SSO Ready</h4>
                <p className="text-xs text-emerald-100/70 mt-1 leading-relaxed">Integrated with Google Workspace, Microsoft Entra ID, and Okta OIDC.</p>
              </div>
            </motion.div>
          </motion.div>

          {/* Bottom Live Capabilities Matrix */}
          <div className="relative z-10 pt-6 border-t border-emerald-800/60 grid grid-cols-3 gap-4">
            <div className="neu-stat p-3 rounded-xl text-center">
              <div className="text-sm sm:text-base font-extrabold text-white font-mono">100%</div>
              <div className="text-[11px] text-emerald-300/80 uppercase tracking-wider mt-0.5">Role Governance</div>
            </div>
            <div className="neu-stat p-3 rounded-xl text-center">
              <div className="text-sm sm:text-base font-extrabold text-white font-mono">OIDC</div>
              <div className="text-[11px] text-emerald-300/80 uppercase tracking-wider mt-0.5">SSO Integration</div>
            </div>
            <div className="neu-stat p-3 rounded-xl text-center">
              <div className="text-sm sm:text-base font-extrabold text-white font-mono">Live</div>
              <div className="text-[11px] text-emerald-300/80 uppercase tracking-wider mt-0.5">Quiz Validation</div>
            </div>
          </div>
        </div>

        {/* Right Side: Sign-in Form (5 cols) */}
        <div className="lg:col-span-5 p-8 sm:p-10 lg:p-12 flex flex-col justify-center bg-white">
          <div className="max-w-md w-full mx-auto space-y-6">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#0A6847]">
                LearnFlow Enterprise
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-brand-logo" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Sign in to your account
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-500">
                Sign in with enterprise SSO or your registered email credentials.
              </p>
            </div>

            {/* Google Workspace SSO Button */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.985 }}
              onClick={handleGoogleSSO}
              disabled={submitting || ssoLoading}
              className="w-full rounded-xl border border-slate-300/90 bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-2xs hover:bg-slate-50 hover:border-slate-400 transition disabled:opacity-50 flex items-center justify-center gap-3 group"
            >
              {ssoLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-[#0A6847]" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Authenticating with Google Workspace...
                </>
              ) : (
                <>
                  {/* Google G Icon */}
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                  <span className="group-hover:text-slate-900 transition-colors">
                    Sign in with Google Workspace
                  </span>
                </>
              )}
            </motion.button>

            {/* Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-[11px] uppercase">
                <span className="bg-white px-2.5 text-slate-400 font-semibold tracking-wider">
                  Or sign in with password
                </span>
              </div>
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
                disabled={submitting || ssoLoading}
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
