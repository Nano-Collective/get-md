# Contributing to get-md

Thanks for your interest in contributing to get-md! We welcome contributions from everyone.

## Requirements

- [Node.js](https://nodejs.org/) 18+
- [npm](https://www.npmjs.com/) or [pnpm](https://pnpm.io/)

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Install dependencies with `npm install` or `pnpm install`
4. Build the project with `npm run build`
5. Run tests with `npm run test:all`

## How to Contribute

### Finding Work

Browse our [open issues](https://github.com/nano-collective/get-md/issues). If you find an unassigned issue you'd like to work on, comment on it to let us know you're picking it up.

### Working on an Issue

1. **Check for a spec** - Some issues include a specification or implementation details. Feel free to follow it or propose alternatives if you think you have a better approach.

2. **No spec? Write one** - If the issue lacks a spec, draft one and post it in the issue comments for approval.

### Making Changes

1. Create a new branch for your work
2. Make your changes following the existing code style
3. Test thoroughly with `npm run test:all`
4. Commit using conventional commits (feat:, fix:, docs:, etc.)
5. Push to your fork and submit a pull request

### Testing

All new features and bug fixes should include appropriate tests. We use AVA for testing with TypeScript support. Test files should have a `.spec.ts` extension and be placed alongside the source code.

### Code Style

- Use TypeScript with strict mode enabled
- Follow the existing code patterns
- Use descriptive variable and function names
- Code is auto-formatted with Biome (run `npm run format`)
