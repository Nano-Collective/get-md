import test from "ava";
import {
    extractPdf,
    extractPdfContent,
    reconstructPdfHtml,
    stripPageMarkers,
} from "./pdf-extractor.js";

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

test("extractPdf: extracts title/author/date from the info dictionary", async (t) => {
    const pdfBuffer = Buffer.from(
        "%PDF-1.4\n" +
        "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
        "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n" +
        "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n" +
        "4 0 obj\n<< /Length 44 >>\nstream\nBT /F1 24 Tf 100 700 Td (Body text here) Tj ET\nendstream\nendobj\n" +
        "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n" +
        "6 0 obj\n<< /Title (My PDF Title) /Author (Ada Lovelace) /CreationDate (D:20240115120000Z) >>\nendobj\n" +
        "trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\n%%EOF",
        "latin1",
    );

    const { metadata } = await extractPdf(pdfBuffer);
    t.is(metadata.title, "My PDF Title");
    t.is(metadata.author, "Ada Lovelace");
    t.is(metadata.publishedTime, "2024-01-15T12:00:00.000Z");
});

test("extractPdf: throws a wrapped error on a non-PDF buffer", async (t) => {
    await t.throwsAsync(
        async () => extractPdf(Buffer.from("not a pdf at all")),
        { message: /Failed to parse PDF/ },
    );
});

test("stripPageMarkers: removes pdf-parse '-- N of M --' page separators", (t) => {
    const withMarkers =
        "First page body.\n-- 1 of 2 --\nSecond page body.\n--- 2 of 2 ---";
    const cleaned = stripPageMarkers(withMarkers);

    t.false(cleaned.includes("1 of 2"));
    t.false(cleaned.includes("2 of 2"));
    t.true(cleaned.includes("First page body."));
    t.true(cleaned.includes("Second page body."));
});

test("stripPageMarkers: leaves ordinary content and horizontal rules intact", (t) => {
    const input = "Intro\n\n---\n\nA sentence that says 3 of 5 things inline.";
    const cleaned = stripPageMarkers(input);
    // A markdown horizontal rule and inline "N of M" text are not page markers.
    t.true(cleaned.includes("---"));
    t.true(cleaned.includes("3 of 5 things inline"));
});

// ============================================================================
// Structure reconstruction
// ============================================================================

test("reconstructPdfHtml: reflows wrapped lines into paragraphs", (t) => {
    const page =
        "This is a paragraph that the PDF wrapped across\n" +
        "several visual lines and should be rejoined.\n" +
        "A second paragraph starts here and also ends with a period.";
    const html = reconstructPdfHtml([page]);
    t.true(
        html.includes(
            "<p>This is a paragraph that the PDF wrapped across several visual lines and should be rejoined.</p>",
        ),
    );
    t.true(
        html.includes(
            "<p>A second paragraph starts here and also ends with a period.</p>",
        ),
    );
});

test("reconstructPdfHtml: promotes ALL-CAPS lines to headings (first h1, rest h2)", (t) => {
    const page =
        "SOCIAL MEDIA POLICY\n" +
        "INTRODUCTION\n" +
        "Some body content that is a normal sentence.";
    const html = reconstructPdfHtml([page]);
    t.true(html.includes("<h1>SOCIAL MEDIA POLICY</h1>"));
    t.true(html.includes("<h2>INTRODUCTION</h2>"));
    t.true(html.includes("<p>Some body content that is a normal sentence.</p>"));
});

test("reconstructPdfHtml: turns bullets into a list and folds wrapped continuations", (t) => {
    const page =
        "Intro line ending with a colon:\n" +
        "• First bullet that wraps across\n" +
        "two lines here.\n" +
        "• Second bullet.";
    const html = reconstructPdfHtml([page]);
    t.true(html.includes("<ul>"));
    t.true(
        html.includes("<li>First bullet that wraps across two lines here.</li>"),
    );
    t.true(html.includes("<li>Second bullet.</li>"));
});

test("reconstructPdfHtml: drops running headers/footers repeated across pages", (t) => {
    const header = "CONFIDENTIAL COMPANY HANDBOOK PAGE";
    const pages = [
        `${header}\nFirst page unique content sentence one.`,
        `${header}\nSecond page unique content sentence two.`,
        `${header}\nThird page unique content sentence three.`,
    ];
    const html = reconstructPdfHtml(pages);
    t.false(html.includes(header), "repeated header removed");
    t.true(html.includes("First page unique content sentence one."));
    t.true(html.includes("Third page unique content sentence three."));
});

test("reconstructPdfHtml: escapes HTML in reconstructed content", (t) => {
    const html = reconstructPdfHtml(["A line with <script>alert(1)</script> in it."]);
    t.true(html.includes("&lt;script&gt;"));
    t.false(html.includes("<script>"));
});

test("reconstructPdfHtml: numbered lines become an ordered list", (t) => {
    const page = "1. First step here.\n2. Second step here.";
    const html = reconstructPdfHtml([page]);
    t.true(html.includes("<ol>"));
    t.true(html.includes("<li>First step here.</li>"));
    t.true(html.includes("<li>Second step here.</li>"));
});
