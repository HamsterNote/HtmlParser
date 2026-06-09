# Baseline Evidence: html2canvas Called Without Width Options

**File**: `src/index.ts`
**Lines**: 256-260
**Date Captured**: 2026-06-08

## Current Code

```typescript
const canvas = await html2canvas(handle.element, {
  backgroundColor: "#ffffff",
  scale,
  useCORS: true,
});
```

## Baseline Behavior

`captureThumbnail` invokes `html2canvas` with only `backgroundColor`, `scale`, and `useCORS`. It does not pass `width` or `windowWidth` options. As a result, `html2canvas` uses the element's natural width (derived from the offscreen DOM wrapper, which currently uses `page.width` or the hardcoded iframe width). There is no way to tell html2canvas to capture at a different width.

## Expected After Change

When `snapshotWidth` is provided, the options should include:

```typescript
const canvas = await html2canvas(handle.element, {
  backgroundColor: "#ffffff",
  scale,
  useCORS: true,
  width: resolvedWidth,
  windowWidth: resolvedWidth,
});
```

## Impact

The `width` option controls the canvas output width. The `windowWidth` option controls the viewport width used by html2canvas during rendering, ensuring media queries and responsive layouts match the intended snapshot width. Omitting these means the thumbnail always renders at the element's natural width, which may not match the caller's intent.
