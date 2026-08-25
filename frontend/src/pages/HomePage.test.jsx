import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import HomePage from "@/pages/HomePage";

vi.mock("@/api/client", () => ({
  api: { get: vi.fn().mockResolvedValue({ data: { status: "ok" } }) },
  getApiErrorMessage: vi.fn(),
}));

function withProviders(ui) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>;
}

describe("HomePage", () => {
  it("renders the setup heading", () => {
    render(withProviders(<HomePage />));

    expect(screen.getByText("Setup complete")).toBeInTheDocument();
  });

  it("shows the backend status returned by the API", async () => {
    render(withProviders(<HomePage />));

    expect(await screen.findByText("ok")).toBeInTheDocument();
  });
});
