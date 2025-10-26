// src/extractors/data-normalizer.ts

/**
 * Normalize extracted data based on schema
 */
export function normalizeData(data: any, schema: Record<string, any>): any {
  if (!data || typeof data !== 'object') return data;

  const normalized: any = Array.isArray(data) ? [] : {};
  const properties = schema.properties || {};

  for (const [key, value] of Object.entries(data)) {
    const propSchema = properties[key];

    if (!propSchema) {
      normalized[key] = value;
      continue;
    }

    normalized[key] = normalizeValue(value, propSchema);
  }

  return normalized;
}

function normalizeValue(value: any, schema: any): any {
  if (value === null || value === undefined) return value;

  const type = schema.type;

  switch (type) {
    case 'string':
      return normalizeString(value);

    case 'number':
    case 'integer':
      return normalizeNumber(value, type === 'integer');

    case 'boolean':
      return normalizeBoolean(value);

    case 'array':
      return normalizeArray(value, schema.items);

    case 'object':
      return normalizeData(value, schema);

    default:
      return value;
  }
}

function normalizeString(value: any): string {
  if (typeof value === 'string') {
    // Trim and normalize whitespace
    return value.trim().replace(/\s+/g, ' ');
  }
  return String(value);
}

function normalizeNumber(value: any, isInteger: boolean): number | undefined {
  if (typeof value === 'number') return isInteger ? Math.floor(value) : value;

  if (typeof value === 'string') {
    // Remove non-numeric characters except . and -
    const cleaned = value.replace(/[^0-9.-]/g, '');
    const num = isInteger ? parseInt(cleaned, 10) : parseFloat(cleaned);
    return isNaN(num) ? undefined : num;
  }

  return undefined;
}

function normalizeBoolean(value: any): boolean | undefined {
  if (typeof value === 'boolean') return value;

  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    if (['true', 'yes', '1', 'on'].includes(lower)) return true;
    if (['false', 'no', '0', 'off'].includes(lower)) return false;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  return undefined;
}

function normalizeArray(value: any, itemsSchema: any): any[] {
  if (!Array.isArray(value)) {
    value = [value];
  }

  return value
    .map((item: any) => (itemsSchema ? normalizeValue(item, itemsSchema) : item))
    .filter((item: any) => item !== undefined && item !== null);
}
