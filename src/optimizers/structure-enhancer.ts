// src/optimizers/structure-enhancer.ts

import * as cheerio from "cheerio";

/**
 * Enhance HTML structure for better markdown conversion
 * - Improve heading hierarchy
 * - Clean up nested elements
 * - Normalize structure
 */
export function enhanceStructure(html: string): string {
  const $ = cheerio.load(html);

  // 1. Normalize heading hierarchy
  normalizeHeadings($);

  // 2. Unwrap unnecessary nested elements
  unwrapRedundantElements($);

  // 3. Convert divs with heading-like content to actual headings
  convertPseudoHeadings($);

  return $.html();
}

function normalizeHeadings($: cheerio.CheerioAPI): void {
  // Ensure headings have proper hierarchy
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const headings: { level: number; $el: cheerio.Cheerio<any> }[] = [];

  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const $el = $(el);
    const tagName = el.tagName?.toLowerCase() || "";
    const level = parseInt(tagName.substring(1));
    headings.push({ level, $el });
  });

  // Adjust heading levels if they skip
  let lastLevel = 0;
  headings.forEach(({ level, $el }) => {
    if (level > lastLevel + 1) {
      const newLevel = lastLevel + 1;
      const newTag = `h${newLevel}`;
      const html = $el.html();
      if (html) {
        $el.replaceWith($(`<${newTag}>${html}</${newTag}>`));
      }
      lastLevel = newLevel;
    } else {
      lastLevel = level;
    }
  });
}

function unwrapRedundantElements($: cheerio.CheerioAPI): void {
  // Remove redundant nested divs and spans
  $("div > div:only-child, span > span:only-child").each((_, el) => {
    const $el = $(el);
    const html = $el.html();
    if (html) $el.replaceWith(html);
  });

  // Unwrap paragraphs that only contain another block element
  $("p").each((_, el) => {
    const $el = $(el);
    const children = $el.children();

    if (children.length === 1) {
      const tagName = children.first().prop("tagName")?.toLowerCase();
      if (
        tagName &&
        ["div", "blockquote", "pre", "ul", "ol", "table"].includes(tagName)
      ) {
        const html = $el.html();
        if (html) $el.replaceWith(html);
      }
    }
  });
}

function convertPseudoHeadings($: cheerio.CheerioAPI): void {
  // Convert divs/spans that look like headings into actual headings
  $("div, span").each((_, el) => {
    const $el = $(el);
    const text = $el.text().trim();

    // Skip if it has children that aren't just text
    if ($el.children().length > 0) return;

    // Check if it looks like a heading (short, possibly styled)
    const className = $el.attr("class") || "";
    const style = $el.attr("style") || "";

    if (
      text.length > 0 &&
      text.length < 100 &&
      (className.toLowerCase().includes("title") ||
        className.toLowerCase().includes("heading") ||
        style.includes("font-weight: bold") ||
        style.includes("font-weight:bold"))
    ) {
      // Convert to h3 by default
      const newHeading = cheerio.load(`<h3>${text}</h3>`)("h3");
      $el.replaceWith(newHeading);
    }
  });
}
