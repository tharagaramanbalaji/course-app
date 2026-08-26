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
    <div className="mx-auto max-w-sm space-y-6">
      <div>
        <h2 className="text-xl font-medium">Sign in</h2>
        <p className="mt-1 text-sm text-slate-600">
          The backend decides what you can see and do.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>

        <ErrorNote message={error} />

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <div className="rounded border border-slate-200 bg-white p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Development accounts
        </p>
        <div className="mt-2 space-y-1">
          {SEED_LOGINS.map(([seedEmail, seedPassword, role]) => (
            <button
              key={seedEmail}
              type="button"
              onClick={() => fillWith(seedEmail, seedPassword)}
              className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-slate-100"
            >
              <span className="font-mono">{seedEmail}</span>
              <span className="ml-2 text-xs text-slate-500">{role}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
