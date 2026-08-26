import { createBrowserRouter } from "react-router-dom";

import ProtectedRoute from "@/components/ProtectedRoute";
import RootLayout from "@/components/RootLayout";
import CourseManagePage from "@/pages/CourseManagePage";
import CoursesPage from "@/pages/CoursesPage";
import DashboardPage from "@/pages/DashboardPage";
import LoginPage from "@/pages/LoginPage";
import NotFoundPage from "@/pages/NotFoundPage";
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
        ],
      },
      {
        element: <ProtectedRoute roles={["ADMIN", "INSTRUCTOR"]} />,
        children: [{ path: "courses/:courseId/manage", element: <CourseManagePage /> }],
      },
      {
        // Role is enforced by the backend too; this only hides the page.
        element: <ProtectedRoute roles={["ADMIN"]} />,
        children: [{ path: "users", element: <UsersPage /> }],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
