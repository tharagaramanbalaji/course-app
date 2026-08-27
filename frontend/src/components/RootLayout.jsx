import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";

import { useAuth } from "@/auth/useAuth";

function NavPillItem({ to, children }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `relative px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 ${
          isActive
            ? "bg-[#0A6847] text-white shadow-xs"
            : "text-[#063F2A] hover:bg-[#7ABA78]/30 hover:text-black"
        }`
      }
    >
      {children}
    </NavLink>
  );
}

function getInitials(firstName = "", lastName = "") {
  const f = firstName.trim()[0] || "";
  const l = lastName.trim()[0] || "";
  return (f + l).toUpperCase() || "U";
}

export default function RootLayout() {
  const { user, isAdmin, isAuthor, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFBF9] text-slate-900">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 transition-all">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2 group transition-transform hover:scale-[1.02]">
            <img
              src="/logo.png"
              alt="Learn Flow Logo"
              className="h-10 w-auto object-contain"
              onError={(e) => {
                // Fallback text logo if image not available
                e.target.style.display = "none";
              }}
            />
            <span className="text-xl font-extrabold tracking-tight text-slate-900 group-hover:text-brand-600 transition-colors">
              Learn<span className="text-brand-600">Flow</span>
            </span>
          </Link>

          {/* Center Pill Nav Bar */}
          {user && (
            <nav className="nav-pill-container rounded-full px-2.5 py-1.5 flex items-center gap-1 shadow-xs border border-accent-300/50">
              <NavPillItem to="/">Dashboard</NavPillItem>
              <NavPillItem to="/courses">Courses</NavPillItem>
              {isAdmin && <NavPillItem to="/users">Users</NavPillItem>}
              {isAuthor && <NavPillItem to="/admin">Analytics</NavPillItem>}
              <NavPillItem to="/settings">Settings</NavPillItem>
            </nav>
          )}

          {/* Right User Avatar / Actions */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0A6847] text-sm font-bold text-white shadow-sm ring-2 ring-transparent transition hover:ring-[#7ABA78] hover:shadow-md focus:outline-none"
                  title={`${user.firstName} ${user.lastName}`}
                  aria-label="User profile menu"
                >
                  {getInitials(user.firstName, user.lastName)}
                </button>

                {/* User Dropdown Menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-3 px-2">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0A6847] text-sm font-bold text-white">
                        {getInitials(user.firstName, user.lastName)}
                      </div>
                      <div className="overflow-hidden">
                        <p className="truncate text-sm font-bold text-slate-900">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="truncate text-xs text-slate-500">{user.email}</p>
                        <span className="mt-1 inline-block rounded-full bg-[#E8F5E9] px-2 py-0.5 text-[10px] font-bold text-[#0A6847] uppercase tracking-wider">
                          {user.role}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 space-y-1">
                      <Link
                        to="/"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex w-full items-center rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition"
                      >
                        Dashboard
                      </Link>
                      <Link
                        to="/courses"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex w-full items-center rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition"
                      >
                        Browse Courses
                      </Link>
                      {isAuthor && (
                        <Link
                          to="/admin"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex w-full items-center rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition"
                        >
                          Instructor Analytics
                        </Link>
                      )}
                      <Link
                        to="/settings"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex w-full items-center rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition"
                      >
                        Settings
                      </Link>
                      <div className="my-1 border-t border-slate-100" />
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          logout();
                        }}
                        className="flex w-full items-center rounded-xl px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                className="rounded-full bg-[#0A6847] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#085438] transition hover:shadow-md"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Modern Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-6 mt-auto">
        <div className="mx-auto max-w-7xl px-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">LearnFlow</span>
            <span>&bull;</span>
            <span>Enterprise Course Training Platform</span>
          </div>
          <p>&copy; {new Date().getFullYear()} LearnFlow. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
