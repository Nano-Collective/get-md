import { PDFParse } from "pdf-parse";

/**
 * Extracts text content from a PDF buffer.
 *
 * Note: pdf-parse is chosen because it provides lightweight,
 * cross-platform PDF text extraction without requiring the
 * heavier pdfjs rendering pipeline.
 *
 * @param buffer - The raw PDF buffer
 * @returns The extracted text content
 */
export async function extractPdfContent(buffer: Buffer): Promise<string> {
  try {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return result.text || "";
  } catch (error) {
    throw new Error(
      `Failed to parse PDF: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
