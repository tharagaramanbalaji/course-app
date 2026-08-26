import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "@/auth/useAuth";

/** Gates a route on being signed in, and optionally on role. */
export default function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <p className="text-slate-500">Loading...</p>;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (roles && !roles.includes(user.role)) {
    return (
      <p className="rounded border border-amber-300 bg-amber-50 p-4 text-amber-800">
        Your role ({user.role}) does not have access to this page.
      </p>
    );
  }
  return <Outlet />;
}
