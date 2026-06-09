# Proposal - CSS Background Snapshot Width

## Summary

Add a bounded `snapshotWidth?: number` encode option and align CSS background snapshot capture so callers can produce thumbnails at a deliberate viewport width without changing decode behavior or the serialized document schema.

## Problem

`HtmlParser.encode()` historically assumes a `1024px` capture width across iframe layout, document-root measurement, and thumbnail rendering. That default remains useful, but it prevents callers from matching mobile, desktop, or wide-content layouts when CSS backgrounds are captured as page thumbnails.

The background capture path also needs enough visual CSS context to preserve common source-page backgrounds, borders, spacing, color, and text styling while avoiding behavior-affecting or unstable CSS fields.

## Proposed Change

- Keep `EncodeOptions.snapshotWidth?: number` as the only public API addition.
- Treat omitted or `undefined` `snapshotWidth` as the legacy default path.
- Validate defined values as finite integers in `[100, 10000]`; reject invalid values with `Invalid snapshotWidth: ${value}` before capture work proceeds.
- Thread the resolved width through iframe creation, document-root width, html2canvas `width`/`windowWidth`, offscreen page wrapper width, and thumbnail cache isolation.
- Preserve broad CSS background capture by collecting bounded visual computed styles from source DOM containers, including background, border, outline, shadow, padding, overflow, text/font/color, opacity, visibility, and selected layout spacing/alignment properties.
- Keep the denylist for animation/transition, interaction, scrolling, transform/filter/blend, custom properties, and other unstable/non-visual fields so background snapshots stay deterministic.

## Non-Goals

- No `snapshotHeight` or other size options.
- No decode-phase API or behavior changes.
- No changes to `IntermediateDocument`, `IntermediatePage`, `IntermediateImage`, or external type packages.
- No percentage/string width support.
- No demo preview sandbox changes.
- No archive edits.
