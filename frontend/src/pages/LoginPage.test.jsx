import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/api/client";
import { AuthProvider } from "@/auth/AuthContext";
import LoginPage from "@/pages/LoginPage";

vi.mock("@/api/client", () => ({
  api: { get: vi.fn(), post: vi.fn() },
  tokenStore: { access: null, refresh: null, save: vi.fn(), clear: vi.fn() },
  getApiErrorMessage: (error) => error?.response?.data?.error?.message ?? "Something went wrong.",
  getApiErrorProblems: () => [],
}));

function renderLogin() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the sign-in form", async () => {
    renderLogin();

    expect(await screen.findByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("shows the backend's message when the credentials are rejected", async () => {
    api.post.mockRejectedValue({
      response: { data: { error: { message: "Incorrect email or password." } } },
    });
    renderLogin();

    await userEvent.type(await screen.findByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Incorrect email or password.")).toBeInTheDocument();
  });

  it("fills the form from a development account shortcut", async () => {
    renderLogin();

    await userEvent.click(await screen.findByText("admin@example.com"));

    expect(screen.getByLabelText("Email")).toHaveValue("admin@example.com");
  });

  it("renders Google Workspace SSO button and requests authorization URL on click", async () => {
    api.get.mockResolvedValue({
      data: { data: { authorization_url: "https://accounts.google.com/o/oauth2/v2/auth?client_id=test" } },
    });
    renderLogin();

    const ssoBtn = await screen.findByRole("button", { name: /sign in with google workspace/i });
    expect(ssoBtn).toBeInTheDocument();

    await userEvent.click(ssoBtn);
    expect(api.get).toHaveBeenCalledWith(
      "/auth/sso/google/authorize",
      expect.objectContaining({
        params: expect.objectContaining({ redirect_uri: expect.stringContaining("/login") }),
      }),
    );
  });
});

