## Why

In the demo output, text fragments that visually belong to the same line are currently marked with `isEOL: true` after `HtmlParser.encode`, which causes incorrect line-boundary semantics in downstream rendering and debugging. This should be corrected now to prevent data-level line breaks from diverging from actual layout intent.

## What Changes

- Add explicit line-boundary rules for HTML encode output so `isEOL` reflects real end-of-line boundaries instead of being always `true`.
- Add regression unit tests covering same-line inline nodes (for example plain text mixed with inline tags) to ensure only true line endings are marked.
- Keep fallback plain-text behavior consistent with its line-splitting model while aligning encode semantics for normal DOM parsing.
- Validate demo-facing JSON output behavior for encoded text segments to avoid regressions.

## Capabilities

### New Capabilities
- `encode-line-boundary-semantics`: Define and verify how `HtmlParser.encode` sets `isEOL` for same-line and line-break text segments.

### Modified Capabilities
- None.

## Impact

- Affected code: `src/index.ts` (encode text extraction and `isEOL` assignment), `src/__tests__/htmlParser.test.ts` (new regression tests), and demo verification paths under `demo/`.
- Affected behavior: Intermediate text segmentation metadata (`isEOL`) consumed by preview/debug flows.
- No expected API surface changes; focuses on output correctness and test coverage.
