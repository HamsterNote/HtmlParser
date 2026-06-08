# Final F3 Re-audit: snapshotWidth Demo Manual QA

Date: 2026-06-08
Demo URL: `http://127.0.0.1:8169/demo/encode.html`
Verdict: **APPROVE**

## Commands run

- `yarn build:all` — generated `dist/` because `demo/demo.js` imports `../dist/index.js`.
- `python3 /home/zhangxiao/.config/opencode/skills/webapp-testing/scripts/with_server.py --server "yarn dev" --port 8169 --timeout 60 -- python3 /tmp/opencode/f3_reaudit_qa.py`

## Scenario results

| Scenario | Result | Evidence |
| --- | --- | --- |
| Empty snapshot width -> Parse | PASS (`status=Done`, pages=1) | `.omo/evidence/final-f3-empty-snapshot-width.png` |
| Snapshot width `640` -> Parse | PASS (`status=Done`, pages=1) | `.omo/evidence/final-f3-snapshot-width-640.png` |
| Snapshot width `99` -> Parse | PASS (`status=Failed`, output contains `Invalid snapshotWidth: 99`) | `.omo/evidence/final-f3-snapshot-width-99-error.png` |
| Valid width `640` -> Parse -> Decode preview | PASS (`status=Decode ready`, iframe attached, body text rendered) | `.omo/evidence/final-f3-valid-640-decoded-preview.png` |

Additional screenshot before decode: `.omo/evidence/final-f3-valid-640-before-decode.png`
Raw run JSON: `.omo/evidence/final-f3-reaudit-results.json`

## Preview render verification

The valid-width decode scenario attached `[data-role="preview"] iframe.preview-frame`; its `srcdoc` contained sample content and Playwright read rendered iframe body text including:

```text
Sample content
This page contains mixed content:
bold text
,
italic text
, and
colored text
.
HtmlParser will walk the DOM, collect text nodes, and estimate a simple layout
for each line.
Styled background sample text appears before the inline image so mixed
content order can be inspected.
More styled sample text follows the image.
Special text cases
<br>
First line
Second line
Rotated text
Rotate me
Scaled text
Scale me
Transform translate
Translate me
Shadow text
Shadow me
Native vertical
原生竖排
```

## Console assessment

- Browser `pageerror` count: **0**.
- Sandbox blocked-script console errors: **9**.
- Other console error/warning messages: **1**.

Sandbox messages observed:

```text
[error] Blocked script execution in 'about:srcdoc' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.
```

Classification: these sandbox messages are **pre-existing sandbox/iframe behavior**, not a snapshotWidth regression. The codebase already has sandboxed iframe creation in `demo/demoPreview.js:38` (`frame.setAttribute('sandbox', '')`) and in the existing encode path `src/index.ts:1664` (`iframe.setAttribute("sandbox", "allow-same-origin")`). The snapshotWidth changes are limited to `demo/encode.html`, `demo/demo.js`, `src/pageThumbnailDom.ts`, and snapshotWidth option handling; they do not alter preview iframe sandboxing. The same sandbox class appears when parsing with empty width and with `640`, while invalid `99` fails before encode and produces no sandbox errors.

One non-sandbox console error was observed once:

```text
[error] Failed to load resource: the server responded with a status of 404 (Not Found)
```

No page errors were emitted, and this did not affect any snapshotWidth scenario or preview rendering.

## Final verdict

**APPROVE** — all four required user flows passed in the running demo, screenshots and raw JSON evidence were saved, preview rendering was verified in the iframe body, and console sandbox errors are pre-existing/non-blocking rather than introduced by snapshotWidth.
