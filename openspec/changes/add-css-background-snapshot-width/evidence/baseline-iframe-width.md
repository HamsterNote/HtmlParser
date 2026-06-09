# Baseline Evidence: Iframe Width Hardcoded to 1024px

**File**: `src/index.ts`
**Lines**: 1596-1606
**Date Captured**: 2026-06-08

## Current Code

```typescript
const iframe = hostDocument.createElement("iframe") as HTMLIFrameElement;

// 设置视觉隐藏样式（NOT display:none）
iframe.style.position = "absolute";
iframe.style.left = "-10000px";
iframe.style.top = "0";
iframe.style.width = "1024px";
iframe.style.height = "2048px";
iframe.style.border = "0";
iframe.style.opacity = "0";
iframe.style.pointerEvents = "none";
```

## Baseline Behavior

Every HTML document encoded by `HtmlParser.encode()` is rendered inside a temporary iframe with a fixed viewport width of `1024px`. This width is hardcoded and cannot be overridden by the caller. Content wider than 1024px will be constrained by this viewport, potentially causing text wrapping and layout differences from the original page.

## Expected After Change

The `withIframeDocument` helper should accept an optional width parameter (defaulting to 1024), and `iframe.style.width` should be set to `${resolvedWidth}px`.

## Impact

This is the first point in the encode pipeline where width matters. The iframe viewport width directly affects how the browser computes element layouts, text wrapping, and image sizing before any text or image collection happens.
