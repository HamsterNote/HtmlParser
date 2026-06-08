# Baseline Evidence: Offscreen DOM Wrapper Uses Page Width

**File**: `src/pageThumbnailDom.ts`
**Lines**: 227-238
**Date Captured**: 2026-06-08

## Current Code

```typescript
Object.assign(wrapper.style, {
  position: 'absolute',
  left: '-10000px',
  top: '0',
  pointerEvents: 'none',
  width: `${page.width}px`,
  height: `${page.height}px`,
  overflow: 'hidden',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'top center',
  backgroundSize: 'contain'
})
```

## Baseline Behavior

`buildOffscreenPageElement` sets the wrapper's CSS `width` to `${page.width}px`. The `page.width` value comes from the encode phase (currently derived from the hardcoded 1024px iframe or the original document's natural width). There is no mechanism to override this width for snapshot purposes.

## Expected After Change

`BuildOffscreenPageElementOptions` should accept an optional `snapshotWidth?: number`. When provided, `wrapper.style.width` should use the snapshot width instead of `page.width`:

```typescript
width: `${options?.snapshotWidth ?? page.width}px`,
```

## Impact

If the offscreen DOM wrapper width does not match the html2canvas capture width and the iframe/document width, the thumbnail will either be clipped or contain unwanted whitespace. All three width values (iframe, document root, wrapper) must stay synchronized.
