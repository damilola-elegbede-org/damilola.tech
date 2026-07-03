import { describe, it, expect } from "vitest";
import { metadata } from "@/app/case-studies/scf-dance/page";

const TITLE = "Salsa Con Flow Dance — Case Study | Damilola Elegbede";
const DESC =
  "How I built and hardened a full-stack booking platform for a professional Latin dance instructor — delivering CI reliability, security layers, and Node.js 20 upgrade before a GitHub Actions deprecation deadline.";

describe("case-studies/scf-dance/page metadata", () => {
  it("exports correct title and description", () => {
    expect(metadata.title).toBe(TITLE);
    expect(metadata.description).toBe(DESC);
  });

  it("exports canonical URL", () => {
    expect(metadata.alternates?.canonical).toBe(
      "https://damilola.tech/case-studies/scf-dance"
    );
  });

  it("exports Open Graph metadata", () => {
    const og = metadata.openGraph as Record<string, unknown>;
    expect(og.title).toBe(TITLE);
    expect(og.description).toBe(DESC);
    expect(og.type).toBe("website");
    expect(og.url).toBe("https://damilola.tech/case-studies/scf-dance");
  });

  it("exports Twitter card metadata", () => {
    const twitter = metadata.twitter as Record<string, unknown>;
    expect(twitter.card).toBe("summary_large_image");
    expect(twitter.title).toBe(TITLE);
    expect(twitter.description).toBe(DESC);
  });
});
