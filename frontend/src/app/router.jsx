import { createBrowserRouter } from "react-router-dom";

import ProtectedRoute from "@/components/ProtectedRoute";
import RootLayout from "@/components/RootLayout";
import AdminDashboardPage from "@/pages/AdminDashboardPage";
import CourseAssignmentsPage from "@/pages/CourseAssignmentsPage";
import CourseManagePage from "@/pages/CourseManagePage";
import CoursesPage from "@/pages/CoursesPage";
import DashboardPage from "@/pages/DashboardPage";
import LearnPage from "@/pages/LearnPage";
import LoginPage from "@/pages/LoginPage";
import NotFoundPage from "@/pages/NotFoundPage";
import SettingsPage from "@/pages/SettingsPage";
import UsersPage from "@/pages/UsersPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { path: "login", element: <LoginPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: "courses", element: <CoursesPage /> },
          { path: "learn/courses/:courseId", element: <LearnPage /> },
          { path: "settings", element: <SettingsPage /> },
        ],
      },
      {
        // Authoring and reporting. The backend enforces this too; the guard
        // only avoids showing a page that would fail.
        element: <ProtectedRoute roles={["ADMIN", "INSTRUCTOR"]} />,
        children: [
          { path: "admin", element: <AdminDashboardPage /> },
          { path: "courses/:courseId/manage", element: <CourseManagePage /> },
          { path: "courses/:courseId/assignments", element: <CourseAssignmentsPage /> },
        ],
      },
      {
        element: <ProtectedRoute roles={["ADMIN"]} />,
        children: [{ path: "users", element: <UsersPage /> }],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
