# F2 Code Quality Review - CSS Background Snapshot Width

VERDICT: REJECT

## Scope reviewed

Reviewed required context and files:

- `.omo/notepads/css-background-snapshot-width/learnings.md`
- `src/index.ts` around requested snapshotWidth regions: `EncodeOptions`/`resolveSnapshotWidth` (`89-110`), lazy thumbnail cache/plumbing (`165-333`), iframe width (`1635-1667`), collection width (`1922-1984`), encode wiring (`2058-2198`)
- `src/pageThumbnailDom.ts` full file, especially CSS capture allow/deny helpers and `snapshotWidth` offscreen width (`1-486`)
- `demo/demo.js`, `demo/demoDocumentSerialization.d.ts`, `demo/encode.html`
- Tests: `src/__tests__/htmlParser.test.ts`, `src/__tests__/renderer.test.ts`, `src/__tests__/typeExports.test.ts`, `src/__tests__/demoEncodeSnapshotWidth.test.ts`, `e2e/test_encode_snapshot_width.py`

Changed tracked files from `git diff --name-only`:

- `demo/demo.js`
- `demo/demoDocumentSerialization.d.ts`
- `demo/encode.html`
- `src/__tests__/htmlParser.test.ts`
- `src/__tests__/renderer.test.ts`
- `src/__tests__/typeExports.test.ts`
- `src/index.ts`
- `src/pageThumbnailDom.ts`

Also reviewed relevant untracked test additions from `git status --short`:

- `src/__tests__/demoEncodeSnapshotWidth.test.ts`
- `e2e/test_encode_snapshot_width.py`

## Positive findings

- `src/index.ts` implementation is mostly focused: `EncodeOptions.snapshotWidth?: number`, centralized `resolveSnapshotWidth()`, `html2canvas` `width/windowWidth` options only when defined, iframe/DOM collection width plumbing, and snapshot-width-aware thumbnail cache state.
- `src/pageThumbnailDom.ts` uses explicit visual allowlist/denylist helpers, skips zero rect/default/transparent/non-visual values, and keeps the new `snapshotWidth` option localized to wrapper width. Comments in implementation files are mostly Chinese and explain non-obvious behavior.
- `demo/encode.html` adds a single focused `data-role="snapshot-width"` number input near the existing exclude selector controls.
- No direct `console.log`, `@ts-ignore`, TODO/FIXME/HACK/xxx markers were found in the changed implementation/demo files reviewed.
- LSP diagnostics: no diagnostics in `src/index.ts`, `src/pageThumbnailDom.ts`, `src/__tests__/renderer.test.ts`, `src/__tests__/typeExports.test.ts`, `demo/demo.js`, or `demo/demoDocumentSerialization.d.ts`.

## Rejecting issues

### 1. Stale RED/TDD comments remain in committed tests

This is AI/TDD scaffolding slop and makes the tests misleading after Tasks 7/5 are complete.

- `src/__tests__/demoEncodeSnapshotWidth.test.ts:1-7` says these are "Failing tests (RED state)" and "must FAIL until Task 7 implements the feature".
- `src/__tests__/demoEncodeSnapshotWidth.test.ts:164-166` says real `demo.js` "does NOT yet read snapshotWidth", which is false after `demo/demo.js:104-110`.
- `src/__tests__/renderer.test.ts:1739-1744` still labels broad CSS capture tests as "RED tests" and says assertions should fail until Task 5 turns them green.
- `e2e/test_encode_snapshot_width.py:1-5` says snapshot-width E2E tests are "RED state" and "must FAIL" before Task 7.

These are not harmless wording nits: they directly contradict the current state and obscure whether the tests document intended behavior or historical scaffolding.

### 2. New demo unit test has many lint diagnostics and explicit `any`/non-null assertions

Required `lsp_diagnostics` found warnings in the new `src/__tests__/demoEncodeSnapshotWidth.test.ts`:

- `biome lint/suspicious/noExplicitAny`: lines `107`, `109`, `124`, `169`, `195`, `210`, `232`
- `biome lint/style/noNonNullAssertion`: lines `133`, `139`, `145`, `155` twice, `242`, `255`, `268`, `282`, `295`, `308`

The required grep also found `as any` at:

- `src/__tests__/demoEncodeSnapshotWidth.test.ts:109`, `195`, `232`
- `src/__tests__/htmlParser.test.ts:1736`

Some test casts can be acceptable when touching private APIs, but the new demo test overuses `any`/`!` around ordinary DOM queries. That fails the requested anti-slop/anti-pattern check.

### 3. Demo validation is inconsistent with core snapshotWidth contract

Core validation in `src/index.ts:94-110` requires integer `100 <= snapshotWidth <= 10000` and throws `Invalid snapshotWidth: ${value}`. The demo parser in `demo/demo.js:70-84` accepts any positive number and floors decimals:

- `demo/demo.js:78-83`: `Number(rawValue)`, rejects only non-finite or `<= 0`, then returns `Math.floor(parsed)`.
- `src/__tests__/demoEncodeSnapshotWidth.test.ts:265-276` explicitly expects `800.7` to be forwarded as `800`.

This duplicates validation logic but does not mirror the real API contract. Values like `1`, `99`, `10001`, or `800.7` are accepted/transformed by demo parsing and then either rejected later by `HtmlParser.encode` or silently changed before reaching it. That is not minimal/clear plumbing and creates confusing UX/error behavior.

### 4. `src/__tests__/demoEncodeSnapshotWidth.test.ts` is a brittle mock of `demo.js`, not a direct test

The file embeds a copied `ENCODE_HTML` fixture and a `simulateHandleParse()` implementation rather than importing/exercising the real `demo/demo.js` behavior. The stale comments confirm this was originally RED scaffolding. As a result, the test can pass while drifting from the real demo code; indeed it already bakes in the inconsistent flooring behavior above.

## Other notes

- Placeholder grep hits in `demo/encode.html` are normal HTML placeholder attributes, not stub placeholders.
- Existing `console.log` in `src/devLog.ts` and placeholder code in `demo/demoPreview.js` were outside the changed review scope.
- Comments in implementation files are mostly Chinese per project convention. New test comments are mixed English/Chinese; the bigger problem is that several English/Chinese comments are stale and false.

## Required checks performed

- Read required source/demo/test files and notepad context.
- Grep performed for `TODO|FIXME|HACK|xxx|as any|@ts-ignore|console.log|stub|placeholder`.
- LSP diagnostics performed for changed TS/d.ts/JS files listed above.

## Final verdict

REJECT. The implementation files are close, but the submitted test/demo quality is not acceptable: stale RED-state scaffolding remains, a new test file carries numerous `any`/non-null diagnostics, and demo snapshotWidth parsing is inconsistent with the core API validation contract.
