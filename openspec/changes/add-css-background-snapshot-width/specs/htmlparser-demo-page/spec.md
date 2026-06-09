# Demo Page — snapshotWidth Input Control

## Purpose

The encode demo page (`demo/encode.html`) provides a UI for calling `HtmlParser.encode()` with user-configurable options. This spec delta documents the addition of the `snapshot-width` input control.

## Specification

### DOM Structure

Inside `.exclude-selector-section`, after the `exclude-selectors` input and before the `.json-input` textarea:

```html
<label class="exclude-selector-label" for="snapshot-width">
  Snapshot width (px)
</label>
<p class="input-hint">
  Optional. Override the snapshot width used when encoding CSS backgrounds.
  Leave blank to use the default.
</p>
<input
  id="snapshot-width"
  class="exclude-selector-input"
  data-role="snapshot-width"
  type="number"
  min="100"
  max="10000"
  step="1"
  placeholder="1024"
/>
```

### Behavior

- `type="number"` with `min="100"`, `max="10000"`, `step="1"` constraints.
- Empty value → `snapshotWidth` is omitted from `EncodeOptions`.
- Valid integer within range → passed to `HtmlParser.encode()` as `snapshotWidth`.
- Invalid value → `parseSnapshotWidth()` throws `Invalid snapshotWidth: ${value}`, displayed as parse failure.

### Styling

Uses existing `.exclude-selector-label`, `.exclude-selector-input`, `.input-hint` classes for visual consistency with the `exclude-selectors` control.
