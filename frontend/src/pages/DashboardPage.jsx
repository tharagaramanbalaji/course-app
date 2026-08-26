import { useQuery } from "@tanstack/react-query";

import { api, getApiErrorMessage } from "@/api/client";
import { useAuth } from "@/auth/useAuth";
import ErrorNote from "@/components/ErrorNote";

/** Confirms the session by asking the backend who it thinks you are. */
export default function DashboardPage() {
  const { user } = useAuth();

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await api.get("/auth/me")).data.data,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-medium">Welcome, {user.firstName}</h2>
        <p className="mt-1 text-sm text-slate-600">
          Everything below comes from the backend, not from local state.
        </p>
      </div>

      {meQuery.isError && <ErrorNote message={getApiErrorMessage(meQuery.error)} />}

      {meQuery.isSuccess && (
        <dl className="grid gap-px overflow-hidden rounded border border-slate-200 bg-slate-200 sm:grid-cols-2">
          {[
            ["Name", `${meQuery.data.firstName} ${meQuery.data.lastName}`],
            ["Email", meQuery.data.email],
            ["Role", meQuery.data.role],
            ["Status", meQuery.data.status],
          ].map(([label, value]) => (
            <div key={label} className="bg-white px-4 py-3">
              <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
              <dd className="mt-0.5 font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      <p className="text-sm text-slate-600">
        {user.role === "USER"
          ? "As a learner you can browse published courses only."
          : "As an author you can create, publish and delete your own draft courses."}
      </p>
    </div>
  );
}
