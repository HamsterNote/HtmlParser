## Purpose

This spec defines the demo behavior for turning IntermediateDocument JSON back into an HTML preview. It exists to give developers and reviewers a clear, browser-based way to validate decode behavior, expected success states, and user-facing failure handling for invalid or incompatible JSON.

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
