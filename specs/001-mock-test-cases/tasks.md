---

description: "Task list for feature implementation"
---

# Tasks: Mock 数据驱动单测用例生成

**Input**: Design documents from `/specs/001-mock-test-cases/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included (per plan.md testing standards).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create mock feature module barrel in `src/mock/index.ts`
- [X] T002 Update root exports to include mock module in `src/index.ts`
- [X] T003 [P] Add shared constants and defaults in `src/mock/constants.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 [P] Define core data models from data-model.md in `src/mock/types.ts`
- [X] T005 [P] Add error types and diagnostics helpers in `src/mock/errors.ts`
- [X] T006 [P] Implement deterministic PRNG wrapper in `src/mock/generation/prng.ts`
- [X] T007 [P] Implement in-memory stores for configs, datasets, reports in `src/mock/store/mockStores.ts`
- [X] T008 Implement configuration validation pipeline in `src/mock/validators/configValidator.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - 面向目标模块的用例生成 (Priority: P1) 🎯 MVP

**Goal**: 生成满足字段约束、边界与异常样本的 mock 数据集，作为单元测试用例输入

**Independent Test**: 在单一模块配置约束并生成 mock 数据集，验证样本满足约束并包含边界/异常值

### Tests for User Story 1

- [X] T016 [US1] Add unit tests for config validation in `src/__tests__/mockConfigValidation.test.ts`
- [X] T017 [US1] Add unit tests for dataset generation (boundary/exception) in `src/__tests__/mockDatasetGeneration.test.ts`

### Implementation for User Story 1

- [X] T009 [P] [US1] Implement constraint conflict detection in `src/mock/validators/constraintValidator.ts`
- [X] T010 [P] [US1] Implement field value generator for core types in `src/mock/generation/fieldValueGenerator.ts`
- [X] T011 [US1] Implement dataset builder with boundary/exception samples in `src/mock/generation/datasetBuilder.ts`
- [X] T012 [US1] Implement mock config service (create/list/get/validate) in `src/mock/services/mockConfigService.ts`
- [X] T013 [US1] Implement mock dataset service in `src/mock/services/mockDatasetService.ts`
- [X] T014 [US1] Wire API handlers for configs in `src/mock/api/mockConfigApi.ts`
- [X] T015 [US1] Wire API handler for dataset generation in `src/mock/api/mockDatasetApi.ts`

**Checkpoint**: User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - 可复用且一致的 mock 数据配置 (Priority: P2)

**Goal**: 支持固定随机种子 + 配置版本化，保证同配置可复用且生成结果可追溯

**Independent Test**: 使用同一配置重复生成数据，确认结果一致或可追溯

### Tests for User Story 2

- [X] T022 [US2] Add unit tests for deterministic generation in `src/__tests__/mockReproducibility.test.ts`

### Implementation for User Story 2

- [X] T018 [P] [US2] Implement config versioning utilities in `src/mock/versioning/configVersioning.ts`
- [X] T019 [US2] Persist config version + seed metadata in `src/mock/generation/datasetBuilder.ts`
- [X] T020 [US2] Update dataset request validation to support overrideSeed in `src/mock/api/mockDatasetApi.ts`
- [X] T021 [US2] Add reproducibility checks helper in `src/mock/generation/determinism.ts`

**Checkpoint**: User Story 2 should be independently testable with reproducible output

---

## Phase 5: User Story 3 - 覆盖提升可评估 (Priority: P3)

**Goal**: 输出分支覆盖率提升结果与未覆盖区域提示

**Independent Test**: 基于基线覆盖数据生成覆盖报告并验证增量与未覆盖分支输出

### Tests for User Story 3

- [X] T026 [US3] Add unit tests for coverage report generation in `src/__tests__/coverageReport.test.ts`

### Implementation for User Story 3

- [X] T023 [P] [US3] Implement coverage delta calculator in `src/mock/coverage/coverageEvaluator.ts`
- [X] T024 [US3] Implement coverage report service in `src/mock/services/coverageReportService.ts`
- [X] T025 [US3] Wire coverage report API handler in `src/mock/api/coverageReportApi.ts`
- [X] T027 [US3] Add Jest coverage config updates in `jest.config.ts`

**Checkpoint**: User Story 3 should be independently testable with coverage delta output

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T028 [P] Update quickstart steps to match API module exports in `specs/001-mock-test-cases/quickstart.md`
- [X] T029 [P] Add module usage notes in `README.md`
- [X] T030 Run quickstart validation checklist in `specs/001-mock-test-cases/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - no dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational - depends on dataset builder from US1
- **User Story 3 (P3)**: Can start after Foundational - depends on config/dataset outputs from US1

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Validation/models before services
- Services before API handlers
- Core implementation before integration

### Parallel Opportunities

- T003, T004, T005, T006, T007 can run in parallel
- Within US1: T009 and T010 can run in parallel
- Within US2: T018 and T021 can run in parallel
- Within US3: T023 can run in parallel with other US3 prep work

---

## Parallel Example: User Story 1

```bash
# Launch validation and generation utilities together:
Task: "Implement constraint conflict detection in src/mock/validators/constraintValidator.ts"
Task: "Implement field value generator for core types in src/mock/generation/fieldValueGenerator.ts"
```

---

## Parallel Example: User Story 2

```bash
# Launch versioning and determinism helpers together:
Task: "Implement config versioning utilities in src/mock/versioning/configVersioning.ts"
Task: "Add reproducibility checks helper in src/mock/generation/determinism.ts"
```

---

## Parallel Example: User Story 3

```bash
# Launch coverage evaluator before service wiring:
Task: "Implement coverage delta calculator in src/mock/coverage/coverageEvaluator.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. STOP and VALIDATE: Test User Story 1 independently

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deliver MVP
3. Add User Story 2 → Test independently → Deliver reproducibility
4. Add User Story 3 → Test independently → Deliver coverage reporting
5. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
