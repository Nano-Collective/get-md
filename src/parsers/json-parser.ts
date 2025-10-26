// src/parsers/json-parser.ts

import * as cheerio from 'cheerio';
import Ajv from 'ajv';
import { buildSelectors } from '../extractors/selector-builder.js';
import { normalizeData } from '../extractors/data-normalizer.js';
import type {
  JsonExtractionOptions,
  JsonSchema,
  JsonResult,
} from '../types.js';

export class JsonParser {
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      coerceTypes: true, // Automatically coerce types
    });
  }

  async extract<T = any>(
    html: string,
    schema: JsonSchema,
    options: JsonExtractionOptions = {}
  ): Promise<JsonResult<T>> {
    const startTime = Date.now();

    // Load HTML
    const $ = cheerio.load(html);

    // Extract data based on schema
    const { data, warnings } = this.extractBySchema($, schema, options);

    // Normalize extracted data
    const normalized = normalizeData(data, schema.schema);

    // Validate against schema
    let validationWarnings: string[] = [];
    if (options.strict !== false) {
      try {
        this.validate(normalized, schema.schema);
      } catch (error) {
        if (options.partial) {
          validationWarnings.push((error as Error).message);
        } else {
          throw error;
        }
      }
    }

    const allWarnings = [...warnings, ...validationWarnings];

    const processingTime = Date.now() - startTime;

    // Calculate stats
    const properties = schema.schema.properties || {};
    const fieldsExtracted = Object.keys(normalized).length;
    const fieldsMissing = Object.keys(properties).length - fieldsExtracted;

    return {
      data: normalized as T,
      stats: {
        inputLength: html.length,
        processingTime,
        fieldsExtracted,
        fieldsMissing,
      },
      warnings: allWarnings.length > 0 ? allWarnings : undefined,
    };
  }

  private extractBySchema(
    $: cheerio.CheerioAPI,
    schema: JsonSchema,
    options: JsonExtractionOptions
  ): { data: any; warnings: string[] } {
    const result: any = {};
    const warnings: string[] = [];
    const properties = schema.schema.properties || {};

    for (const [key, propSchema] of Object.entries(properties)) {
      let value: any;

      // 1. Try custom selector if provided
      if (options.selectors?.[key]) {
        value = this.extractWithSelector(
          $,
          options.selectors[key],
          propSchema,
          options.baseUrl
        );
      }

      // 2. Try auto-detection if enabled and no value yet
      if (value === undefined && options.autoDetect !== false) {
        value = this.autoExtract($, key, propSchema, options.baseUrl);
      }

      if (value !== undefined && value !== null) {
        result[key] = value;
      } else if (schema.schema.required?.includes(key)) {
        warnings.push(`Required field "${key}" not found`);
      }
    }

    return { data: result, warnings };
  }

  private extractWithSelector(
    $: cheerio.CheerioAPI,
    selector: string,
    schema: any,
    baseUrl?: string
  ): any {
    const elements = $(selector);

    if (elements.length === 0) return undefined;

    // Handle arrays
    if (schema.type === 'array') {
      return elements
        .map((_, el) => {
          return this.extractValue($(el), schema.items, baseUrl);
        })
        .get()
        .filter((v) => v !== undefined);
    }

    // Handle single values
    return this.extractValue(elements.first(), schema, baseUrl);
  }

  private autoExtract(
    $: cheerio.CheerioAPI,
    fieldName: string,
    schema: any,
    baseUrl?: string
  ): any {
    // Generate smart selectors based on field name
    const selectors = buildSelectors(fieldName, schema.type);

    for (const selector of selectors) {
      try {
        const elements = $(selector);
        if (elements.length > 0) {
          if (schema.type === 'array') {
            const values = elements
              .map((_, el) => this.extractValue($(el), schema.items, baseUrl))
              .get()
              .filter((v) => v !== undefined && v !== '');

            if (values.length > 0) return values;
          } else {
            const value = this.extractValue(elements.first(), schema, baseUrl);
            if (value !== undefined && value !== '') return value;
          }
        }
      } catch {
        // Continue to next selector if this one fails
        continue;
      }
    }

    return undefined;
  }

  private extractValue(
    $el: cheerio.Cheerio<any>,
    schema: any,
    baseUrl?: string
  ): any {
    if ($el.length === 0) return undefined;

    const tagName = $el.prop('tagName')?.toLowerCase();
    let value: string | undefined;

    // Extract based on element type
    if (tagName === 'meta') {
      value = $el.attr('content');
    } else if (tagName === 'img') {
      value = $el.attr('src') || $el.attr('data-src');
      // Resolve relative URLs
      if (value && baseUrl && !value.startsWith('http')) {
        try {
          value = new URL(value, baseUrl).href;
        } catch {}
      }
    } else if (tagName === 'a') {
      value = $el.attr('href');
      if (value && baseUrl && !value.startsWith('http')) {
        try {
          value = new URL(value, baseUrl).href;
        } catch {}
      }
    } else if (tagName === 'time') {
      value = $el.attr('datetime') || $el.text();
    } else {
      value = $el.text().trim();
    }

    // Convert to schema type
    return this.convertType(value, schema.type);
  }

  private convertType(value: string | undefined, type: string): any {
    if (value === undefined || value === '') return undefined;

    switch (type) {
      case 'number':
        const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
        return isNaN(num) ? undefined : num;

      case 'integer':
        const int = parseInt(value.replace(/[^0-9-]/g, ''), 10);
        return isNaN(int) ? undefined : int;

      case 'boolean':
        const lower = value.toLowerCase();
        if (lower === 'true' || lower === 'yes' || lower === '1') return true;
        if (lower === 'false' || lower === 'no' || lower === '0') return false;
        return undefined;

      case 'string':
      default:
        return value;
    }
  }

  private validate(data: any, schema: Record<string, any>): void {
    const valid = this.ajv.validate(schema, data);

    if (!valid && this.ajv.errors) {
      const errors = this.ajv.errors
        .map((e) => `${e.instancePath || 'root'} ${e.message}`)
        .join('; ');
      throw new Error(`Schema validation failed: ${errors}`);
    }
  }
}
