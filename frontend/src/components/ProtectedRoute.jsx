import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "@/auth/useAuth";

/** Gates a route on being signed in, and optionally on role. */
export default function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-[#0A6847]" />
        Loading...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="card border-amber-200 bg-amber-50 text-amber-800">
        Your role ({user.role}) does not have access to this page.
      </div>
    );
  }
  return <Outlet />;
}
