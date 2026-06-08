# Baseline Evidence: Document Root Width Hardcoded to 1024px

**File**: `src/index.ts`
**Lines**: 1878-1884
**Date Captured**: 2026-06-08

## Current Code

```typescript
doc.documentElement.style.width = "1024px";
doc.body.style.margin = "0";
doc.body.style.padding = "0";
```

## Baseline Behavior

During text and image collection (`collectTextsFromDocument`), the document root element (`<html>`) has its inline width style forcibly set to `1024px`. This ensures consistent measurement regardless of the original document's responsive behavior, but it also means the collection phase assumes a desktop viewport and cannot adapt to narrower or wider target widths.

## Expected After Change

The `collectTextsFromDocument` method should accept an optional width parameter (defaulting to 1024), and `doc.documentElement.style.width` should be set to `${resolvedWidth}px`.

## Impact

The document root width affects `getBoundingClientRect` and other layout-dependent measurements used to estimate text positions and image placements. If the iframe width and document root width diverge, the collected coordinates will be inconsistent with the rendered thumbnail.
