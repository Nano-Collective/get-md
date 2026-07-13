import * as cheerio from "cheerio/slim";

/**
 * Recover the original Mermaid source text from HTML that contains rendered Mermaid diagrams.
 * This ensures that diagram content is not lost during HTML-to-Markdown conversion when
 * client-side scripts have already executed.
 */
export function recoverMermaid(html: string): string {
  const $ = cheerio.load(html);

  const selectors = [
    ".mermaid",
    "pre.mermaid",
    "[data-processed='true']",
    "svg[id^='mermaid-']",
    "svg.mermaid",
  ];

  const processedNodes = new Set();

  $(selectors.join(", ")).each((_, el) => {
    let $container = $(el);

    if ($container.is("svg")) {
      const $parent = $container.parent();
      if ($parent.is("div") || $parent.is("pre") || $parent.is("figure")) {
        $container = $parent;
      }
    }

    if (processedNodes.has($container[0])) return;
    processedNodes.add($container[0]);

    const source = extractMermaidSource($container);

    if (source) {
      const $code = $("<code></code>")
        .addClass("language-mermaid")
        .text(source);
      const $pre = $("<pre></pre>").append($code);
      $container.replaceWith($pre);
    }
  });

  return $.html();
}

function extractMermaidSource($container: cheerio.Cheerio<any>): string | null {
  const $script = $container.find('script[type="text/mermaid"]').first();
  if ($script.length > 0) {
    const text = $script.text().trim();
    if (text) return text;
  }
  const $siblingScript = $container
    .siblings('script[type="text/mermaid"]')
    .first();
  if ($siblingScript.length > 0) {
    const text = $siblingScript.text().trim();
    if (text) return text;
  }

  const dataAttrs = [
    "data-code",
    "data-mermaid",
    "data-src",
    "data-original",
    "data-source",
  ];
  for (const attr of dataAttrs) {
    const val = $container.attr(attr);
    if (val) return val.trim();
  }

  if ($container.is("pre") && $container.find("svg").length === 0) {
    const text = $container.text().trim();
    if (text) return text;
  }

  const $hidden = $container
    .find("pre[hidden], template, textarea[hidden]")
    .add($container.siblings("pre[hidden], template, textarea[hidden]"))
    .first();
  if ($hidden.length > 0) {
    const text = $hidden.text().trim() || $hidden.val()?.toString().trim();
    if (text) return text;
  }

  const $svg = $container.is("svg")
    ? $container
    : $container.find("svg").first();
  if ($svg.length > 0) {
    const desc = $svg.find("desc").first().text().trim();
    if (desc && isLikelyMermaidSource(desc)) {
      return desc;
    }
    const title = $svg.find("title").first().text().trim();
    if (title && isLikelyMermaidSource(title)) {
      return title;
    }
    const ariaLabel = $svg.attr("aria-label")?.trim();
    if (ariaLabel && isLikelyMermaidSource(ariaLabel)) {
      return ariaLabel;
    }
  }

  return null;
}

/**
 * Validates if the fallback text is actually a Mermaid source and not just
 * accessibility text like "Created with Mermaid" or "flowchart".
 */
function isLikelyMermaidSource(text: string): boolean {
  if (text.includes("\n") || text.includes(";")) {
    return true;
  }

  const t = text.trim();
  const keywords = [
    "graph ",
    "sequenceDiagram",
    "gantt",
    "classDiagram",
    "stateDiagram",
    "pie",
    "flowchart ",
    "erDiagram",
    "journey",
    "gitGraph",
    "mindmap",
    "timeline",
  ];

  const hasKeyword = keywords.some((k) => t.startsWith(k));

  if (
    hasKeyword &&
    (t.includes("-->") || t.includes("->") || t.includes(":") || t.length > 20)
  ) {
    return true;
  }

  return false;
}
