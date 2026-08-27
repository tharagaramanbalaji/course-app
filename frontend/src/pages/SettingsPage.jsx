import { useQuery } from "@tanstack/react-query";

import { api, getApiErrorMessage } from "@/api/client";
import { useAuth } from "@/auth/useAuth";
import ErrorNote from "@/components/ErrorNote";

function getInitials(firstName = "", lastName = "") {
  const f = firstName.trim()[0] || "";
  const l = lastName.trim()[0] || "";
  return (f + l).toUpperCase() || "U";
}

const ROLE_COPY = {
  ADMIN: "Full platform access: manage users, author courses and view every report.",
  INSTRUCTOR: "Author and publish your own courses, assign them and track learner progress.",
  USER: "Browse and enrol in published courses, complete modules and earn certificates.",
};

export default function SettingsPage() {
  const { user, logout } = useAuth();

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await api.get("/auth/me")).data.data,
  });

  const me = meQuery.data ?? user;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your account details, as the backend sees them.
        </p>
      </div>

      {meQuery.isError && <ErrorNote message={getApiErrorMessage(meQuery.error)} />}

      <div className="card-flush">
        <div className="brand-gradient-subtle flex items-center gap-4 border-b border-slate-100 px-6 py-6">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#0A6847] text-xl font-bold text-white shadow-sm">
            {getInitials(me.firstName, me.lastName)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-slate-900">
              {me.firstName} {me.lastName}
            </p>
            <p className="truncate text-sm text-slate-500">{me.email}</p>
            <span className="badge-brand mt-2">{me.role}</span>
          </div>
        </div>

        <dl className="grid gap-px bg-slate-100 sm:grid-cols-2">
          {[
            ["First name", me.firstName],
            ["Last name", me.lastName],
            ["Email", me.email],
            ["Role", me.role],
            ["Status", me.status],
          ].map(([label, value]) => (
            <div key={label} className="bg-white px-6 py-4">
              <dt className="label-field">{label}</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="card">
        <h2 className="text-sm font-bold text-slate-900">What your role can do</h2>
        <p className="mt-1.5 text-sm text-slate-600">{ROLE_COPY[me.role]}</p>
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Session</h2>
          <p className="mt-1 text-sm text-slate-600">Sign out of LearnFlow on this device.</p>
        </div>
        <button type="button" onClick={logout} className="btn-danger">
          Sign out
        </button>
      </div>
    </div>
  );
}
