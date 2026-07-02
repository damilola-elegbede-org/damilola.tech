import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

import {
  TARGET_SKILL,
  generateResumeJson,
  readExistingResumeJson,
  writeResumeJson,
} from "../../scripts/generate-resume-json";

type ExistingResumeJson = Parameters<typeof generateResumeJson>[0];

function createExistingResumeJson(): ExistingResumeJson {
  return {
    name: "Damilola Elegbede",
    tagline: "Old tagline",
    experience: [
      {
        company: "Verily Life Sciences",
        title:
          "Engineering Manager - Cloud Infrastructure & Developer Experience",
        location: "Boulder, CO",
        dates: "Sep 2022 - Nov 2024",
        description: "Preserve this description",
        responsibilities: ["Old responsibility"],
      },
    ],
    skills: [
      {
        category: "Programming",
        items: ["Python"],
      },
      {
        category: "Leadership",
        items: ["Team Leadership"],
      },
    ],
    skillsAssessment: {
      expert: ["Leadership"],
      proficient: ["Python"],
      familiar: [TARGET_SKILL, "SQL"],
    },
  };
}

describe("generateResumeJson", () => {
  it("syncs tagline from resumeData.tagline", () => {
    const result = generateResumeJson(createExistingResumeJson());

    expect(result.tagline).toBe(
      "I build engineering organizations that deliver results, retain top talent, and develop leaders",
    );
  });

  it("maps experience responsibilities from resumeData.experiences highlights", () => {
    const result = generateResumeJson(createExistingResumeJson());

    expect(result.experience[0].responsibilities).toEqual([
      "Architected and executed enterprise-wide GCP cloud transformation supporting 30+ production systems, enabling successful launches of L'Oréal LDP and T1D healthcare platforms while establishing multi-cloud (GCP/AWS) capabilities.",
      "Built Cloud Infrastructure and developer experience functions from ground up, hiring and scaling an engineering team across multiple requisition cycles; promoted 3 ICs to senior roles, achieved high team retention with multiple internal transfers to the organization.",
      "Drove platform efficiency initiatives with significant CI efficiency improvement and establishing self-service infrastructure capabilities, improving developer velocity across a large engineering organization.",
      "Led executive stakeholder alignment across Engineering, Product, and Security organizations, influencing enterprise-wide policies on containerization, observability, and cloud architecture adopted by 15+ teams.",
      "Delivered complex multi-phase production launches including T1D platform (20+ systems, 5 deployment phases), managing cross-functional dependencies and security compliance requirements.",
      "Established Cumulus Office Hours support model and SLA framework, transforming infrastructure support from reactive to proactive while maintaining sub-4-hour resolution times for critical issues.",
    ]);
  });

  it("adds JavaScript/TypeScript to the Programming category when missing", () => {
    const result = generateResumeJson(createExistingResumeJson());
    const programming = result.skills.find(
      (category) => category.category === "Programming",
    );

    expect(programming?.items).toContain(TARGET_SKILL);
    expect(
      programming?.items.filter((item) => item === TARGET_SKILL),
    ).toHaveLength(1);
  });

  it("moves JavaScript/TypeScript into proficient and removes it from familiar", () => {
    const result = generateResumeJson(createExistingResumeJson());

    expect(result.skillsAssessment.proficient).toContain(TARGET_SKILL);
    expect(result.skillsAssessment.familiar).not.toContain(TARGET_SKILL);
  });
});

describe("readExistingResumeJson", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws a descriptive error when the JSON file is missing", () => {
    expect(() => readExistingResumeJson("/does/not/exist.json")).toThrow(
      "Local file not found: /does/not/exist.json",
    );
  });
});

describe("writeResumeJson", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes the generated JSON with a trailing newline", () => {
    const dir = mkdtempSync(join(tmpdir(), "generate-resume-json-"));
    const filePath = join(dir, "resume-full.json");

    try {
      writeResumeJson(createExistingResumeJson(), filePath);
      const raw = readFileSync(filePath, "utf-8");
      expect(raw.endsWith("\n")).toBe(true);
      const written = JSON.parse(raw) as ExistingResumeJson;
      expect(written).toEqual(createExistingResumeJson());
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("logs a descriptive error and exits when writing fails", () => {
    const dir = mkdtempSync(join(tmpdir(), "generate-resume-json-"));
    const filePath = join(dir, "missing", "resume-full.json");
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: string | number | null,
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    try {
      expect(() =>
        writeResumeJson(createExistingResumeJson(), filePath),
      ).toThrow("process.exit:1");
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(`❌ Failed to write ${filePath}:`),
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws on invalid JSON content", () => {
    const dir = mkdtempSync(join(tmpdir(), "generate-resume-json-"));
    const filePath = join(dir, "resume-full.json");

    try {
      writeFileSync(filePath, "{invalid json");
      expect(() => readExistingResumeJson(filePath)).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
