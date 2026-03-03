import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ActivitySummary } from "@/lib/types/activity-summary";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const mockSummary: ActivitySummary = {
  id: "abc-123",
  weekEnding: "2026-02-22",
  headline: "Shipped the activity page",
  highlights: ["Built dedicated page", "Added back navigation"],
  metrics: { prsShipped: 4, testsPassing: 55, featuresDelivered: 3 },
  tags: ["frontend", "dx"],
  createdAt: "2026-02-22T12:00:00.000Z",
};

// We test the page as an async server component by calling it directly
// and awaiting the result rendered with render()
async function renderPage(summaries: ActivitySummary[]) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ data: summaries }),
  } as unknown as Response);

  // Dynamic import so mock is in place first
  const { default: Page } = await import(
    "@/app/projects/cortex/activity/page"
  );
  const jsx = await Page();
  render(jsx);
}

describe("CortexActivityPage", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("renders back navigation link", async () => {
    await renderPage([]);
    const link = screen.getByRole("link", { name: /back to projects/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/#projects");
  });

  it("renders page title", async () => {
    await renderPage([]);
    expect(
      screen.getByRole("heading", {
        name: /cortex agent fleet — engineering activity/i,
      }),
    ).toBeInTheDocument();
  });

  it("renders empty state when no data", async () => {
    await renderPage([]);
    expect(
      screen.getByText(/no engineering activity recorded yet/i),
    ).toBeInTheDocument();
  });

  it("renders activity summaries when data exists", async () => {
    await renderPage([mockSummary]);
    expect(screen.getByText("Shipped the activity page")).toBeInTheDocument();
    expect(screen.getByText("Built dedicated page")).toBeInTheDocument();
    expect(screen.getByText("Added back navigation")).toBeInTheDocument();
  });

  it("renders metrics for each summary", async () => {
    await renderPage([mockSummary]);
    expect(screen.getByText("4 PRs shipped")).toBeInTheDocument();
    expect(screen.getByText("3 features delivered")).toBeInTheDocument();
  });

  it("renders tags as badges for each summary", async () => {
    await renderPage([mockSummary]);
    expect(screen.getByText("frontend")).toBeInTheDocument();
    expect(screen.getByText("dx")).toBeInTheDocument();
  });

  it("renders week ending date", async () => {
    await renderPage([mockSummary]);
    expect(screen.getByText(/week of/i)).toBeInTheDocument();
    expect(screen.getByText(/february 22, 2026/i)).toBeInTheDocument();
  });
});
