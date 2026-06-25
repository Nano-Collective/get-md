# Calibre Demo DOCX — Reference Output

This directory contains a fidelity test for the DOCX converter.

## Source

- **Input**: `calibre-demo.docx` — the official Calibre DOCX demonstration document
  - Download: https://calibre-ebook.com/downloads/demos/demo.docx
  - Size: 1,311,881 bytes
  - Content: Rich document with headings, bold/italic/strikethrough, tables, lists, code blocks, blockquotes, links, images, drop caps, font embedding, paragraph formatting

## Expected Output

The file `calibre-demo-expected.md` contains the reference Markdown output produced by get-md's DOCX converter. This is the "ground truth" that the converter should produce.

## Fidelity Test

The test converts `calibre-demo.docx` and compares the output against `calibre-demo-expected.md`. Any regression in conversion quality will cause the test to fail.

### What this tests

- **Headings**: H1 through H6 from Word heading styles
- **Inline formatting**: Bold, italic, strikethrough, underline
- **Tables**: Simple and complex tables with headers
- **Lists**: Ordered and unordered lists
- **Code blocks**: Fenced code blocks
- **Blockquotes**: Nested and simple blockquotes
- **Links**: Hyperlinks
- **Images**: Image placeholders
- **Paragraph formatting**: Various paragraph styles
- **Special characters**: Unicode, smart quotes, em dashes
