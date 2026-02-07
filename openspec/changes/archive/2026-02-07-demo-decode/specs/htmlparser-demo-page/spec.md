## ADDED Requirements

### Requirement: Demo provides decode controls
Demo SHALL expose a decode action and preview container on demo pages to validate JSON -> HTML rendering.

#### Scenario: View decode controls
- **WHEN** a user opens a demo page
- **THEN** the decode action and preview container are visible

### Requirement: Demo can decode from current JSON output
Demo SHALL use the current JSON output as the source for decode preview when available.

#### Scenario: Decode after encode
- **WHEN** the user completes encoding and triggers decode
- **THEN** the demo renders the preview using the JSON output produced by HtmlParser.encode
