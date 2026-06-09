# F4 Scope Fidelity Check

VERDICT: APPROVE

## Inputs reviewed

- Read `package.json`: existing dependencies only (`@chenglou/pretext`, `@hamster-note/document-parser`, `@hamster-note/types`, `html2canvas`) and existing devDependencies; no new dependency change appears in git diff.
- Read `.omo/notepads/css-background-snapshot-width/learnings.md`: plan boundaries confirmed as no EncodeOptions fields beyond `snapshotWidth`, no pseudo-elements, no custom URL fetching, no new dependencies, no archive edits, and no general improvements outside scope.
- Lockfile discovery: `yarn.lock` exists; no `package-lock.json` found.

## Command evidence

### Diff stat

Command: `git diff --stat -- ':!node_modules'`

```text
 demo/demo.js                        |  27 ++-
 demo/demoDocumentSerialization.d.ts |   5 +
 demo/encode.html                    |  14 ++
 src/__tests__/htmlParser.test.ts    | 136 +++++++++++++++
 src/__tests__/renderer.test.ts      | 320 +++++++++++++++++++++++++++++++++++-
 src/__tests__/typeExports.test.ts   |   5 +
 src/index.ts                        | 102 ++++++++++--
 src/pageThumbnailDom.ts             | 256 ++++++++++++++++++++++++-----
 8 files changed, 801 insertions(+), 64 deletions(-)
```

Assessment: reasonable for completed implementation tasks 1-9: demo wiring, EncodeOptions/snapshotWidth implementation, CSS background capture behavior, and tests. No package or lockfile in tracked diff stat.

### Tracked changed files

Command: `git diff --name-only`

```text
demo/demo.js
demo/demoDocumentSerialization.d.ts
demo/encode.html
src/__tests__/htmlParser.test.ts
src/__tests__/renderer.test.ts
src/__tests__/typeExports.test.ts
src/index.ts
src/pageThumbnailDom.ts
```

Tracked changes are within the planned implementation/test/demo scope.

### Working tree status note

Command: `git status --short`

```text
 M demo/demo.js
 M demo/demoDocumentSerialization.d.ts
 M demo/encode.html
 M src/__tests__/htmlParser.test.ts
 M src/__tests__/renderer.test.ts
 M src/__tests__/typeExports.test.ts
 M src/index.ts
 M src/pageThumbnailDom.ts
?? e2e/test_encode_snapshot_width.py
?? openspec/changes/add-css-background-snapshot-width/
?? src/__tests__/demoEncodeSnapshotWidth.test.ts
```

Untracked paths are active change/test artifacts, not archive paths. `git diff --name-only` does not include untracked files, so this status check was used for full workspace scope awareness.

### Dependency diffs

Command: `git diff -- package.json yarn.lock`

```text
(no output)
```

Assessment: no dependency or lockfile changes. No new dependencies added.

### Archive edits

Command: `git diff --name-only | grep '^openspec/changes/archive/'`

```text
(no output)
```

Assessment: no tracked archive edits. `git status --short` also shows no `openspec/changes/archive/` path.

### Pseudo-element capture in `src/pageThumbnailDom.ts`

Command: `git diff -U0 -- src/pageThumbnailDom.ts | grep -E 'pseudo|::before|::after|fetch|URL|XMLHttpRequest'`

```text
(no output)
```

Command: grep `pseudo|::before|::after|fetch|URL|XMLHttpRequest|url\(` in `src/pageThumbnailDom.ts`

```text
(no matches)
```

Assessment: `src/pageThumbnailDom.ts` contains no pseudo-element capture code and no fetch/URL/XMLHttpRequest/custom URL-resolution code.

### Forbidden keyword scan in changed files

Command: `git diff -U0 -- demo/demo.js demo/demoDocumentSerialization.d.ts demo/encode.html src/__tests__/htmlParser.test.ts src/__tests__/renderer.test.ts src/__tests__/typeExports.test.ts src/index.ts src/pageThumbnailDom.ts | grep -E 'pseudo|::before|::after|fetch|URL|XMLHttpRequest'`

```text
+          toDataURL: () => `data:image/png;base64,WIDTH_${widthLabel}`
+	it("pseudo-elements (::before, ::after) are explicitly out of scope", async () => {
+				{ id: "page-pseudo", width: 100, height: 100, texts: [] },
```

Assessment: matches are test-only `toDataURL` fixtures and an explicit out-of-scope pseudo-element test. No implementation pseudo-element capture and no custom fetch/XMLHttpRequest code.

### Custom background-image URL fetching/resolution

Command: grep `fetch\(|new URL\(|XMLHttpRequest|backgroundImage.*URL|url\(` in `src/`

Observed matches are existing rendering/worker/test URL-string usages such as `src/htmlParserWorkerClient.ts` worker construction, `src/HtmlPage.ts`/`src/htmlParserWorkerCore.ts` background output formatting, and test fixture `background-image:url(...)` expectations. No new custom background-image URL fetching/resolution implementation was found in changed implementation files.

### `EncodeOptions` public fields

Command: grep `export type EncodeOptions|interface EncodeOptions|snapshotWidth\?:|excludeSelectors\?:` in `src/`

```text
src/index.ts:89: export type EncodeOptions = {
src/index.ts:90: excludeSelectors?: string[];
src/index.ts:91: snapshotWidth?: number;
src/index.ts:174: snapshotWidth?: number,
src/index.ts:276: snapshotWidth?: number,
src/pageThumbnailDom.ts:22: snapshotWidth?: number
```

Assessment: public `EncodeOptions` in `src/index.ts` contains existing `excludeSelectors?: string[]` plus the planned `snapshotWidth?: number`; no other public fields were added. Other `snapshotWidth` entries are internal function/options plumbing.

## Scope fidelity conclusion

- No new dependencies: PASS.
- No package/lockfile dependency changes: PASS.
- No pseudo-element capture code in `src/pageThumbnailDom.ts`: PASS.
- No custom background-image URL fetching/resolution code: PASS.
- `EncodeOptions` only adds `snapshotWidth` beyond existing `excludeSelectors`: PASS.
- No archive edits: PASS.
- No unrelated refactors found in changed implementation files; large `src/pageThumbnailDom.ts` changes are scoped to visual CSS background capture and `snapshotWidth` offscreen width plumbing: PASS.
- Diff stat is within expected implementation/test/demo scope: PASS.

Final verdict: APPROVE.
