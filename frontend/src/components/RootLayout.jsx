import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "@/auth/useAuth";
import { dropdownVariants, pageVariants } from "@/utils/motion";

function NavTabItem({ to, children }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `relative px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all duration-150 ${
          isActive
            ? "bg-[#E8F5E9] text-[#0A6847] font-bold shadow-xs border border-[#0A6847]/20"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
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
  const { user, isAuthor, isAdmin, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const location = useLocation();

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
      {/* Top Enterprise Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs transition-all">
        <div className="mx-auto flex max-w-[1536px] w-[92%] items-center justify-between px-2 sm:px-4 py-2.5">
          {/* Brand Logo */}
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2.5 transition-transform hover:scale-[1.01]">
              <img src="/logo.png" alt="LearnFlow" className="h-9 w-auto object-contain" />
              <span
                className="text-xl font-extrabold tracking-tight text-slate-900 font-brand-logo"
                style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}
              >
                Learn<span className="text-[#0A6847]">Flow</span>
              </span>
            </Link>

            {/* Desktop Navigation Links */}
            {user && (
              <nav className="hidden md:flex items-center gap-1.5 ml-4 pl-4 border-l border-slate-200">
                <NavTabItem to="/">Dashboard</NavTabItem>
                <NavTabItem to="/courses">Courses</NavTabItem>
                {isAuthor && <NavTabItem to="/admin">Analytics</NavTabItem>}
                {isAdmin && <NavTabItem to="/users">Users</NavTabItem>}
                <NavTabItem to="/settings">Settings</NavTabItem>
              </nav>
            )}
          </div>

          {/* Right User Avatar / Actions */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-slate-100 transition focus:outline-none"
                  title={`${user.firstName} ${user.lastName}`}
                  aria-label="User profile menu"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0A6847] text-xs font-bold text-white shadow-xs">
                    {getInitials(user.firstName, user.lastName)}
                  </div>
                  <div className="hidden lg:block text-left">
                    <p className="text-xs font-bold text-slate-800 leading-tight">
                      {user.firstName} {user.lastName}
                    </p>
                    {user.role !== "USER" && (
                      <p className="text-[10px] font-semibold text-[#0A6847] uppercase tracking-wider">
                        {user.role}
                      </p>
                    )}
                  </div>
                  <svg className="w-4 h-4 text-slate-400 hidden lg:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Animated User Dropdown Menu */}
                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      variants={dropdownVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl ring-1 ring-black/5 z-50 origin-top-right"
                    >
                      <div className="flex items-center gap-3 border-b border-slate-100 pb-3 px-2">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0A6847] text-sm font-bold text-white">
                          {getInitials(user.firstName, user.lastName)}
                        </div>
                        <div className="overflow-hidden">
                          <p className="truncate text-sm font-bold text-slate-900">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="truncate text-xs text-slate-500">{user.email}</p>
                          {user.role !== "USER" && (
                            <span className="mt-1 inline-block rounded-md bg-[#E8F5E9] px-2 py-0.5 text-[10px] font-bold text-[#0A6847] uppercase tracking-wider border border-[#0A6847]/20">
                              {user.role}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 space-y-1">
                        <Link
                          to="/"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex w-full items-center rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition"
                        >
                          Dashboard
                        </Link>
                        <Link
                          to="/courses"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex w-full items-center rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition"
                        >
                          Browse Courses
                        </Link>
                        {isAuthor && (
                          <Link
                            to="/admin"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex w-full items-center rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition"
                          >
                            Instructor Analytics
                          </Link>
                        )}
                        {isAdmin && (
                          <Link
                            to="/users"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex w-full items-center rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition"
                          >
                            User Management
                          </Link>
                        )}
                        <Link
                          to="/settings"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex w-full items-center rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition"
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
                          className="flex w-full items-center rounded-lg px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition"
                        >
                          Sign out
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link
                to="/login"
                className="rounded-xl bg-[#0A6847] px-5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-[#085438] transition hover:shadow-sm"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto w-[92%] max-w-[1536px] flex-1 px-2 sm:px-4 py-6 sm:py-8">
        <Outlet />
      </main>

      {/* Modern Wide Footer */}
      <footer className="border-t border-slate-200/90 bg-white py-4 mt-auto">
        <div className="mx-auto max-w-[1536px] w-[92%] px-2 sm:px-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 font-brand-logo" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>LearnFlow</span>
            <span>&bull;</span>
            <span>Enterprise Learning Management & Compliance System</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-400">Role-Based Access Control</span>
            <span>&bull;</span>
            <p>&copy; {new Date().getFullYear()} LearnFlow. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
