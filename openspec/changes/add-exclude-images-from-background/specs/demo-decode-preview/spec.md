## ADDED Requirements

### Requirement: Decode background respects `excludeImagesFromBackground`
The decode background thumbnail pipeline SHALL honor `BackgroundDecodeOptions.excludeImagesFromBackground`. When the option is `true`, the offscreen background DOM used to render the thumbnail SHALL NOT inject foreground image elements; when the option is `undefined` or `false`, foreground image injection into the background SHALL behave exactly as today.

#### Scenario: Default behavior preserves images in background
- **WHEN** decode is invoked without `excludeImagesFromBackground` (or with `false`)
- **THEN** the generated background thumbnail still includes all foreground images that the encode stage collected

#### Scenario: Explicit image exclusion removes images from background only
- **WHEN** decode is invoked with `excludeImagesFromBackground: true` and `excludeTextFromBackground` left unset or `false`
- **THEN** the background thumbnail is produced via the custom offscreen capture path with no `<img>` injected
- **AND** the foreground decoded HTML output still renders its `<img>` elements unaffected
- **AND** no other media source (CSS background-image, SVG, `<picture>`, `<video>`) is taken into account because they are explicitly out of scope for this option

#### Scenario: Both exclusions combine independently
- **WHEN** decode is invoked with `excludeImagesFromBackground: true` AND `excludeTextFromBackground: true`
- **THEN** the background thumbnail omits both foreground text and foreground images
- **AND** the foreground decoded HTML still renders both text and `<img>` elements

### Requirement: `EncodeOptions` is unchanged by this capability
This capability SHALL NOT introduce, modify, or remove any field on `EncodeOptions` and SHALL NOT alter the encode-time image collection pipeline.

#### Scenario: Encode call signature is untouched
- **WHEN** a consumer calls `HtmlParser.encode(input)` or `HtmlParser.encode(input, encodeOptions)`
- **THEN** the call signature, accepted fields, and produced `IntermediateDocument.content` are identical to behavior before this change
