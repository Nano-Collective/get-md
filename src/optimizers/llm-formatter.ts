// src/optimizers/llm-formatter.ts

/**
 * Format markdown specifically for LLM consumption
 * - Consistent spacing and structure
 * - Clear section boundaries
 * - Reduced noise and clutter
 */
export function formatForLLM(markdown: string): string {
  let formatted = markdown;

  // 1. Normalize heading levels (ensure no skipped levels)
  formatted = normalizeHeadingLevels(formatted);

  // 2. Improve list consistency
  formatted = normalizeListFormatting(formatted);

  // 3. Clean up inline formatting (remove excessive emphasis)
  formatted = cleanInlineFormatting(formatted);

  // 4. Ensure code blocks are clearly marked
  formatted = enhanceCodeBlocks(formatted);

  // 5. Improve link formatting for LLMs
  formatted = optimizeLinkFormatting(formatted);

  return formatted;
}

function normalizeHeadingLevels(markdown: string): string {
  const lines = markdown.split("\n");
  const result: string[] = [];
  let currentLevel = 0;

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);

    if (match) {
      const level = match[1].length;
      const title = match[2];

      // Don't skip heading levels
      const normalizedLevel = Math.min(level, currentLevel + 2);
      currentLevel = normalizedLevel;

      result.push(`${"#".repeat(normalizedLevel)} ${title}`);
    } else {
      result.push(line);
      if (line.trim() === "") {
        currentLevel = 0; // Reset on blank section
      }
    }
  }

  return result.join("\n");
}

function normalizeListFormatting(markdown: string): string {
  let result = markdown;

  // Ensure consistent list markers (use - for unordered)
  result = result.replace(/^\s*[*+]\s+/gm, "- ");

  // Ensure proper indentation for nested lists (2 spaces)
  const lines = result.split("\n");

  result = lines
    .map((line) => {
      if (/^(\s*)[-*+]\s+/.test(line)) {
        const indent = line.match(/^(\s*)/)?.[1].length || 0;
        const depth = Math.floor(indent / 2);
        return `${"  ".repeat(depth)}- ${line.trim().replace(/^[-*+]\s+/, "")}`;
      }
      return line;
    })
    .join("\n");

  return result;
}

function cleanInlineFormatting(markdown: string): string {
  let result = markdown;

  // Remove multiple consecutive emphasis markers (***text*** → **text**)
  result = result.replace(/\*{3,}(.+?)\*{3,}/g, "**$1**");

  // Clean up spaces inside emphasis markers only (e.g., "** text **" → "**text**")
  // This pattern matches the full emphasis span with internal spaces and removes them
  result = result.replace(/(\*{1,2})\s+([^*]+?)\s+(\*{1,2})/g, "$1$2$3");

  return result;
}

function enhanceCodeBlocks(markdown: string): string {
  // Ensure code blocks are on their own lines with spacing
  let result = markdown.replace(/([^\n])```/g, "$1\n\n```");
  result = result.replace(/```([^\n])/g, "```\n$1");

  return result;
}

function optimizeLinkFormatting(markdown: string): string {
  // Convert reference-style links to inline for simpler parsing
  const links: Map<string, string> = new Map();

  // Extract reference definitions
  let result = markdown.replace(
    /^\[([^\]]+)\]:\s*(.+)$/gm,
    (_match, ref: string, url: string) => {
      links.set(ref.toLowerCase(), url.trim());
      return "";
    },
  );

  // Replace reference-style links with inline
  result = result.replace(
    /\[([^\]]+)\]\[([^\]]*)\]/g,
    (match, text: string, ref: string) => {
      const refKey = (ref || text).toLowerCase();
      const url = links.get(refKey);
      return url ? `[${text}](${url})` : match;
    },
  );

  return result;
}
