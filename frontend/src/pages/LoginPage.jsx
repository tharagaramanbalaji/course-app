import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { getApiErrorMessage } from "@/api/client";
import { useAuth } from "@/auth/useAuth";
import ErrorNote from "@/components/ErrorNote";

// Development seed accounts, printed by backend/scripts/seed.py.
const SEED_LOGINS = [
  ["admin@example.com", "Admin123!", "ADMIN"],
  ["instructor@example.com", "Teach123!", "INSTRUCTOR"],
  ["learner@example.com", "Learn123!", "USER"],
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
      await login(email, password);
      navigate(location.state?.from ?? "/", { replace: true });
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
    <div className="min-h-[75vh] flex items-center justify-center py-6 px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Card Header with Brand Logo */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-white shadow-sm border border-[#7ABA78]/30">
            <img src="/logo.png" alt="Learn Flow Logo" className="h-12 w-auto object-contain" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Welcome to <span className="text-[#0A6847]">LearnFlow</span>
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Sign in to access your courses, track learning progress, and earn certificates.
            </p>
          </div>
        </div>

        {/* Main Login Form Card */}
        <div className="rounded-3xl border border-slate-200/90 bg-white p-7 shadow-xl shadow-slate-200/50">
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

            <ErrorNote message={error} />

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-[#0A6847] px-4 py-3 text-sm font-bold text-white shadow-md shadow-[#0A6847]/20 hover:bg-[#085438] active:scale-[0.99] transition disabled:opacity-50 flex items-center justify-center gap-2"
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
            </button>
          </form>

          {/* Seed Quick Logins */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Quick Dev Accounts
              </span>
              <span className="text-[10px] text-slate-400">Click to autofill</span>
            </div>
            <div className="space-y-1.5">
              {SEED_LOGINS.map(([seedEmail, seedPassword, role]) => (
                <button
                  key={seedEmail}
                  type="button"
                  onClick={() => fillWith(seedEmail, seedPassword)}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-left text-xs text-slate-700 hover:border-[#7ABA78] hover:bg-[#E8F5E9]/50 transition group"
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
  );
}
