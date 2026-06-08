# Final F2 Code Quality Re-audit

## Verdict

REJECT

## Scope Reviewed

Changed tracked files from `git status --short` / `git diff --stat`:

- `demo/demo.js`
- `demo/demoDocumentSerialization.d.ts`
- `demo/encode.html`
- `src/__tests__/htmlParser.test.ts`
- `src/__tests__/renderer.test.ts`
- `src/__tests__/typeExports.test.ts`
- `src/index.ts`
- `src/pageThumbnailDom.ts`

Untracked files also reviewed because they are part of the working tree changes:

- `e2e/test_encode_snapshot_width.py`
- `src/__tests__/demoEncodeSnapshotWidth.test.ts`
- `openspec/changes/add-css-background-snapshot-width/**`

## Required Checks

### `src/__tests__/demoEncodeSnapshotWidth.test.ts`

- Read full file.
- No `RED` or must-fail comments found in this file.
- No `as any` found.
- No non-null assertion pattern observed in the reviewed file; helper-based null handling is used instead.
- Tests are focused on snapshot-width demo DOM structure, option forwarding, validation, and `EncodeOptions` typing.

### `src/__tests__/htmlParser.test.ts` around line 1736

- Read lines 1680-1859.
- `encodeHtmlWith` is now typed as `(html: string, options: EncodeOptions) => HtmlParser.encode(...)`.
- The prior `options as any` issue is removed.
- Valid values cover `100`, `640`, `10000`; invalid values cover `99`, `10001`, `0`, `-1`, `NaN`, `Infinity`, `1.5`.

### `demo/demo.js` `parseSnapshotWidth()`

- Read full file.
- Validation matches core `resolveSnapshotWidth()` in `src/index.ts`: defined values must be finite integers in `[100, 10000]`; invalid values throw `Invalid snapshotWidth: ${value}`.
- Empty input returns `undefined`, preserving default behavior.

### `src/index.ts` and `src/pageThumbnailDom.ts`

- Read relevant core validation and thumbnail propagation in `src/index.ts` lines 89-110 and 220-333.
- Read full `src/pageThumbnailDom.ts`.
- No TODO/FIXME, `as any`, or `@ts-ignore` found in these files by grep.
- `src/index.ts` still contains `as unknown as` casts in existing seams, but the requested `as any` pattern is absent.

## Grep Evidence

Command pattern used through grep: `TODO|FIXME|as any|@ts-ignore|console\.log|RED|must FAIL`.

Findings:

- No matches in `demo/` changed files.
- No `as any` or `@ts-ignore` matches in reviewed changed files.
- `src/devLog.ts` has `console.log`, but that file is not changed in this working tree.
- `src/__tests__/renderer.test.ts:1739-1744` still contains RED-state comments:
  - `Task 4: broad CSS visual capture RED tests`
  - Comment states the assertions fail in current code and become green after Task 5.
- `e2e/test_encode_snapshot_width.py:1-5` still contains RED/must-fail language:
  - `Snapshot-width optional input E2E tests (RED state).`
  - Chinese comment states that before Task 7 implementation they must all fail.
- `openspec/changes/add-css-background-snapshot-width/tests.md:132` contains TDD RED wording. This is less severe as a planning note, but it confirms RED language remains in changed artifacts.

## Additional Quality Finding

`src/__tests__/renderer.test.ts` has an inconsistent assertion in the snapshot-width path. In the test `threads broad CSS through encoded background thumbnail capture`, it calls:

```ts
const doc = await HtmlParser.encode(buffer, { snapshotWidth: 640 });
```

but later expects `handle.calls[0]?.options` to equal only:

```ts
{
  backgroundColor: "#ffffff",
  scale: 0.3,
  useCORS: true,
}
```

Core `captureThumbnail()` now adds `width` and `windowWidth` when `snapshotWidth !== undefined`, so this test expectation is stale or unclear for the feature under review. This is a clarity/minimality issue in a changed test file.

## LSP Diagnostics

Ran `lsp_diagnostics` on:

- `demo/demo.js`: no diagnostics
- `demo/demoDocumentSerialization.d.ts`: no diagnostics
- `demo/encode.html`: no diagnostics
- `src/__tests__/demoEncodeSnapshotWidth.test.ts`: no diagnostics
- `src/__tests__/htmlParser.test.ts`: no diagnostics
- `src/__tests__/renderer.test.ts`: no diagnostics
- `src/__tests__/typeExports.test.ts`: no diagnostics
- `src/index.ts`: no diagnostics
- `src/pageThumbnailDom.ts`: no diagnostics
- `e2e/test_encode_snapshot_width.py`: Python LSP could not run because `basedpyright-langserver` is not installed.

## Reasoning

The main requested fixes are partially present: `demoEncodeSnapshotWidth.test.ts` is clean, `options as any` is removed from `htmlParser.test.ts`, and demo validation now matches core validation. However, F2 cannot approve because changed test files still contain explicit RED/must-fail comments, including the new E2E test file and `renderer.test.ts`. The renderer test also appears to preserve an expectation that contradicts the snapshot-width forwarding behavior implemented in core.

## Final Verdict

REJECT
