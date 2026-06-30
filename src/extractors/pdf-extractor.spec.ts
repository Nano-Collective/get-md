import test from "ava";
import { extractPdfContent } from "./pdf-extractor.js";

test("extractPdfContent: extracts text from pdf", async (t) => {
    // Generate a minimal valid PDF
    // minimal pdf source:
    const pdfBuffer = Buffer.from(
        "%PDF-1.1\n" +
        "1 0 obj\n" +
        "<< /Type /Catalog\n" +
        "/Outlines 2 0 R\n" +
        "/Pages 3 0 R >>\n" +
        "endobj\n" +
        "2 0 obj\n" +
        "<< /Type /Outlines\n" +
        "/Count 0 >>\n" +
        "endobj\n" +
        "3 0 obj\n" +
        "<< /Type /Pages\n" +
        "/Kids [4 0 R]\n" +
        "/Count 1 >>\n" +
        "endobj\n" +
        "4 0 obj\n" +
        "<< /Type /Page\n" +
        "/Parent 3 0 R\n" +
        "/MediaBox [0 0 612 792]\n" +
        "/Contents 5 0 R\n" +
        "/Resources << /ProcSet 6 0 R\n" +
        "/Font << /F1 7 0 R >> >>\n" +
        ">> endobj\n" +
        "5 0 obj\n" +
        "<< /Length 44 >>\n" +
        "stream\n" +
        "BT\n" +
        "/F1 24 Tf\n" +
        "100 100 Td\n" +
        "(Hello World) Tj\n" +
        "ET\n" +
        "endstream\n" +
        "endobj\n" +
        "6 0 obj\n" +
        "[/PDF /Text]\n" +
        "endobj\n" +
        "7 0 obj\n" +
        "<< /Type /Font\n" +
        "/Subtype /Type1\n" +
        "/Name /F1\n" +
        "/BaseFont /Helvetica\n" +
        "/Encoding /MacRomanEncoding >>\n" +
        "endobj\n" +
        "xref\n" +
        "0 8\n" +
        "0000000000 65535 f\n" +
        "0000000009 00000 n\n" +
        "0000000074 00000 n\n" +
        "0000000120 00000 n\n" +
        "0000000179 00000 n\n" +
        "0000000300 00000 n\n" +
        "0000000394 00000 n\n" +
        "0000000423 00000 n\n" +
        "trailer\n" +
        "<< /Size 8\n" +
        "/Root 1 0 R >>\n" +
        "startxref\n" +
        "536\n" +
        "%%EOF",
        "binary"
    );

    const text = await extractPdfContent(pdfBuffer);
    t.truthy(text.includes("Hello World"));
});
