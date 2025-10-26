# Contributing to get-md

Thank you for your interest in contributing to get-md! We welcome contributions from developers of all skill levels. This guide will help you get started with contributing to the project.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Coding Standards](#coding-standards)
- [Submitting Changes](#submitting-changes)
- [Issue Guidelines](#issue-guidelines)
- [Community and Communication](#community-and-communication)

## Getting Started

Before contributing, please:

1. Read our [README](README.md) to understand what get-md does
2. Check our [issue tracker](https://github.com/nano-collective/get-md/issues) for existing issues
3. Look for issues labeled `good first issue` or `help wanted` if you're new to the project

## Development Setup

### Prerequisites

- Node.js 18+
- npm or pnpm
- Git

### Setup Steps

1. **Fork and clone the repository:**

   ```bash
   git clone https://github.com/YOUR-USERNAME/get-md.git
   cd get-md
   ```

2. **Install dependencies:**

   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Build the project:**

   ```bash
   npm run build
   ```

4. **Test your setup:**

   ```bash
   npm run test:all
   ```

5. **For development with auto-rebuild:**
   ```bash
   npm run dev
   ```

## Making Changes

### Types of Contributions

1. **Bug Fixes**: Address existing issues or problems
2. **New Features**: Add functionality (new conversion options, output formats, etc.)
3. **Improvements**: Enhance existing features or performance
4. **Documentation**: Improve README, comments, or guides
5. **Testing**: Add or improve tests

### Development Workflow

1. **Create a branch:**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes:**
   - Follow the existing code style
   - Add appropriate TypeScript types
   - Update documentation if needed

3. **Test your changes:**

   ```bash
   npm run build
   npm run test:all
   ```

4. **Commit your changes:**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

### Commit Message Convention

We follow conventional commits:

- `feat:` - New features
- `mod:` - Smaller modifications to existing features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Adding or modifying tests
- `chore:` - Build process or auxiliary tool changes

## Testing

### Automated Testing Requirements

All new features and bug fixes should include appropriate tests:

1. **Test Suite**: We use AVA for testing with TypeScript support
2. **Test Files**: Place test files alongside source code with `.spec.ts` extension (e.g., `src/converter.spec.ts`)
3. **Running Tests**: Execute the full test suite with:

   ```bash
   npm run test:all
   ```

   This command runs: formatting with Prettier, type checks, ESLint checks, AVA tests, and Knip.

4. **Test Requirements for PRs**:
   - New features **must** include passing tests in `.spec.ts` files
   - Bug fixes should include regression tests when possible
   - All tests must pass before merging (`npm run test:all` should complete successfully)
   - Tests should cover both success cases and error scenarios

### Manual Testing

In addition to automated tests, manual testing is important:

1. **Test conversion quality:**
   - Different HTML structures (nested elements, complex layouts)
   - Various HTML tags and attributes
   - Edge cases (empty elements, malformed HTML)

2. **Test CLI functionality:**
   - Different input sources (stdin, file, URL)
   - Various CLI options and flags
   - Output to file vs stdout

3. **Test error scenarios:**
   - Invalid HTML
   - Network failures (for URL fetching)
   - Invalid options

### Writing Tests

When adding tests:

- Use descriptive test names that explain what is being tested
- Follow the existing test patterns in the codebase
- Test edge cases and error conditions
- Keep tests focused and isolated
- Mock external dependencies (network requests) when appropriate

Example test structure:

```typescript
import test from "ava";
import { convertToMarkdown } from "./converter.js";

test("converts basic HTML to markdown", async (t) => {
  const result = await convertToMarkdown("<h1>Hello</h1><p>World</p>");
  t.true(result.markdown.includes("# Hello"));
  t.true(result.markdown.includes("World"));
});
```

## Coding Standards

### TypeScript Guidelines

- **Strict Mode**: The project uses strict TypeScript settings
- **Types First**: Always define proper TypeScript types
- **No `any`**: Avoid using `any` type; use proper type definitions
- **ESNext**: Use modern JavaScript/TypeScript features

### Code Style

- **Formatting**: Code is auto-formatted with Prettier (run `npm run format`)
- **Naming**: Use descriptive variable and function names
- **Comments**: Add comments for complex logic, not obvious code
- **Error Handling**: Always handle errors gracefully

### File Organization

- **Imports**: Group external imports, then internal imports
- **Exports**: Use named exports; avoid default exports where possible
- **Modules**: Keep files focused on a single responsibility

## Submitting Changes

### Pull Request Process

1. **Update Documentation**: If your change affects user-facing behavior
2. **Test Thoroughly**: Ensure your changes work across different scenarios
3. **Create Pull Request**: With a clear title and description

### Pull Request Template

```markdown
## Description

Brief description of what this PR does

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

- [ ] Tests added/updated
- [ ] Manual testing completed
- [ ] All tests passing (`npm run test:all`)

## Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated (if needed)
- [ ] No breaking changes (or clearly documented)
```

### Review Process

- Maintainers will review your PR
- Address feedback promptly
- Be open to suggestions and changes
- Once approved, we'll merge your contribution

## Issue Guidelines

### Reporting Bugs

When reporting bugs, please include:

- **Environment**: OS, Node.js version, get-md version
- **Input**: Example HTML or URL that causes the issue
- **Steps to Reproduce**: Clear, step-by-step instructions
- **Expected vs Actual**: What should happen vs what actually happens
- **Logs**: Any relevant error messages or debug output

### Requesting Features

For feature requests:

- **Use Case**: Explain why this feature would be useful
- **Proposed Solution**: If you have ideas on implementation
- **Alternatives**: Other ways you've considered solving this
- **Additional Context**: Screenshots, examples, or references

### Issue Labels

- `bug` - Something isn't working
- `enhancement` - New feature or improvement
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention needed
- `documentation` - Documentation improvements
- `question` - Questions or discussions

## Community and Communication

### Getting Help

- **GitHub Issues**: For bugs, features, and questions
- **Discord Server**: Join our community Discord server for real-time discussions, help, and collaboration: [Join our Discord server](https://discord.gg/ktPDV6rekE)

### Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help create a welcoming environment for all contributors
- Remember that everyone is learning and contributing voluntarily

### Recognition

All contributors are recognized in the project. We appreciate:

- Code contributions
- Bug reports and testing
- Documentation improvements
- Feature suggestions and feedback
- Community support and discussions

## Development Tips

### Working with HTML Parsing

- Test with various HTML structures and edge cases
- Consider how Readability and Turndown interact
- Handle malformed HTML gracefully

### Conversion Quality

- Verify markdown output is clean and well-formatted
- Ensure heading hierarchy is preserved
- Test with real-world websites and documents

### Performance

- Profile conversion speed with large documents
- Minimize unnecessary DOM manipulations
- Consider memory usage with large inputs

### CLI Development

- Maintain consistent interface with existing options
- Provide clear feedback and error messages
- Handle different input sources (stdin, file, URL) properly

---

Thank you for contributing to get-md! Your efforts help make HTML to Markdown conversion better for everyone.
