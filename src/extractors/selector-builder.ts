// src/extractors/selector-builder.ts

/**
 * Build smart CSS selectors based on field name and type
 */
export function buildSelectors(fieldName: string, fieldType: string): string[] {
  const normalized = fieldName.toLowerCase().replace(/_/g, '-');
  const selectors: string[] = [];

  // 1. Semantic HTML / Microdata / Open Graph
  selectors.push(
    `[itemprop="${normalized}"]`,
    `[property="og:${normalized}"]`,
    `[property="article:${normalized}"]`,
    `meta[name="${normalized}"]`,
    `meta[property="${normalized}"]`
  );

  // 2. Data attributes
  selectors.push(`[data-${normalized}]`, `[data-field="${normalized}"]`);

  // 3. Class-based
  selectors.push(
    `.${normalized}`,
    `[class*="${normalized}"]`,
    `[class$="-${normalized}"]`,
    `[class^="${normalized}-"]`
  );

  // 4. ID-based
  selectors.push(`#${normalized}`, `[id*="${normalized}"]`);

  // 5. Field-specific selectors
  const specificSelectors = getFieldSpecificSelectors(fieldName, fieldType);
  selectors.push(...specificSelectors);

  return selectors;
}

function getFieldSpecificSelectors(
  fieldName: string,
  fieldType: string
): string[] {
  const name = fieldName.toLowerCase();
  const selectors: string[] = [];

  // Common field patterns
  const patterns: Record<string, string[]> = {
    title: [
      'h1',
      'h2',
      '.title',
      '.headline',
      '.entry-title',
      '.post-title',
      '.article-title',
      '[role="heading"]',
      'meta[property="og:title"]',
      'meta[name="twitter:title"]',
    ],

    author: [
      '.author',
      '.byline',
      '.author-name',
      '.post-author',
      '[rel="author"]',
      'meta[name="author"]',
      '[itemprop="author"]',
      '.entry-author',
    ],

    date: [
      'time',
      '.date',
      '.published',
      '.post-date',
      '.entry-date',
      'meta[property="article:published_time"]',
      'meta[name="publish-date"]',
      '[itemprop="datePublished"]',
    ],

    description: [
      'meta[name="description"]',
      'meta[property="og:description"]',
      'meta[name="twitter:description"]',
      '.description',
      '.excerpt',
      '.summary',
      '[itemprop="description"]',
    ],

    image: [
      'meta[property="og:image"]',
      'meta[name="twitter:image"]',
      'img.featured',
      'img.hero',
      '.hero-image img',
      '.featured-image img',
      '[itemprop="image"]',
    ],

    url: [
      'link[rel="canonical"]',
      'meta[property="og:url"]',
      '[itemprop="url"]',
    ],

    price: [
      '.price',
      '[itemprop="price"]',
      '.product-price',
      'meta[property="product:price:amount"]',
    ],

    rating: [
      '.rating',
      '[itemprop="ratingValue"]',
      '.star-rating',
      'meta[property="rating"]',
    ],

    category: [
      '.category',
      '.tag',
      '[rel="category"]',
      'meta[property="article:section"]',
    ],
  };

  // Match field name to known patterns
  for (const [pattern, patternSelectors] of Object.entries(patterns)) {
    if (name.includes(pattern) || pattern.includes(name)) {
      selectors.push(...patternSelectors);
    }
  }

  // Type-specific selectors
  if (fieldType === 'number' || fieldType === 'integer') {
    selectors.push('[type="number"]', 'input[inputmode="numeric"]');
  }

  if (name.includes('email')) {
    selectors.push('[type="email"]', 'a[href^="mailto:"]');
  }

  if (name.includes('phone') || name.includes('tel')) {
    selectors.push('[type="tel"]', 'a[href^="tel:"]');
  }

  if (name.includes('link') || name.includes('url')) {
    selectors.push('a[href]');
  }

  return selectors;
}
