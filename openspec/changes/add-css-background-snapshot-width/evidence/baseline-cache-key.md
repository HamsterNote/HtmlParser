# Baseline Evidence: Thumbnail Cache Key Ignores Width

**File**: `src/index.ts`
**Lines**: 146-150
**Date Captured**: 2026-06-08

## Current Code

```typescript
let cachedThumbnail: IntermediateImage | undefined;
let cachedScale: number | undefined;
let inFlight: Promise<IntermediateImage | undefined> | null = null;
let inFlightScale: number | undefined;
```

## Baseline Behavior

`buildLazyThumbnailFn` maintains a single cached thumbnail keyed only by `scale` (`cachedScale` / `inFlightScale`). If a caller encodes the same document twice with different widths, the second call may incorrectly receive a thumbnail generated at the first width because the cache does not account for width differences.

## Expected After Change

Add `cachedWidth` and `inFlightWidth` variables. The cache hit condition should become:

```typescript
cachedScale !== undefined &&
cachedScale >= effectiveScale &&
cachedWidth === resolvedWidth
```

## Impact

Without cache isolation, switching between snapshot widths (e.g., mobile vs desktop) would produce stale or incorrectly sized thumbnails, breaking the core feature guarantee.
