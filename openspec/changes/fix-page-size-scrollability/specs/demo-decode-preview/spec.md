# Decode Preview/Full-HTML — Natural Scroll Without Nested Page Scroll

## Purpose

This spec delta documents the decode output scroll behavior. Decode output must allow natural body-level scrolling and must not introduce nested scroll containers on `.hamster-note-page` elements.

## Specification

### Decode Output Structure

Decode output from `renderDecodeHtmlFromPayload()` produces a fragment with this structure:

```html
<div class="hamster-note-document">
  <style>...fragment styles...</style>
  <div class="hamster-note-page" id="..." style="width:1200px;height:2400px;">
    <!-- text and image elements -->
  </div>
</div>
```

### Natural Body Scroll Ownership

Decode output SHALL size the `.hamster-note-document` and `.hamster-note-page` elements large enough that the host document body (or `document.scrollingElement`) owns natural scroll. Scroll events and scroll position SHALL be managed by the body, not by any individual page element.

### No Nested Scroll on `.hamster-note-page`

`.hamster-note-page` SHALL NOT have `overflow: hidden` or any other style that would create a nested scroll container or clip content independently from the document body scroll. The page element acts as a sized positioning container (`position: relative`) for absolutely positioned text and image children, not as a scroll viewport.

This means:
- `window.scrollTo()` scrolls the document body.
- `page.scrollTop` remains `0` because the page element does not own scroll.
- The computed style of `.hamster-note-page` does not report `overflow: hidden`.

### Page Dimensions Drive Container Size

The inline `width` and `height` styles on each `.hamster-note-page` come from `DecodeHtmlPagePayload.width` and `DecodeHtmlPagePayload.height`, which in turn come from `IntermediatePage.width` and `IntermediatePage.height`. These dimensions are CSS px values documented in the encode spec delta.

When page height exceeds the viewport height, the document body naturally becomes scrollable because the page element extends the document flow height.

## ADDED Requirements

### Requirement: Decode output enables body-natural scroll
Decode output SHALL allow the document body or host scrolling element to own scroll when page content exceeds the viewport.

#### Scenario: Tall page decode
- **GIVEN** a decoded page with `height: 2400px` and viewport height `768px`
- **WHEN** the user scrolls
- **THEN** `document.scrollingElement.scrollTop` changes
- **AND** `.hamster-note-page` `scrollTop` remains `0`

### Requirement: No nested page scroll
`.hamster-note-page` SHALL NOT introduce independent scroll or overflow clipping.

#### Scenario: Inspect page scroll ownership
- **WHEN** decode HTML is rendered in a document
- **THEN** `getComputedStyle(pageElement).overflow` is not `hidden`
- **AND** the page element does not show a scrollbar

### Requirement: Page size matches IntermediatePage dimensions
The decode-rendered page container SHALL match the width and height from the intermediate representation.

#### Scenario: Decode preserves page dimensions
- **GIVEN** an `IntermediatePage` with `width: 1200` and `height: 2400`
- **WHEN** `renderDecodeHtmlFromPayload()` produces HTML
- **THEN** the output contains `width:1200px` and `height:2400px`
