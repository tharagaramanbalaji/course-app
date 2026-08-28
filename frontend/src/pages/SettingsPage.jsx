import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api, getApiErrorMessage } from "@/api/client";
import { useAuth } from "@/auth/useAuth";
import ErrorNote from "@/components/ErrorNote";

function getInitials(firstName = "", lastName = "") {
  const f = firstName.trim()[0] || "";
  const l = lastName.trim()[0] || "";
  return (f + l).toUpperCase() || "U";
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await api.get("/auth/me")).data.data,
  });

  const me = meQuery.data ?? user;

  const [form, setForm] = useState({ firstName: "", lastName: "", email: "" });

  function startEditing() {
    setForm({ firstName: me.firstName, lastName: me.lastName, email: me.email });
    setError("");
    setEditing(true);
  }

  const updateProfile = useMutation({
    mutationFn: (payload) => api.patch("/auth/me", payload),
    onSuccess: (response) => {
      queryClient.setQueryData(["me"], response.data);
      queryClient.invalidateQueries({ queryKey: ["me"] });
      setError("");
      setEditing(false);
    },
    onError: (mutationError) => setError(getApiErrorMessage(mutationError)),
  });

  const deleteAccount = useMutation({
    mutationFn: () => api.delete("/auth/me"),
    onSuccess: () => {
      queryClient.clear();
      logout();
    },
    onError: (mutationError) => setError(getApiErrorMessage(mutationError)),
  });

  function handleSave(event) {
    event.preventDefault();
    setError("");
    updateProfile.mutate(form);
  }

  function handleDelete() {
    if (
      confirm(
        "Are you sure you want to delete your account? This action cannot be undone.",
      )
    ) {
      deleteAccount.mutate();
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your account details, as the backend sees them.
        </p>
      </div>

      {meQuery.isError && <ErrorNote message={getApiErrorMessage(meQuery.error)} />}
      <ErrorNote message={error} />

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

        {!editing ? (
          <div className="flex items-center justify-between px-6 py-4">
            <dl className="grid flex-1 gap-px sm:grid-cols-2">
              {[
                ["First name", me.firstName],
                ["Last name", me.lastName],
                ["Email", me.email],
                ["Role", me.role],
                ["Status", me.status],
              ].map(([label, value]) => (
                <div key={label} className="bg-white px-0 py-4 first:pl-0">
                  <dt className="label-field">{label}</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
            <button type="button" onClick={startEditing} className="btn-secondary shrink-0">
              Edit profile
            </button>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4 px-6 py-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="label-field">First name</span>
                <input
                  required
                  value={form.firstName}
                  onChange={(event) => setForm({ ...form, firstName: event.target.value })}
                  className="input-field mt-1.5"
                />
              </label>
              <label className="block">
                <span className="label-field">Last name</span>
                <input
                  required
                  value={form.lastName}
                  onChange={(event) => setForm({ ...form, lastName: event.target.value })}
                  className="input-field mt-1.5"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="label-field">Email</span>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  className="input-field mt-1.5"
                />
              </label>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={updateProfile.isPending} className="btn-primary">
                {updateProfile.isPending ? "Saving..." : "Save changes"}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        )}
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

      <div className="card flex flex-wrap items-center justify-between gap-3 border-red-200">
        <div>
          <h2 className="text-sm font-bold text-red-600">Danger zone</h2>
          <p className="mt-1 text-sm text-slate-600">
            Permanently delete your account and all associated data.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleteAccount.isPending}
          className="btn-danger"
        >
          {deleteAccount.isPending ? "Deleting..." : "Delete account"}
        </button>
      </div>
    </div>
  );
}
