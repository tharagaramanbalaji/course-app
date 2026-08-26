import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "@/auth/useAuth";

function Tab({ to, children }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `rounded px-3 py-1.5 text-sm font-medium ${
          isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-200"
        }`
      }
    >
      {children}
    </NavLink>
  );
}

export default function RootLayout() {
  const { user, isAdmin, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-6 py-3">
          <h1 className="text-lg font-semibold">Course Training Platform</h1>

          {user && (
            <nav className="flex gap-1">
              <Tab to="/">Dashboard</Tab>
              <Tab to="/courses">Courses</Tab>
              {isAdmin && <Tab to="/users">Users</Tab>}
            </nav>
          )}

          {user && (
            <div className="ml-auto flex items-center gap-3 text-sm">
              <span className="text-slate-600">
                {user.firstName} {user.lastName}
                <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  {user.role}
                </span>
              </span>
              <button
                type="button"
                onClick={logout}
                className="rounded border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-100"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
