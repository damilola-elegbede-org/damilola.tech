import Link from "next/link";
import type { Metadata } from "next";
import { Badge } from "@/components/ui";
import type { ActivitySummary } from "@/lib/types/activity-summary";

export const metadata: Metadata = {
  title: "Engineering Activity — Cortex Agent Fleet | Damilola Elegbede",
  description:
    "Weekly engineering activity from the Cortex multi-agent system — PRs shipped, features delivered, and highlights from each week.",
};

async function getActivityData(): Promise<ActivitySummary[]> {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ??
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");

    const response = await fetch(`${baseUrl}/api/v1/activity?limit=52`, {
      headers: {
        "x-api-key": process.env.DK_API_KEY ?? "",
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) return [];

    const json = await response.json();
    return Array.isArray(json?.data) ? json.data : [];
  } catch {
    return [];
  }
}

function formatWeekEnding(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function CortexActivityPage() {
  const summaries = await getActivityData();

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--color-bg)",
        color: "var(--color-text)",
        padding: "2rem 1rem",
      }}
    >
      <div style={{ maxWidth: "768px", margin: "0 auto" }}>
        {/* Back navigation */}
        <Link
          href="/#projects"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
            fontSize: "0.875rem",
            color: "var(--color-text-muted)",
            textDecoration: "none",
            marginBottom: "2rem",
            transition: "color 0.15s",
          }}
          className="hover:text-[var(--color-accent)]"
        >
          ← Back to Projects
        </Link>

        {/* Page header */}
        <div style={{ marginBottom: "2.5rem" }}>
          <h1
            style={{
              fontSize: "1.875rem",
              fontWeight: 700,
              color: "var(--color-text)",
              marginBottom: "0.5rem",
            }}
          >
            Cortex Agent Fleet — Engineering Activity
          </h1>
          <p style={{ color: "var(--color-text-muted)", fontSize: "1rem" }}>
            Weekly engineering activity from the Cortex multi-agent system
          </p>
        </div>

        {/* Timeline */}
        {summaries.length === 0 ? (
          <div
            style={{
              padding: "3rem 2rem",
              textAlign: "center",
              borderRadius: "0.5rem",
              border: "1px solid var(--color-border)",
              backgroundColor: "var(--color-bg-alt)",
              color: "var(--color-text-muted)",
            }}
          >
            No engineering activity recorded yet. Check back after the first
            weekly summary.
          </div>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
          >
            {summaries.map((summary) => (
              <article
                key={summary.id}
                style={{
                  borderRadius: "0.5rem",
                  border: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-bg-alt)",
                  padding: "1.5rem",
                }}
              >
                {/* Week header */}
                <p
                  style={{
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "var(--color-accent)",
                    marginBottom: "0.5rem",
                    fontWeight: 600,
                  }}
                >
                  Week of {formatWeekEnding(summary.weekEnding)}
                </p>

                {/* Headline */}
                <h2
                  style={{
                    fontSize: "1.125rem",
                    fontWeight: 700,
                    color: "var(--color-text)",
                    marginBottom: "1rem",
                  }}
                >
                  {summary.headline}
                </h2>

                {/* Highlights */}
                {summary.highlights.length > 0 && (
                  <ul
                    style={{
                      listStyle: "none",
                      padding: 0,
                      margin: "0 0 1rem 0",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.375rem",
                    }}
                  >
                    {summary.highlights.map((highlight, i) => (
                      <li
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "0.5rem",
                          fontSize: "0.875rem",
                          color: "var(--color-text-muted)",
                        }}
                      >
                        <span
                          style={{
                            color: "var(--color-accent)",
                            flexShrink: 0,
                            marginTop: "0.125rem",
                          }}
                        >
                          ›
                        </span>
                        <span>{highlight}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Metrics */}
                <p
                  style={{
                    fontSize: "0.875rem",
                    color: "var(--color-text-muted)",
                    marginBottom: summary.tags.length > 0 ? "0.75rem" : 0,
                  }}
                >
                  <strong style={{ color: "var(--color-text)" }}>
                    {summary.metrics.prsShipped} PRs shipped
                  </strong>{" "}
                  ·{" "}
                  <strong style={{ color: "var(--color-text)" }}>
                    {summary.metrics.featuresDelivered} features delivered
                  </strong>
                </p>

                {/* Tags */}
                {summary.tags.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "0.375rem",
                    }}
                  >
                    {summary.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
