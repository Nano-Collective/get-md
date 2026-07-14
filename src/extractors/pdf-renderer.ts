export interface RenderedPage {
  pageNumber: number;
  imageBuffer: Buffer;
  width: number;
  height: number;
}

/**
 * Render all pages of a PDF buffer to JPEG image buffers.
 * This is used to pass visual context to vision models.
 */
export async function renderPdfToImages(
  buffer: Buffer,
  scale = 2.0,
): Promise<RenderedPage[]> {
  const { createCanvas } = await import("@napi-rs/canvas");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    // Use the standard fonts bundled with pdfjs-dist
    standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/",
  });

  const pdf = await loadingTask.promise;
  const pages: RenderedPage[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext("2d");

    await page.render({
      canvasContext: context as any, // Bypass strict type mismatch with HTMLCanvasElement
      canvas: canvas as any,
      viewport,
    }).promise;

    const imageBuffer = canvas.toBuffer("image/jpeg");
    pages.push({
      pageNumber: i,
      imageBuffer,
      width: viewport.width,
      height: viewport.height,
    });
  }

  return pages;
}
