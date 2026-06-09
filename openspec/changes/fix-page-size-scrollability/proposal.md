# Proposal - Page Size and Decode Scroll Behavior

## Summary

Clarify and document how `IntermediatePage.width` and `IntermediatePage.height` represent CSS pixel dimensions used for screenshot layout and decode rendering, and how decode output guarantees natural body-level scrolling without nested page scroll.

## Problem

The relationship between encode-time page measurement, `snapshotWidth`, and decode-time page rendering has been implicit. This leads to ambiguity about:

1. Whether `IntermediatePage.width/height` are bitmap pixels or CSS layout pixels.
2. Whether changing `snapshotWidth` requires a schema migration.
3. How decode output handles scrolling when the page content exceeds the viewport.
4. What fallback logic applies when html2canvas cannot provide size measurements.

## Proposed Change

- `IntermediatePage.width` and `IntermediatePage.height` remain existing fields on the serialized page schema. No schema migration is required.
- Page dimensions are screenshot-layout **CSS px** dimensions. They describe the layout viewport width/height used during iframe rendering and html2canvas capture, not device-pixel-ratio scaled bitmap pixels.
- `snapshotWidth` continues to control the screenshot/layout CSS width. It keeps the existing validation contract: values must be finite integers in `[100, 10000]`; invalid values throw `Invalid snapshotWidth: ${value}`.
- Decode output must size the `.hamster-note-document` container and each `.hamster-note-page` element so that the document body or host scrolling element owns natural scroll. Decode must not introduce `overflow: hidden` or other scroll-blocking styles on `.hamster-note-page` that would create nested scroll containers.
- When html2canvas size measurement is unavailable, encode falls back to the pre-existing bounds/viewport logic that computes page width/height from `documentElement.clientWidth`, `body.clientWidth`, `body.getBoundingClientRect()`, text bounding boxes, and image bounding boxes. This fallback behavior is documented and evidence is recorded.

## Non-Goals

- No new encode or decode API options.
- No changes to `IntermediateDocument`, `IntermediatePage`, `IntermediateImage`, or external type packages.
- No modification of the `snapshotWidth` validation range or error message.
- No changes to the existing thumbnail cache key logic.
- No archive edits.
