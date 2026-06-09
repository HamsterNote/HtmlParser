# Encode Page Size — CSS Pixel Dimensions and Sizing Semantics

## Purpose

This spec delta clarifies how `IntermediatePage.width` and `IntermediatePage.height` are measured during encode, how they relate to `snapshotWidth`, and what units they express. It documents the existing behavior as binding specification.

## Specification

### Page Dimensions Are CSS Layout Pixels

`IntermediatePage.width` and `IntermediatePage.height` are screenshot-layout **CSS px** dimensions. They describe the layout viewport width and height used during iframe rendering and html2canvas capture.

These values are **not** device-pixel-ratio scaled bitmap pixels. A `snapshotWidth` of `1024` means the iframe viewport and html2canvas canvas are laid out at `1024 CSS px`, regardless of the host screen DPR.

### Existing Schema Fields Unchanged

`IntermediatePage.width` and `IntermediatePage.height` remain existing fields on the serialized page schema. No schema migration is required. The fields are populated by `buildRenderedTexts()` in `src/index.ts` and consumed by decode rendering.

### snapshotWidth Controls Screenshot Layout CSS Width

`snapshotWidth` continues to control the screenshot/layout CSS width. It is an optional `EncodeOptions` field with the following contract:

- Valid values: finite integers in `[100, 10000]`.
- Invalid values (non-integer, non-finite, out of range, zero, negative, `NaN`, `Infinity`) cause `resolveSnapshotWidth()` to throw `Invalid snapshotWidth: ${value}`.
- When omitted or `undefined`, the encode pipeline uses the legacy default of `1024px`.
- The resolved width flows through:
  1. `withIframeDocument()` — sets `iframe.style.width`.
  2. `collectTextsFromDocument()` — sets `doc.documentElement.style.width`.
  3. `captureThumbnail()` — passes `width` and `windowWidth` to html2canvas options.
  4. `buildOffscreenPageElement()` — overrides `wrapper.style.width`.

### Fallback When html2canvas Measurement Is Unavailable

When html2canvas cannot provide element size measurements, encode falls back to the pre-existing bounds and viewport logic in `buildRenderedTexts()`:

```
pageWidth = round(max(
  documentElement.clientWidth,
  body.clientWidth,
  bodyRect.width,
  maxRight(of all text bounding boxes),
  maxImageRight(of all image bounding boxes)
))

pageHeight = round(max(
  documentElement.clientHeight,
  body.clientHeight,
  bodyRect.height,
  maxBottom(of all text bounding boxes),
  maxImageBottom(of all image bounding boxes)
))
```

This fallback is bounded by `Math.max(1, ...)` to ensure non-zero dimensions. The fallback path is the default behavior when `snapshotWidth` is omitted and html2canvas does not override sizing.

### No Height Control Option

There is no `snapshotHeight` option. Page height continues to be determined by content flow, bounding boxes, and viewport measurements as documented above.

## ADDED Requirements

### Requirement: Page dimensions express CSS px
The encode pipeline SHALL measure and store page width/height as CSS layout pixels, not bitmap pixels.

#### Scenario: Encode with custom snapshotWidth
- **WHEN** `HtmlParser.encode(buffer, { snapshotWidth: 1440 })` is called
- **THEN** the returned `IntermediatePage.width` is `1440` CSS px
- **AND** thumbnail capture uses `1440` CSS px layout width

### Requirement: Invalid snapshotWidth throws
The encode pipeline SHALL reject invalid `snapshotWidth` values before any capture work begins.

#### Scenario: Invalid snapshotWidth
- **WHEN** `HtmlParser.encode(buffer, { snapshotWidth: 99 })` is called
- **THEN** the promise rejects with `Error("Invalid snapshotWidth: 99")`

### Requirement: Fallback sizing uses bounds and viewport
When html2canvas cannot measure element sizes, the encode pipeline SHALL fall back to viewport and content bounds.

#### Scenario: html2canvas measurement unavailable
- **GIVEN** html2canvas cannot determine element dimensions
- **WHEN** encode completes
- **THEN** `pageWidth` and `pageHeight` are computed from `clientWidth`, `clientHeight`, `getBoundingClientRect`, text boxes, and image boxes
