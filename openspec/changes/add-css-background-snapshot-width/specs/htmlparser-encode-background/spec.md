# Encode Background — Broad CSS Visual Capture

## Purpose

When encoding a page with CSS backgrounds, `HtmlParser.encode()` creates an offscreen thumbnail of the original page for use as a background image in the decoded output. This spec delta documents the broad CSS visual capture strategy used for this thumbnail, replacing the previous narrow whitelist approach.

## Previous Approach (Deprecated)

The original implementation used a narrow whitelist in `collectWhitelistedStyles()` that only copied:
- `background-color`
- `border`
- `border-radius`
- `box-shadow`
- `outline`

This produced visually impoverished thumbnails that missed gradients, opacity, padding, fonts, and other important visual properties.

## New Approach: Bounded Broad Visual Copy

### Candidate Source

Properties are collected from:
1. `window.getComputedStyle(element)` for each element with a non-zero bounding box.
2. Inline `element.style` properties.

### Allowed Categories

Visual properties that affect the rendered appearance of background snapshots:

- **Background**: `background*`
- **Border**: `border*`, `border-radius`
- **Outline**: `outline*`
- **Shadow**: `box-shadow`
- **Padding**: `padding*`
- **Overflow**: `overflow*`
- **Text/Font**: `font*`, `color`, `text-shadow`, `line-height`, `letter-spacing`, `word-spacing`, `white-space`
- **Opacity/Visibility**: `opacity`, `visibility`
- **Layout**: `display`, `gap`, `column-gap`, `row-gap`, `flex*`, `grid*`, `align*`, `justify*`, `place*`

### Denylist (Explicitly Excluded)

Properties that affect behavior, interactivity, or are unsupported in static snapshots:

- **Animation/Transition**: `animation*`, `transition*`
- **Interactivity**: `cursor`, `pointer-events`, `user-select`, `resize`
- **Performance Hints**: `will-change`
- **Scroll**: `scroll-behavior`, `scroll-margin*`, `scroll-padding*`, `overscroll-behavior*`
- **Filters/Blend**: `filter`, `backdrop-filter`, `mix-blend-mode`
- **ARIA**: `caret-color` and ARIA-like properties
- **Vendor/Internal**: `-webkit-*`, `-moz-*`, `-ms-*`, `-internal-*`
- **Custom Properties**: `--*`

### Value Filtering

Even within allowed categories, values are dropped if they are:
- Empty string or `none`
- CSS reset keywords (`initial`, `inherit`, `unset`, `revert`)
- `auto` (for most properties)
- Default computed values (e.g., `overflow: visible`, `background-image: none`)
- Transparent colors
- Zero-length values for padding, radius, width, gap, spacing
- Invisible border/outline sides

### URL Filtering

Any property whose value contains `url(` is dropped, except for `background-image` which may contain CSS gradients (`linear-gradient()`, `radial-gradient()`, etc.). Actual image URLs are not resolved or fetched.

## Pseudo-Elements

`::before` and `::after` pseudo-elements are **not** captured. This is an intentional scope boundary to avoid complexity around generated content in static snapshots.

## Archived Warning Override

This change overrides the archived OpenSpec warning: "no broad getComputedStyle full-copy". The new approach is bounded by the category allowlist, explicit denylist, and value filters documented above.
