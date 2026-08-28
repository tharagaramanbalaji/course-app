import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api, getApiErrorMessage } from "@/api/client";
import ErrorNote from "@/components/ErrorNote";

const ROLES = ["ADMIN", "INSTRUCTOR", "USER"];

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  role: "USER",
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const usersQuery = useQuery({
    queryKey: ["users", search],
    queryFn: async () =>
      (await api.get("/users", { params: search ? { search } : {} })).data,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["users"] });
  const reportError = (mutationError) => setError(getApiErrorMessage(mutationError));

  const createUser = useMutation({
    mutationFn: (payload) => api.post("/users", payload),
    onSuccess: () => {
      setForm(EMPTY_FORM);
      setError("");
      refresh();
    },
    onError: reportError,
  });

  const changeRole = useMutation({
    mutationFn: ({ id, role }) => api.patch(`/users/${id}/role`, { role }),
    onSuccess: () => {
      setError("");
      refresh();
    },
    onError: reportError,
  });

  const changeStatus = useMutation({
    mutationFn: ({ id, status }) => api.patch(`/users/${id}/status`, { status }),
    onSuccess: () => {
      setError("");
      refresh();
    },
    onError: reportError,
  });

  const deleteUser = useMutation({
    mutationFn: (id) => api.delete(`/users/${id}`),
    onSuccess: () => {
      setError("");
      refresh();
    },
    onError: reportError,
  });

  function handleCreate(event) {
    event.preventDefault();
    setError("");
    createUser.mutate(form);
  }

  const users = usersQuery.data?.data ?? [];
  const pagination = usersQuery.data?.pagination;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Users</h1>
        <p className="mt-1 text-sm text-slate-500">
          Admin only. Passwords are hashed by the backend and never returned.
        </p>
      </div>

      <ErrorNote message={error} />

      <form onSubmit={handleCreate} className="card space-y-4">
        <h3 className="font-bold text-slate-900">New user</h3>

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
          <label className="block">
            <span className="label-field">Email</span>
            <input
              type="email"
              required
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              className="input-field mt-1.5"
            />
          </label>
          <label className="block">
            <span className="label-field">Password</span>
            <input
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              className="input-field mt-1.5"
            />
          </label>
        </div>

        <label className="block max-w-xs">
          <span className="label-field">Role</span>
          <select
            value={form.role}
            onChange={(event) => setForm({ ...form, role: event.target.value })}
            className="input-field mt-1.5"
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" disabled={createUser.isPending} className="btn-primary">
          {createUser.isPending ? "Creating..." : "Create user"}
        </button>
      </form>

      <label className="block max-w-sm">
        <span className="label-field">Search</span>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Name or email"
          className="input-field mt-1.5"
        />
      </label>

      {usersQuery.isPending && <p className="text-slate-500">Loading users...</p>}
      {usersQuery.isError && <ErrorNote message={getApiErrorMessage(usersQuery.error)} />}

      {usersQuery.isSuccess && (
        <div className="card-flush overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-left">
              <tr>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Name</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Email</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Role</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600">Status</th>
                <th className="px-4 py-2.5 font-semibold text-slate-600"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-slate-900">
                    {user.firstName} {user.lastName}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{user.email}</td>
                  <td className="px-4 py-2.5">
                    <select
                      value={user.role}
                      onChange={(event) =>
                        changeRole.mutate({ id: user.id, role: event.target.value })
                      }
                      className="rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-[#0A6847] focus:outline-none focus:ring-2 focus:ring-[#0A6847]/20"
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        changeStatus.mutate({
                          id: user.id,
                          status: user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                        })
                      }
                      className={user.status === "ACTIVE" ? "badge-brand" : "badge-slate"}
                    >
                      {user.status}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          confirm(
                            `Delete ${user.firstName} ${user.lastName}? This cannot be undone.`,
                          )
                        ) {
                          deleteUser.mutate(user.id);
                        }
                      }}
                      className="text-sm font-medium text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination && (
        <p className="text-xs text-slate-500">
          {pagination.total} user(s), page {pagination.page} of {pagination.totalPages || 1}
        </p>
      )}
    </div>
  );
}
