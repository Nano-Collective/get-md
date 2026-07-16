import { createRequire } from "module";
import path from "path";

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

  const require = createRequire(import.meta.url);
  const pdfjsPath = require.resolve("pdfjs-dist/package.json");
  const standardFontDataUrl =
    path.join(path.dirname(pdfjsPath), "standard_fonts") + "/";

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    // Use the standard fonts bundled with pdfjs-dist
    standardFontDataUrl,
  });

  const pdf = await loadingTask.promise;
  const pages: RenderedPage[] = [];
  const MAX_PAGES_TO_RENDER = 10;
  if (pdf.numPages > MAX_PAGES_TO_RENDER) {
    console.warn(
      `[get-md] PDF has ${pdf.numPages} pages, which exceeds the rendering limit of ${MAX_PAGES_TO_RENDER}. ` +
        `Only the first ${MAX_PAGES_TO_RENDER} pages will be processed for diagrams.`,
    );
  }
  const pagesToRender = Math.min(pdf.numPages, MAX_PAGES_TO_RENDER);

  for (let i = 1; i <= pagesToRender; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext("2d");

    await page.render({
      // biome-ignore lint/suspicious/noExplicitAny: canvas/SDK type mismatch
      canvasContext: context as any,
      // biome-ignore lint/suspicious/noExplicitAny: canvas/SDK type mismatch
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
