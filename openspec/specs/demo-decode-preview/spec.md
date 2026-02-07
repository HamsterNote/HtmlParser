## Purpose

TBD.

## Requirements

### Requirement: Demo can decode JSON to HTML preview
Demo SHALL allow users to decode the IntermediateDocument JSON into an HTML fragment preview using HtmlParser.decodeToHtml.

#### Scenario: Decode valid JSON
- **WHEN** the user triggers decode with a valid IntermediateDocument JSON payload
- **THEN** the demo renders the decoded HTML fragment in a preview area

### Requirement: Demo reports decode failures
Demo SHALL report decode errors when the JSON payload is invalid or incompatible.

#### Scenario: Decode invalid JSON
- **WHEN** the user triggers decode with invalid JSON input
- **THEN** the demo shows an error message and does not render a preview
