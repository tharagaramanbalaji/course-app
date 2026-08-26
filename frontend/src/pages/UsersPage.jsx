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
        <h2 className="text-xl font-medium">Users</h2>
        <p className="mt-1 text-sm text-slate-600">
          Admin only. Passwords are hashed by the backend and never returned.
        </p>
      </div>

      <ErrorNote message={error} />

      <form
        onSubmit={handleCreate}
        className="space-y-3 rounded border border-slate-200 bg-white p-4"
      >
        <h3 className="font-medium">New user</h3>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">First name</span>
            <input
              required
              value={form.firstName}
              onChange={(event) => setForm({ ...form, firstName: event.target.value })}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Last name</span>
            <input
              required
              value={form.lastName}
              onChange={(event) => setForm({ ...form, lastName: event.target.value })}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              required
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Password</span>
            <input
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>
        </div>

        <label className="block max-w-xs">
          <span className="text-sm font-medium">Role</span>
          <select
            value={form.role}
            onChange={(event) => setForm({ ...form, role: event.target.value })}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          disabled={createUser.isPending}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {createUser.isPending ? "Creating..." : "Create user"}
        </button>
      </form>

      <label className="block max-w-sm">
        <span className="text-sm font-medium">Search</span>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Name or email"
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
        />
      </label>

      {usersQuery.isPending && <p className="text-slate-500">Loading users...</p>}
      {usersQuery.isError && <ErrorNote message={getApiErrorMessage(usersQuery.error)} />}

      {usersQuery.isSuccess && (
        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2">
                    {user.firstName} {user.lastName}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{user.email}</td>
                  <td className="px-4 py-2">
                    <select
                      value={user.role}
                      onChange={(event) =>
                        changeRole.mutate({ id: user.id, role: event.target.value })
                      }
                      className="rounded border border-slate-300 px-2 py-1"
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() =>
                        changeStatus.mutate({
                          id: user.id,
                          status: user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                        })
                      }
                      className={`rounded px-2 py-1 text-xs font-medium ${
                        user.status === "ACTIVE"
                          ? "bg-green-100 text-green-800"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {user.status}
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
