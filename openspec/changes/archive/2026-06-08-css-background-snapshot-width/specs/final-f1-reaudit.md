# Final F1 Re-audit: Plan Compliance

Plan: `.omo/plans/css-background-snapshot-width.md`
Change: `openspec/changes/add-css-background-snapshot-width/`
Verdict: **REJECT**

## Files read

- `.omo/plans/css-background-snapshot-width.md`
- `openspec/changes/add-css-background-snapshot-width/change.md`
- `openspec/changes/add-css-background-snapshot-width/scope.md`
- `openspec/changes/add-css-background-snapshot-width/tests.md`
- `openspec/changes/add-css-background-snapshot-width/proposal.md`
- `src/index.ts`
- `src/pageThumbnailDom.ts`
- `demo/demo.js`
- `demo/encode.html`
- `demo/demoDocumentSerialization.d.ts`

Attempted reads for the plan-delivered OpenSpec spec deltas failed because both files are missing:

- `openspec/changes/add-css-background-snapshot-width/specs/htmlparser-encode-background/spec.md`
- `openspec/changes/add-css-background-snapshot-width/specs/htmlparser-demo-page/spec.md`

## Required command evidence

- `grep "export.*resolveSnapshotWidth" src --include="*.ts"`: no matches.
- `grep "resolveSnapshotWidth" src --include="*.ts"`: only `src/index.ts:94` internal function definition and `src/index.ts:2098` internal call.
- `grep "archive" .`: found existing archive references and `proposal.md` line `No archive edits`; no evidence of current archive-path modifications.
- `GIT_MASTER=1 git status --short openspec/changes/archive`: no output.
- `GIT_MASTER=1 git diff --name-only`: no archive paths.
- `GIT_MASTER=1 git diff --staged --name-only`: no output.
- `npm test`: PASS — 15 test suites passed, 202 tests passed.
- `npm run test:e2e`: PASS — build completed, 17 E2E tests passed.
- `npm run lint`: PASS as repository placeholder — output `no-lint`.

## Must Have audit

- `EncodeOptions` contains exactly one new public option, `snapshotWidth?: number`: PASS. `src/index.ts` shows `excludeSelectors?: string[]` plus `snapshotWidth?: number`; no additional option fields were found.
- `snapshotWidth` unit/validation: PASS. Core `resolveSnapshotWidth()` accepts finite integers in `[100, 10000]`, returns `undefined` when omitted, and throws `Invalid snapshotWidth: ${value}` for invalid defined values.
- Omitted or `undefined` preserves behavior: PASS by implementation defaults (`withIframeDocument(..., width = 1024)`, `collectTextsFromDocument(..., width = 1024)`) and passing tests.
- Same resolved width controls offscreen layout and html2canvas `width` + `windowWidth`: PASS. `src/index.ts` passes `snapshotWidth` to iframe, document collection, lazy thumbnail, and html2canvas options; `src/pageThumbnailDom.ts` uses `options?.snapshotWidth ?? page.width` for wrapper width.
- `captureThumbnail()` cache key includes `scale` and resolved snapshot width: PASS. `cachedSnapshotWidth` and `inFlightSnapshotWidth` are compared alongside scale.
- CSS capture uses broad computed visual style copy with denylist: PASS in implementation. `src/pageThumbnailDom.ts` iterates computed + inline candidate properties, filters visual categories, and denies animation/transition/interaction/vendor/internal/custom/noisy properties.
- Gradients and resolved CSS `background-image` values are kept as CSS values: PASS for bounded CSS value copying; background properties are visual candidates and URL value denial exempts background properties per `scope.md`.
- No custom background URL fetching/resolution: PASS. No custom URL fetcher was found in the CSS capture path.
- Pseudo-elements out of scope: PASS. Capture traverses element nodes only and does not query `::before`/`::after`.
- Demo optional number input near exclude selector controls; empty means no option: PASS. `demo/encode.html` has `[data-role="snapshot-width"]`; `demo/demo.js` omits `snapshotWidth` for empty input.
- OpenSpec documents override of archived “no broad getComputedStyle full-copy” warning: FAIL. `proposal.md`/`scope.md` document bounded broad-copy and denylist, but do not explicitly document the required override of the archived warning; the plan requires this explicit OpenSpec statement.

## Must NOT Have audit

- No new `EncodeOptions` fields beyond `snapshotWidth`: PASS.
- No CSS property added beyond bounded broad visual-copy + denylist: PASS by inspected `pageThumbnailDom.ts` categories/denylist.
- No html2canvas option changes beyond `snapshotWidth`: PASS. Diff shows only conditional `width` and `windowWidth` added; `backgroundColor`, `scale`, `useCORS` remain unchanged.
- No pseudo-element rendering: PASS.
- No custom background-image URL resolution or asset fetching: PASS.
- No Demo UI redesign: PASS. A single input/label/help text was added near existing controls.
- No unrelated test/source changes observed in changed path list: PASS for audit scope; changed files are snapshot/CSS/demo/test/OpenSpec related.
- No general unrelated improvements to `pageThumbnailDom.ts`: PASS; changes are style capture and width plumbing related.
- No new public exports beyond the `snapshotWidth` field requirement: PASS. `export.*resolveSnapshotWidth` grep returned no matches; `src/index.ts` diff shows no added public export for the resolver.
- No new dependencies: PASS. No package manifest/lockfile changes are present in git status.
- No changes to `excludeSelectors`, `useCORS`, `scale`, or `backgroundColor` defaults: PASS.
- No edits to archived OpenSpec changes: PASS. Archive git status and diff path checks are empty.

## Additional TODO / deliverable audit findings

1. **Missing OpenSpec spec delta files — FAIL.** The plan deliverables and Task 1 acceptance criteria require:
   - `openspec/changes/add-css-background-snapshot-width/specs/htmlparser-demo-page/spec.md`
   - `openspec/changes/add-css-background-snapshot-width/specs/htmlparser-encode-background/spec.md`

   Both files are absent. The change directory currently contains top-level docs and evidence, but no `specs/` directory. This means OpenSpec is still incomplete against the plan even though `proposal.md` exists and `scope.md` contains CSS capture details.

2. **Demo input lacks planned HTML constraints — FAIL.** Task 7 requested the number input include `min="100"`, `max="10000"`, and `step="1"`. `demo/encode.html` has `type="number"` and `placeholder="1024"`, but no `min`, `max`, or `step` attributes. Runtime validation in `demo/demo.js` is correct, but the TODO-level UI acceptance is not fully met.

## Final reasoning

The previous resolver-export problem is fixed: `resolveSnapshotWidth` is internal only, and no forbidden public export is present. Demo runtime parsing now matches core validation. Unit tests, E2E tests, build, and lint placeholder all pass.

However, F1 must verify the implementation against every plan deliverable and TODO, not only runtime behavior. The OpenSpec change remains non-compliant because the two required spec delta files are missing and the required archived-warning override is not explicitly documented. The Demo HTML also misses the planned `min`/`max`/`step` attributes. These are plan-compliance failures, so F1 cannot approve.

VERDICT: **REJECT**
