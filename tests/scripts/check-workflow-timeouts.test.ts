import { describe, expect, it } from "vitest";
import { checkAllWorkflows, checkWorkflowSource } from "../../scripts/check-workflow-timeouts";
import path from "node:path";

const REPO_ROOT = path.join(__dirname, "..", "..");

const CLEAN_YML = `name: Example

on:
  pull_request:

jobs:
  build:
    name: Build
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - run: echo hi

  test:
    name: Test
    runs-on: ubuntu-latest
    timeout-minutes: 8
    steps:
      - run: echo hi
`;

const MISSING_YML = `name: Example

on:
  pull_request:

jobs:
  build:
    name: Build
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - run: echo hi

  test:
    name: Test
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
`;

const REUSABLE_WORKFLOW_YML = `name: Example

on:
  pull_request:

jobs:
  call-shared:
    uses: ./.github/workflows/shared.yml
`;

describe("checkWorkflowSource (ENG-1952)", () => {
  it("reports no violations when every job carries timeout-minutes", () => {
    expect(checkWorkflowSource("example.yml", CLEAN_YML)).toEqual([]);
  });

  it("flags a job missing timeout-minutes", () => {
    const violations = checkWorkflowSource("example.yml", MISSING_YML);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ file: "example.yml", job: "test" });
  });

  it("flags every job independently when multiple are missing timeout-minutes", () => {
    const bothMissing = MISSING_YML.replace("    timeout-minutes: 5\n", "");
    const violations = checkWorkflowSource("example.yml", bothMissing);
    expect(violations.map((v) => v.job).sort()).toEqual(["build", "test"]);
  });

  it("does not flag a reusable workflow call (no runs-on of its own)", () => {
    expect(checkWorkflowSource("example.yml", REUSABLE_WORKFLOW_YML)).toEqual([]);
  });

  it("does not false-positive on a job named similarly to a YAML keyword", () => {
    const yml = `jobs:\n  timeout-check:\n    name: Timeout Check\n    runs-on: ubuntu-latest\n    timeout-minutes: 5\n    steps:\n      - run: echo hi\n`;
    expect(checkWorkflowSource("example.yml", yml)).toEqual([]);
  });
});

describe("checkAllWorkflows against the real .github/workflows (ENG-1952)", () => {
  it("every job in every committed workflow carries timeout-minutes", () => {
    const violations = checkAllWorkflows(path.join(REPO_ROOT, ".github", "workflows"));
    expect(violations).toEqual([]);
  });
});
