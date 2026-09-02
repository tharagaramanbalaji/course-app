import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import MarkdownRenderer from "./MarkdownRenderer";

describe("MarkdownRenderer", () => {
  it("renders italic markdown syntax (*text*) as italic without literal asterisks", () => {
    const { container } = render(<MarkdownRenderer content="*Components, JSX, and Props*" />);
    const em = container.querySelector("em");
    expect(em).not.toBeNull();
    expect(em.textContent).toBe("Components, JSX, and Props");
    expect(container.textContent).not.toContain("*Components");
  });

  it("renders bold markdown syntax (**text**) as strong", () => {
    const { container } = render(<MarkdownRenderer content="**Important Concept**" />);
    const strong = container.querySelector("strong");
    expect(strong).not.toBeNull();
    expect(strong.textContent).toBe("Important Concept");
  });

  it("renders inline code (`code`) correctly", () => {
    const { container } = render(<MarkdownRenderer content="Use `npm install` to proceed." />);
    const code = container.querySelector("code");
    expect(code).not.toBeNull();
    expect(code.textContent).toBe("npm install");
  });

  it("renders links ([label](url)) as clickable anchors", () => {
    const { container } = render(<MarkdownRenderer content="Check the [Documentation](https://example.com) for details." />);
    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link.textContent).toBe("Documentation");
    expect(link.getAttribute("href")).toBe("https://example.com");
  });

  it("renders strikethrough (~~text~~) correctly", () => {
    const { container } = render(<MarkdownRenderer content="~~Old deprecated syntax~~" />);
    const del = container.querySelector("del");
    expect(del).not.toBeNull();
    expect(del.textContent).toBe("Old deprecated syntax");
  });

  it("renders markdown tables properly", () => {
    const tableMd = `| Feature | Status |
|---|---|
| Authn | Complete |
| Tests | Passing |`;
    const { container } = render(<MarkdownRenderer content={tableMd} />);
    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    expect(container.textContent).toContain("Authn");
    expect(container.textContent).toContain("Passing");
  });
});
