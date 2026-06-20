import { describe, it, expect } from "vitest";
import { metadata } from "@/app/case-studies/page";

describe("case-studies/page metadata", () => {
  it("exports correct title and description", () => {
    expect(metadata.title).toBe("Case Studies | Damilola Elegbede");
    expect(metadata.description).toBe(
      "Deep-dives into production engineering problems — how I diagnosed, fixed, and shipped complex systems under real constraints."
    );
  });

  it("exports canonical URL", () => {
    expect(metadata.alternates?.canonical).toBe(
      "https://damilola.tech/case-studies"
    );
  });

  it("exports Open Graph metadata", () => {
    const og = metadata.openGraph as Record<string, unknown>;
    expect(og.title).toBe("Case Studies | Damilola Elegbede");
    expect(og.description).toBe(
      "Deep-dives into production engineering problems — how I diagnosed, fixed, and shipped complex systems under real constraints."
    );
    expect(og.type).toBe("website");
    expect(og.url).toBe("https://damilola.tech/case-studies");
  });

  it("exports Twitter card metadata", () => {
    const twitter = metadata.twitter as Record<string, unknown>;
    expect(twitter.card).toBe("summary_large_image");
    expect(twitter.title).toBe("Case Studies | Damilola Elegbede");
    expect(twitter.description).toBe(
      "Deep-dives into production engineering problems — how I diagnosed, fixed, and shipped complex systems under real constraints."
    );
  });
});
