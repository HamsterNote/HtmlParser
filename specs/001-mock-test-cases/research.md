# Research

## Deterministic Mock Data Generation

- Decision: Use a deterministic PRNG with an explicit seed stored in MockDataConfig; avoid Math.random in generation paths.
- Rationale: Seeded generators provide reproducible sequences; global randomness introduces flakiness and makes failures hard to reproduce.
- Alternatives considered: Use Faker's built-in seeding for data generation; use seedrandom as a pluggable PRNG library.
- Sources:
  - https://fakerjs.dev/api/faker (Faker seed support)
  - https://fakerjs.dev/guide/frameworks (test setup and seed reset)
  - https://github.com/davidbau/seedrandom (seeded PRNG library)

## Seed Isolation and Test Determinism

- Decision: Seed is set per generation run and never stored in global state; tests reset seed between cases when using generator helpers.
- Rationale: Per-run seeds guarantee reproducibility and avoid cross-test state leakage.
- Alternatives considered: Global seeding via test setup without per-run overrides.
- Sources:
  - https://jestjs.io/docs/setup-teardown (beforeEach/afterEach isolation)

## Branch Coverage Evaluation (Jest)

- Decision: Use Jest coverage collection with branch thresholds and coverage reporters (text, lcov, html); keep baseline as a stored coverage snapshot for delta reporting.
- Rationale: Jest provides built-in branch coverage thresholds and standard report formats; lcov and html support CI and human review.
- Alternatives considered: External coverage tooling outside Jest.
- Sources:
  - https://jestjs.io/docs/configuration#coveragethreshold-object
  - https://jestjs.io/docs/configuration#coveragereporters-array-string--string-options-
  - https://jestjs.io/docs/cli

## Dependency Guidance (@hamster-note/*)

- Decision: Rely on local type definitions and existing repository usage to shape contracts and models; avoid undocumented external assumptions.
- Rationale: No public documentation found for @hamster-note/document-parser and @hamster-note/types; repository type definitions are authoritative.
- Alternatives considered: Search for external docs or examples (none found).
- Sources:
  - https://www.npmjs.com/package/@hamster-note/document-parser
  - https://www.npmjs.com/package/@hamster-note/types

## Current Test/Config Baseline (Repo Observation)

- Decision: Align new tests with existing Jest + ts-jest setup; add coverage config in Jest and avoid introducing new runners.
- Rationale: Repository already uses Jest with ESM and ts-jest transforms; keeping the same stack reduces integration risk.
- Alternatives considered: Introduce a new test runner or coverage tool.
