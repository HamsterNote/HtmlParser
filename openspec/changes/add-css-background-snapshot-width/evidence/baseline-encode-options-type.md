# Baseline Evidence: `EncodeOptions` Type (No `snapshotWidth`)

**File**: `src/index.ts`
**Line**: 89
**Date Captured**: 2026-06-08

## Current Code

```typescript
export type EncodeOptions = { excludeSelectors?: string[] };
```

## Baseline Behavior

The `EncodeOptions` type currently only exposes `excludeSelectors?: string[]`. There is no `snapshotWidth` field. Callers cannot pass any width configuration to the encode pipeline.

## Expected After Change

```typescript
export type EncodeOptions = { excludeSelectors?: string[]; snapshotWidth?: number };
```

## Impact

This is the root API surface. Until this type is extended, no caller (including the demo) can express a desired snapshot width.
