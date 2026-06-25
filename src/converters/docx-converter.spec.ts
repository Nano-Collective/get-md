// src/converters/docx-converter.spec.ts

import test from "ava";
import { convertDocxToHtml } from "./docx-converter.js";
import { deflateRawSync, crc32 } from "node:zlib";

// ============================================================================
// Test helpers
// ============================================================================

/**
 * Build a minimal .docx Buffer from a word/document.xml string.
 * Creates a valid ZIP with the bare minimum structure for node-stream-zip.
 */
function buildDocx(xml: string): Buffer {
  const filename = "word/document.xml";
  const nameBytes = Buffer.from(filename);
  const data = Buffer.from(xml);
  const compressed = deflateRawSync(data);
  const crc = crc32(data);

  // Local file header
  const local = Buffer.alloc(30 + nameBytes.length);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(8, 8); // deflate
  local.writeUInt16LE(0, 10);
  local.writeUInt16LE(0, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);
  local.writeUInt16LE(0, 28);
  nameBytes.copy(local, 30);

  // Central directory
  const cd = Buffer.alloc(46 + nameBytes.length);
  cd.writeUInt32LE(0x02014b50, 0);
  cd.writeUInt16LE(20, 4);
  cd.writeUInt16LE(20, 6);
  cd.writeUInt16LE(0, 8);
  cd.writeUInt16LE(8, 10);
  cd.writeUInt16LE(0, 12);
  cd.writeUInt16LE(0, 14);
  cd.writeUInt32LE(crc, 16);
  cd.writeUInt32LE(compressed.length, 20);
  cd.writeUInt32LE(data.length, 24);
  cd.writeUInt16LE(nameBytes.length, 28);
  cd.writeUInt16LE(0, 30);
  cd.writeUInt16LE(0, 32);
  cd.writeUInt16LE(0, 34);
  cd.writeUInt16LE(0, 36);
  cd.writeUInt16LE(0, 38);
  cd.writeUInt32LE(0, 40);
  cd.writeUInt32LE(0, 44); // local header offset
  nameBytes.copy(cd, 46);

  // End of central directory
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(local.length + compressed.length, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([local, compressed, cd, eocd]);
}

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

function docxXml(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W}">
  <w:body>${body}</w:body>
</w:document>`;
}

// ============================================================================
// Tests
// ============================================================================

test("converts plain text paragraph to <p>", async (t) => {
  const xml = docxXml(`
    <w:p>
      <w:r><w:t>Hello world</w:t></w:r>
    </w:p>`);
  const html = await convertDocxToHtml(buildDocx(xml));
  t.is(html, "<p>Hello world</p>");
});

test("converts Heading 1 to <h1>", async (t) => {
  const xml = docxXml(`
    <w:p>
      <w:pPr><w:pStyle w:val="Heading 1"/></w:pPr>
      <w:r><w:t>Title</w:t></w:r>
    </w:p>`);
  const html = await convertDocxToHtml(buildDocx(xml));
  t.is(html, "<h1>Title</h1>");
});

test("converts Heading 2 to <h2>", async (t) => {
  const xml = docxXml(`
    <w:p>
      <w:pPr><w:pStyle w:val="Heading 2"/></w:pPr>
      <w:r><w:t>Subtitle</w:t></w:r>
    </w:p>`);
  const html = await convertDocxToHtml(buildDocx(xml));
  t.is(html, "<h2>Subtitle</h2>");
});

test("converts bold run to <strong>", async (t) => {
  const xml = docxXml(`
    <w:p>
      <w:r><w:t>Normal </w:t></w:r>
      <w:r><w:rPr><w:b/></w:rPr><w:t>bold</w:t></w:r>
    </w:p>`);
  const html = await convertDocxToHtml(buildDocx(xml));
  t.is(html, "<p>Normal <strong>bold</strong></p>");
});

test("converts italic run to <em>", async (t) => {
  const xml = docxXml(`
    <w:p>
      <w:r><w:t>Normal </w:t></w:r>
      <w:r><w:rPr><w:i/></w:rPr><w:t>italic</w:t></w:r>
    </w:p>`);
  const html = await convertDocxToHtml(buildDocx(xml));
  t.is(html, "<p>Normal <em>italic</em></p>");
});

test("converts strikethrough run to <s>", async (t) => {
  const xml = docxXml(`
    <w:p>
      <w:r><w:rPr><w:strike/></w:rPr><w:t>stricken</w:t></w:r>
    </w:p>`);
  const html = await convertDocxToHtml(buildDocx(xml));
  t.is(html, "<p><s>stricken</s></p>");
});

test("converts underline run to <u>", async (t) => {
  const xml = docxXml(`
    <w:p>
      <w:r><w:rPr><w:u w:val="single"/></w:rPr><w:t>underlined</w:t></w:r>
    </w:p>`);
  const html = await convertDocxToHtml(buildDocx(xml));
  t.is(html, "<p><u>underlined</u></p>");
});

test("converts multiple paragraphs", async (t) => {
  const xml = docxXml(`
    <w:p><w:r><w:t>First</w:t></w:r></w:p>
    <w:p><w:r><w:t>Second</w:t></w:r></w:p>`);
  const html = await convertDocxToHtml(buildDocx(xml));
  t.is(html, "<p>First</p>\n<p>Second</p>");
});

test("converts table to HTML table", async (t) => {
  const xml = docxXml(`
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Header</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Cell</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>`);
  const html = await convertDocxToHtml(buildDocx(xml));
  t.true(html.includes("<table>"));
  t.true(html.includes("<th>Header</th>"));
  t.true(html.includes("<td>Cell</td>"));
  t.true(html.includes("</table>"));
});

test("returns empty string for empty body", async (t) => {
  const xml = docxXml(``);
  const html = await convertDocxToHtml(buildDocx(xml));
  t.is(html, "");
});

test("handles empty paragraph", async (t) => {
  const xml = docxXml(`<w:p></w:p>`);
  const html = await convertDocxToHtml(buildDocx(xml));
  t.is(html, "<p></p>");
});

test("full document: headings, text, formatting", async (t) => {
  const xml = docxXml(`
    <w:p>
      <w:pPr><w:pStyle w:val="Heading 1"/></w:pPr>
      <w:r><w:t>My Document</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Some text with </w:t></w:r>
      <w:r><w:rPr><w:b/></w:rPr><w:t>bold</w:t></w:r>
      <w:r><w:t> formatting.</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading 2"/></w:pPr>
      <w:r><w:t>Section</w:t></w:r>
    </w:p>`);
  const html = await convertDocxToHtml(buildDocx(xml));
  const lines = html.split("\n");
  t.is(lines[0], "<h1>My Document</h1>");
  t.is(lines[1], "<p>Some text with <strong>bold</strong> formatting.</p>");
  t.is(lines[2], "<h2>Section</h2>");
});
