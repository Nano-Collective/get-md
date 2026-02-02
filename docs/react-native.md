# React Native Support

get-md **fully supports React Native** including content extraction. We use `happy-dom-without-node` instead of JSDOM, which works across Node.js, React Native, and browser environments.

## Usage

```typescript
import { convertToMarkdown } from "@nanocollective/get-md";

// Works in React Native with full features!
const result = await convertToMarkdown(html, {
  extractContent: true, // Readability extraction works!
  includeMeta: true,
  // ... all other options work
});
```

## Supported Features

All features work in React Native:

- HTML to Markdown conversion
- Mozilla Readability content extraction
- Metadata extraction
- Content cleaning and optimization
- All formatting options

No special configuration needed!

## Notes

- The LLM-powered conversion feature requires Node.js and is not available in React Native environments
- URL fetching works but may require additional configuration for network permissions in your React Native app
