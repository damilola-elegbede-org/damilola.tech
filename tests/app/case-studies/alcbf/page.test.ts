import { describe, it, expect } from "vitest";
import { metadata } from "@/app/case-studies/alcbf/page";

const TITLE = "A Lo Cubano Boulder Fest — Case Study | Damilola Elegbede";
const DESC =
  "How I debugged a production ticketing platform weeks before a live dance event — fixing analytics undercounting, QR atomicity failures, and silent data corruption with 7 concurrent PRs under real deadline pressure.";
const OG_DESC =
  "How I debugged a production ticketing platform weeks before a live dance event — fixing analytics undercounting, QR atomicity failures, and silent data corruption with 7 concurrent PRs.";

describe("case-studies/alcbf/page metadata", () => {
  it("exports correct title and description", () => {
    expect(metadata.title).toBe(TITLE);
    expect(metadata.description).toBe(DESC);
  });

  it("exports canonical URL", () => {
    expect(metadata.alternates?.canonical).toBe(
      "https://damilola.tech/case-studies/alcbf"
    );
  });

  it("exports Open Graph metadata", () => {
    const og = metadata.openGraph as Record<string, unknown>;
    expect(og.title).toBe(TITLE);
    expect(og.description).toBe(OG_DESC);
    expect(og.type).toBe("website");
    expect(og.url).toBe("https://damilola.tech/case-studies/alcbf");
  });

  it("exports Twitter card metadata", () => {
    const twitter = metadata.twitter as Record<string, unknown>;
    expect(twitter.card).toBe("summary_large_image");
    expect(twitter.title).toBe(TITLE);
    expect(twitter.description).toBe(OG_DESC);
  });
});
