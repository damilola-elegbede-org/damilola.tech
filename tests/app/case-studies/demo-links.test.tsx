import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import AlcbfCaseStudy from "@/app/case-studies/alcbf/page";
import ScfDanceCaseStudy from "@/app/case-studies/scf-dance/page";

// ENG-1397: case studies had zero outbound GitHub/live-demo links. This adds
// the Live Demo link only (repos are private — GitHub link is a separate
// D-decision on visibility, tracked in the issue, not in this PR).

describe("case study Live Demo links", () => {
  it("alcbf page links to the live production domain", () => {
    render(<AlcbfCaseStudy />);
    const link = screen.getByRole("link", { name: /live demo/i });
    expect(link).toHaveAttribute("href", "https://www.alocubanoboulderfest.org/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("scf-dance page links to the live production domain", () => {
    render(<ScfDanceCaseStudy />);
    const link = screen.getByRole("link", { name: /live demo/i });
    expect(link).toHaveAttribute("href", "https://www.saborconflowdance.org/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
