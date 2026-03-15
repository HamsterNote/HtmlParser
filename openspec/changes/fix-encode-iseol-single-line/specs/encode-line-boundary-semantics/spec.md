## ADDED Requirements

### Requirement: DOM encode SHALL mark end-of-line only at semantic line boundaries
`HtmlParser.encode` in DOM parsing mode MUST set `isEOL: true` only for the last emitted text fragment of a semantic line, and MUST keep same-line inline fragments before the end as `isEOL: false`.

#### Scenario: Inline fragments in one paragraph
- **WHEN** the input HTML contains one paragraph with mixed inline nodes (for example plain text and `<strong>` content) that render on the same semantic line
- **THEN** only the final emitted fragment for that paragraph line has `isEOL: true`, and preceding fragments in that same line have `isEOL: false`

### Requirement: DOM encode SHALL preserve line termination at explicit structural breaks
`HtmlParser.encode` in DOM parsing mode MUST preserve end-of-line semantics for explicit structural breaks (block boundaries or explicit line-break elements) so that each completed semantic line ends with exactly one fragment marked `isEOL: true`.

#### Scenario: Consecutive semantic lines in DOM parsing
- **WHEN** the input HTML contains multiple semantic lines created by block separation or explicit line breaks
- **THEN** each semantic line ends with one and only one fragment marked `isEOL: true`

### Requirement: Fallback encode SHALL remain newline-driven
When DOM parsing is unavailable and fallback plain-text parsing is used, `HtmlParser.encode` MUST continue deriving lines from newline splitting and MUST mark each emitted fallback line as `isEOL: true`.

#### Scenario: Fallback mode with newline-separated text
- **WHEN** DOM parsing is unavailable and the HTML source contains multiple newline-separated lines
- **THEN** the fallback output emits one text entry per parsed line and each entry is marked `isEOL: true`
