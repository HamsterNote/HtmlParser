## Purpose

TBD.

## Requirements

### Requirement: Demo provides multi-path pages
Demo SHALL provide multiple pages accessible via different URL paths within the demo directory.

#### Scenario: Navigate to demo pages
- **WHEN** a user opens a demo page path in the browser
- **THEN** the corresponding demo page content is rendered

### Requirement: Demo can parse current page HTML
Demo SHALL provide a user-triggered action to send the current page HTML to HtmlParser for encoding.

#### Scenario: Trigger HTML parsing
- **WHEN** the user clicks the parse button
- **THEN** the page HTML is passed to HtmlParser.encode

### Requirement: Demo renders JSON output
Demo SHALL display the HtmlParser output as JSON in a visible output area.

#### Scenario: Show parsed JSON
- **WHEN** HtmlParser returns an intermediate document
- **THEN** the demo displays the JSON representation in the output area

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
