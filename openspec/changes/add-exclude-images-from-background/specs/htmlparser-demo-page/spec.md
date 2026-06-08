## ADDED Requirements

### Requirement: Demo exposes `Exclude images from background image` checkbox
The encode demo page SHALL expose a stable checkbox control that lets the user toggle the new `excludeImagesFromBackground` background option when triggering decode.

#### Scenario: Checkbox visible and unchecked by default
- **WHEN** the user opens the encode demo page
- **THEN** a checkbox with `data-role="bg-exclude-images"` and the label `Exclude images from background image` is visible
- **AND** the checkbox is rendered immediately BELOW the existing `data-role="bg-exclude-text"` checkbox
- **AND** the checkbox is UNCHECKED by default so the existing demo decode behavior remains unchanged

#### Scenario: Checkbox state forwards into decode call
- **WHEN** the user toggles the `bg-exclude-images` checkbox and triggers decode (either via the JSON button path or the input path)
- **THEN** the demo includes `excludeImagesFromBackground: true` inside `BackgroundDecodeOptions` passed to the decode call
- **AND** when the checkbox is unchecked, the field is either omitted or set to `false`, never coerced to `true`

### Requirement: Demo decode preview unaffected for foreground images
The demo decode preview SHALL continue to render foreground `<img>` elements regardless of the `excludeImagesFromBackground` value. The option only gates the background thumbnail image injection.

#### Scenario: Foreground images still render when background excludes images
- **WHEN** the demo decodes a document containing foreground images with `excludeImagesFromBackground: true`
- **THEN** the preview area contains the expected foreground `<img>` elements
- **AND** the background thumbnail referenced by the preview omits those image injections
