# Baseline Evidence: Encode Page Size Fallback Logic

**File**: `src/index.ts`
**Function**: `buildRenderedTexts()`
**Lines**: 1526-1627
**Date Captured**: 2026-06-08

## Current Code

```typescript
const viewportWidth = Math.max(
  doc.documentElement.clientWidth,
  doc.body.clientWidth,
  Number.isFinite(bodyRect.width) ? bodyRect.width : 0,
);
const viewportHeight = Math.max(
  doc.documentElement.clientHeight,
  doc.body.clientHeight,
  Number.isFinite(bodyRect.height) ? bodyRect.height : 0,
);
const pageWidth = Math.max(
  1,
  Math.round(
    Math.max(
      viewportWidth,
      maxRight,
      maxImageRight,
    ),
  ),
);
const pageHeight = Math.max(
  1,
  Math.round(
    Math.max(
      viewportHeight,
      maxBottom,
      maxImageBottom,
    ),
  ),
);
```

## Baseline Behavior

When html2canvas cannot provide element size measurements, `buildRenderedTexts()` computes page dimensions from a combination of:

1. **Viewport measurements**: `documentElement.clientWidth/Height` and `body.clientWidth/Height`
2. **Body bounding box**: `body.getBoundingClientRect().width/height`
3. **Content bounds**: maximum right/bottom edges of all text segments and images

The final width/height is the rounded maximum of these values, bounded below by `1` to prevent zero dimensions.

This fallback path is always active during normal encode. html2canvas may override the effective capture size via its `width`/`windowWidth` options when `snapshotWidth` is provided, but the `IntermediatePage.width/height` values stored in the serialized document come from this bounds/viewport logic.

## Relationship to snapshotWidth

- When `snapshotWidth` is omitted, the iframe and document root default to `1024px`, and the viewport measurements above reflect that width.
- When `snapshotWidth` is provided (e.g., `1440`), the iframe and document root are set to that width before text collection, so `clientWidth` and `bodyRect.width` reflect the custom width.
- In both cases, `pageWidth` may exceed the snapshot width if content bounds (`maxRight`, `maxImageRight`) extend beyond the viewport.

## Evidence

This fallback logic is the pre-existing behavior. No code change is required for the fallback itself; this file documents the behavior for spec compliance.
