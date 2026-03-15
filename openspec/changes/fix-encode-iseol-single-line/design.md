## Context

`HtmlParser.encode` currently marks every collected text fragment as `isEOL: true` in both the DOM parsing path and the plain-text fallback path. This causes same-line inline fragments (for example, text before/after `<strong>` inside one paragraph) to be treated as end-of-line segments, which misrepresents line boundaries in intermediate data used by demo/debug output.

The change must preserve existing parser output structure and avoid breaking fallback behavior that is intentionally line-split by newline characters.

## Goals / Non-Goals

**Goals:**
- Make `isEOL` semantics reflect actual line endings in the DOM parsing path.
- Preserve plain-text fallback behavior based on explicit line splitting.
- Add regression tests that fail on current behavior and pass after fix.
- Keep API shape unchanged (`IntermediateText` fields remain the same).

**Non-Goals:**
- Rebuild the full text layout engine or introduce browser-level line-wrap measurement.
- Change external package contracts in `@hamster-note/types`.
- Introduce demo-only hacks that diverge from parser core logic.

## Decisions

### Decision 1: Derive `isEOL` from semantic block boundaries, not per text node
- **Choice**: In DOM parsing, aggregate text fragments within the same semantic line container and set `isEOL` only on the last emitted fragment of that container.
- **Rationale**: The bug comes from treating each `TEXT_NODE` as line end. Marking only the final fragment in a logical line preserves inline continuity while still expressing line termination.
- **Alternatives considered**:
  - Mark all fragments `false`: rejected because true line endings become unexpressed.
  - Keep all fragments `true`: rejected because it preserves current incorrect behavior.
  - Measure visual wraps via rendering metrics: rejected due to complexity and environment dependence.

### Decision 2: Keep fallback plain-text path line-based
- **Choice**: Maintain newline-split fallback and keep line entries as `isEOL: true`.
- **Rationale**: Fallback has no DOM structure, so newline is the only reliable boundary signal; changing this would reduce determinism.
- **Alternatives considered**:
  - Mirror DOM aggregation logic in fallback: rejected because fallback lacks node context and gains little accuracy.

### Decision 3: Add focused regression tests in existing parser test suite
- **Choice**: Extend `src/__tests__/htmlParser.test.ts` with cases covering inline same-line nodes and newline-separated content.
- **Rationale**: Existing tests already validate encode behavior and DOM/no-DOM branches; adding targeted cases minimizes maintenance overhead and captures the regression at source.
- **Alternatives considered**:
  - Demo-only tests: rejected because bug origin is parser output, not UI layer.

## Risks / Trade-offs

- **[Risk]** DOM traversal logic may misclassify some nested inline/block combinations → **Mitigation**: include representative nested inline scenarios in tests and keep heuristic aligned with HTML block semantics.
- **[Risk]** Behavior change may affect consumers relying on previous incorrect `isEOL` output → **Mitigation**: scope change to semantic correctness and document in change artifacts; keep field contract unchanged.
- **[Trade-off]** Semantic boundary inference is less precise than true visual layout → **Mitigation**: explicitly limit scope to structural line semantics, not rendered wrap calculation.

## Migration Plan

1. Add regression tests that capture current failure for same-line inline fragments.
2. Update DOM parsing path to assign `isEOL` at semantic line boundaries.
3. Re-run tests and ensure fallback newline behavior remains stable.
4. Validate demo encode output manually against the regression scenario.

Rollback strategy: revert parser assignment change while keeping tests for diagnosis, then iterate with narrower boundary rules.

## Open Questions

- Should `<br>` always force the preceding emitted fragment to `isEOL: true` even when adjacent whitespace nodes are skipped?
- For empty block nodes that produce no text fragments, should we emit synthetic empty line markers or keep current no-emission behavior?

## Validation Notes (2026-02-26)

- Demo-like encode validation was executed against built output (`dist/index.js`) with a browser-like DOM environment (`happy-dom`).
- Input: `<p>Demo <strong>same</strong><span> line</span></p><p><br></p><div></div><p>Next</p>`
- Output confirmed line-boundary semantics:
  - Same visual line fragments: `Demo(false)`, `same(false)`, `line(true)`.
  - Following semantic line: `Next(true)`.
- Boundary observations:
  - `<br>` flushes the current semantic line and does not emit synthetic empty text entries.
  - Empty block (`<div></div>`) does not emit synthetic empty line markers.
- Contract check: `IntermediateText` schema remains unchanged; only `isEOL` assignment semantics in DOM encode path were corrected.
