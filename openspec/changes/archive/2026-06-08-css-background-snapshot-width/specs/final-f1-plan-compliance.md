# F1 Plan Compliance Audit - css-background-snapshot-width

## Verdict

REJECT

The implementation passes the required unit/E2E verification commands and satisfies most runtime behavior requirements, but it does not fully comply with the plan. Two blocking plan violations were found:

1. `resolveSnapshotWidth` is publicly exported from the package entry (`src/index.ts:94`), and `node -e "import('./dist/index.js').then(m=>console.log('resolveSnapshotWidth' in m, typeof m.resolveSnapshotWidth))"` prints `true function`. This violates the Must NOT Have guardrail: "No new public exports beyond what the `snapshotWidth` field requires." The plan also described the resolver as internal.
2. The OpenSpec change does not document the broad CSS capture scope or the override of the archived "no broad getComputedStyle full-copy" warning. The required files read (`change.md`, `scope.md`, `tests.md`) focus on `snapshotWidth`; `grep` for `getComputedStyle|broad|denylist|pseudo|URL|fetch|snapshotWidth` in the change folder found `snapshotWidth` references but no broad CSS/denylist/archived-warning override requirement in the main OpenSpec documents. `glob openspec/changes/add-css-background-snapshot-width/**/*` also found no `proposal.md` or `specs/**` delta files, despite the plan deliverables requiring them.

## Files Read

- `.omo/plans/css-background-snapshot-width.md` fully read.
- `.omo/notepads/css-background-snapshot-width/learnings.md` fully read.
- `openspec/changes/add-css-background-snapshot-width/change.md` fully read.
- `openspec/changes/add-css-background-snapshot-width/scope.md` fully read.
- `openspec/changes/add-css-background-snapshot-width/tests.md` fully read.
- `src/index.ts` fully read.
- `src/pageThumbnailDom.ts` fully read.
- `demo/encode.html` fully read.
- `demo/demo.js` fully read.
- `demo/demoDocumentSerialization.d.ts` fully read.
- `src/__tests__/htmlParser.test.ts` fully read.
- `src/__tests__/renderer.test.ts` fully read.
- `src/__tests__/typeExports.test.ts` fully read.
- `src/__tests__/demoEncodeSnapshotWidth.test.ts` fully read.
- `e2e/test_encode_snapshot_width.py` fully read.
- `package.json` read to check dependency surface.

## Verification Commands

- `npm test` passed: 15 suites, 200 tests.
- `npm run test:e2e` passed: 17 tests.
- `npm run lint` passed with repository placeholder output: `no-lint`.
- `node -e "import('./dist/index.js').then(m=>console.log(typeof m.HtmlParser))"` printed `function`.
- `git diff --name-only -- openspec/changes/archive` printed no output.
- `node -e "import('./dist/index.js').then(m=>console.log('resolveSnapshotWidth' in m, typeof m.resolveSnapshotWidth))"` printed `true function`.

## Must Have Audit

- `EncodeOptions` contains the requested option: PASS. `src/index.ts:89-92` has `excludeSelectors?: string[]` and `snapshotWidth?: number`.
- Exactly one new public option in `EncodeOptions`: PASS for options. No additional `EncodeOptions` fields were found in `src/index.ts` or the demo type mirror.
- Validation range and deterministic error: PASS in core encode API. `resolveSnapshotWidth()` uses `Number.isFinite`, `Number.isInteger`, `value < 100`, `value > 10000`, and throws `Invalid snapshotWidth: ${value}`.
- Omitted/`undefined` preserves behavior: PASS. `resolveSnapshotWidth()` returns `undefined`; `captureThumbnail()` only adds `width/windowWidth` when defined.
- Same width controls iframe/doc/offscreen/html2canvas: PASS. Evidence: `withIframeDocument(..., width = 1024)` uses `${width}px`; `collectTextsFromDocument(..., width = 1024)` sets document root width; `encode()` resolves once and forwards it; `buildOffscreenPageElement()` uses `options?.snapshotWidth ?? page.width`; `captureThumbnail()` sets `width` and `windowWidth`.
- Cache key includes scale and width: PASS. `buildLazyThumbnailFn()` compares `cachedScale`/`inFlightScale` and `cachedSnapshotWidth`/`inFlightSnapshotWidth`.
- Broad CSS capture with denylist: PASS in implementation. `src/pageThumbnailDom.ts` iterates computed and inline style candidate properties, keeps visual names/prefixes, and denies animation/transition, cursor, pointer-events, user-select, caret-color, scroll/overscroll, resize, vendor/internal/custom properties, etc.
- Gradients/already-resolved CSS background-image values copied as CSS values: PASS. `background-` is in visual prefixes, and renderer tests assert `linear-gradient(...)`, `background-size`, `background-position`, and `background-repeat`.
- No custom background URL fetching/resolution: PASS. Grep found no `fetch(`, `XMLHttpRequest`, or background URL resolver in the capture path.
- Pseudo-elements out of scope: PASS. `getComputedStyle(element)` is called without pseudo-element arguments; no `::before`/`::after` implementation was found.
- Demo optional number input: PASS. `demo/encode.html` has one `data-role="snapshot-width"` number input near exclude selector controls, and `demo/demo.js` reads it and adds `encodeOptions.snapshotWidth` when non-empty.
- OpenSpec documents archived-warning override and bounded broad-copy approach: FAIL. The active OpenSpec files read do not document this broad CSS requirement/override; no `proposal.md` or `specs/**` delta was present in the change folder.

## Must NOT Have Audit

- No new `EncodeOptions` fields beyond `snapshotWidth`: PASS.
- No CSS property added beyond broad visual-copy + denylist strategy: PASS based on `pageThumbnailDom.ts` categories and denylist.
- No html2canvas option changes beyond `snapshotWidth`: PASS for encode snapshot path; options remain `backgroundColor`, `scale`, `useCORS`, plus conditional `width/windowWidth`.
- No pseudo-element rendering: PASS.
- No custom background-image URL resolution or asset fetching: PASS for CSS background capture path.
- No Demo UI redesign: PASS; only a label/help text/input was added in the existing control section.
- No unrelated changes to `excludeSelectors`, `useCORS`, `scale`, or `backgroundColor` defaults: PASS by source review.
- No new dependencies: PASS by `package.json` review; dependency declarations remain the existing package set.
- No archived OpenSpec edits: PASS in working tree diff check (`git diff --name-only -- openspec/changes/archive` produced no output).
- No new public exports beyond `snapshotWidth` field: FAIL. `resolveSnapshotWidth` is exported from `src/index.ts` and from built `dist/index.js`.

## Additional Notes

- Demo parsing floors fractional input (`Math.floor(parsed)`), so a user-entered decimal like `800.7` becomes `800` before calling `HtmlParser.encode()`. Core `EncodeOptions` validation correctly rejects decimals, but this Demo behavior does not let library validation handle decimal invalidity. This is not needed for the rejection because the two blocking failures above are sufficient.
- The required verification commands pass, so this is a plan/scope compliance rejection, not a test failure rejection.
