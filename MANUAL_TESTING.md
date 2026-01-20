# Manual Testing Checklist

Use this checklist to manually verify all get-md features. Run each test and record the actual outcome.

## Prerequisites

```bash
# Build the project first
pnpm run build

# Verify automated tests pass
pnpm run test:ava
```

---

## 1. Basic Conversion

### 1.1 Convert HTML from stdin

**Command:**
```bash
echo '<h1>Hello</h1><p>World</p>' | ./bin/get-md.js
```

**Expected:** Output should contain:
```
# Hello

World
```

**Actual:**
```
[ ] Pass  [ ] Fail
Notes:
```

---

### 1.2 Convert HTML file

**Setup:**
```bash
echo '<html><body><h1>Test</h1><p>Content here</p></body></html>' > /tmp/test.html
```

**Command:**
```bash
./bin/get-md.js /tmp/test.html
```

**Expected:** Markdown output with "# Test" and "Content here"

**Actual:**
```
[ ] Pass  [ ] Fail
Notes:
```

---

### 1.3 Convert URL

**Command:**
```bash
./bin/get-md.js https://example.com
```

**Expected:** Markdown output containing "Example Domain" heading

**Actual:**
```
[ ] Pass  [ ] Fail
Notes:
```

---

### 1.4 Save to file

**Command:**
```bash
./bin/get-md.js https://example.com -o /tmp/output.md && cat /tmp/output.md
```

**Expected:** File created at `/tmp/output.md` with markdown content, console shows "✓ Written to /tmp/output.md"

**Actual:**
```
[ ] Pass  [ ] Fail
Notes:
```

---

## 2. Content Options

### 2.1 Disable content extraction (--no-extract)

**Command:**
```bash
echo '<html><body><nav>Nav</nav><article><h1>Main</h1></article><footer>Foot</footer></body></html>' | ./bin/get-md.js --no-extract
```

**Expected:** Output includes "Nav" and "Foot" (not filtered out)

**Actual:**
```
[ ] Pass  [ ] Fail
Notes:
```

---

### 2.2 Disable frontmatter (--no-frontmatter)

**Command:**
```bash
./bin/get-md.js https://example.com --no-frontmatter
```

**Expected:** Output does NOT start with `---` (no YAML frontmatter)

**Actual:**
```
[ ] Pass  [ ] Fail
Notes:
```

---

### 2.3 Disable images (--no-images)

**Command:**
```bash
echo '<h1>Test</h1><img src="test.jpg" alt="Image">' | ./bin/get-md.js --no-images
```

**Expected:** Output contains "# Test" but NOT "![" or "test.jpg"

**Actual:**
```
[ ] Pass  [ ] Fail
Notes:
```

---

### 2.4 Disable links (--no-links)

**Command:**
```bash
echo '<h1>Test</h1><a href="https://example.com">Link Text</a>' | ./bin/get-md.js --no-links
```

**Expected:** Output contains "Link Text" but NOT as a markdown link (no `](`)

**Actual:**
```
[ ] Pass  [ ] Fail
Notes:
```

---

### 2.5 Disable tables (--no-tables)

**Command:**
```bash
echo '<table><tr><td>Cell1</td><td>Cell2</td></tr></table>' | ./bin/get-md.js --no-tables
```

**Expected:** Output does NOT contain pipe characters `|`

**Actual:**
```
[ ] Pass  [ ] Fail
Notes:
```

---

### 2.6 Max length truncation (--max-length)

**Command:**
```bash
./bin/get-md.js https://example.com --max-length 100
```

**Expected:** Output is truncated, contains "[Content truncated]"

**Actual:**
```
[ ] Pass  [ ] Fail
Notes:
```

---

### 2.7 Base URL for relative links (--base-url)

**Command:**
```bash
echo '<a href="/page">Link</a>' | ./bin/get-md.js --base-url https://example.com
```

**Expected:** Output contains `https://example.com/page`

**Actual:**
```
[ ] Pass  [ ] Fail
Notes:
```

---

## 3. LLM Model Management

### 3.1 Show model info (--model-info)

**Command:**
```bash
./bin/get-md.js --model-info
```

**Expected:** Output shows:
- "LLM Model Information"
- "Recommended model: ReaderLM-v2-Q4_K_M"
- "Default path:" with a path ending in `.gguf`
- "Status:" showing "Not installed" or "Installed"
- "Available variants:" listing Q2_K, Q4_K_M, Q8_0

**Actual:**
```
[ ] Pass  [ ] Fail
Notes:
```

---

### 3.2 Show model path (--model-path)

**Command:**
```bash
./bin/get-md.js --model-path
```

**Expected:** Single line output with path ending in `.get-md/models/ReaderLM-v2-Q4_K_M.gguf`

**Actual:**
```
[ ] Pass  [ ] Fail
Notes:
```

---

### 3.3 Download model (--download-model)

**Command:**
```bash
./bin/get-md.js --download-model
```

**Expected:**
- If model exists: "Model already installed at..."
- If not: Progress bar showing download (~986MB), then "✓ Model downloaded successfully"

**Actual:**
```
[ ] Pass  [ ] Fail
Notes:
```

---

### 3.4 Remove model (--remove-model)

**Command:**
```bash
./bin/get-md.js --remove-model
```

**Expected:**
- If model exists: Prompts "Remove model at [path]? (y/n)", then "✓ Model removed successfully" on confirm
- If not: "No model installed."

**Actual:**
```
[ ] Pass  [ ] Fail
Notes:
```

---

## 4. LLM Conversion

### 4.1 Convert with LLM (--use-llm)

**Prerequisite:** Model must be downloaded first (`--download-model`)

**Command:**
```bash
echo '<h1>Hello</h1><p>This is a test paragraph.</p>' | ./bin/get-md.js --use-llm
```

**Expected:** Markdown output (may take 5-10 seconds for LLM inference)

**Actual:**
```
[ ] Pass  [ ] Fail
Notes:
```

---

### 4.2 LLM with verbose output (--use-llm -v)

**Command:**
```bash
echo '<h1>Hello</h1><p>Test content</p>' | ./bin/get-md.js --use-llm -v -o /tmp/llm-test.md
```

**Expected:** Shows "Converting with LLM..." message, then stats (Input, Output, Time)

**Actual:**
```
[ ] Pass  [ ] Fail
Notes:
```

---

### 4.3 LLM fallback when model missing

**Setup:** Remove model first if installed
```bash
./bin/get-md.js --remove-model
```

**Command:**
```bash
echo '<h1>Test</h1>' | ./bin/get-md.js --use-llm
```

**Expected:** Prompts to download model, or falls back to Turndown with message "Falling back to Turndown"

**Actual:**
```
[ ] Pass  [ ] Fail
Notes:
```

---

## 5. Comparison Mode

### 5.1 Compare Turndown vs LLM (--compare)

**Prerequisite:** Model must be downloaded

**Command:**
```bash
./bin/get-md.js https://example.com --compare
```

**Expected:**
- Shows "Running comparison: Turndown vs LLM"
- Shows "[1/2] Converting with Turndown..." with time
- Shows "[2/2] Converting with LLM..." with time
- Shows comparison table with Method, Time, Output Size
- Shows speed ratio ("LLM is Xx slower than Turndown")
- Shows size comparison

**Actual:**
```
[ ] Pass  [ ] Fail
Notes:
```

---

### 5.2 Compare with file output

**Command:**
```bash
./bin/get-md.js https://example.com --compare -o /tmp/compare.md
ls -la /tmp/compare.*.md
```

**Expected:** Creates two files:
- `/tmp/compare.turndown.md`
- `/tmp/compare.llm.md`

**Actual:**
```
[ ] Pass  [ ] Fail
Notes:
```

---

## 6. Configuration

### 6.1 Show config (--show-config)

**Command:**
```bash
./bin/get-md.js --show-config
```

**Expected:** Shows "Configuration" header, then either:
- "Config file: None found" with list of supported files
- "Config file: [path]" with loaded configuration JSON

**Actual:**
```
[ ] Pass  [ ] Fail
Notes:
```

---

### 6.2 Create and use config file

**Setup:**
```bash
echo '{"useLLM": false, "includeMeta": false}' > /tmp/.getmdrc
cd /tmp
```

**Command:**
```bash
/path/to/get-md/bin/get-md.js --show-config
```

**Expected:** Shows config file found at `/tmp/.getmdrc` with the JSON content

**Actual:**
```
[ ] Pass  [ ] Fail
Notes:
```

---

### 6.3 Config file affects conversion

**Setup:**
```bash
echo '{"includeMeta": false}' > /tmp/.getmdrc
cd /tmp
```

**Command:**
```bash
echo '<html><head><title>Test</title></head><body><h1>Hello</h1></body></html>' | /path/to/get-md/bin/get-md.js
```

**Expected:** Output does NOT start with `---` (frontmatter disabled by config)

**Actual:**
```
[ ] Pass  [ ] Fail
Notes:
```

---

### 6.4 CLI flags override config

**Setup:**
```bash
echo '{"includeMeta": false}' > /tmp/.getmdrc
cd /tmp
```

**Command:**
```bash
echo '<html><head><title>Test</title></head><body><h1>Hello</h1></body></html>' | /path/to/get-md/bin/get-md.js --frontmatter
```

**Expected:** Output DOES start with `---` (CLI flag overrides config)

**Actual:**
```
[ ] Pass  [ ] Fail
Notes:
```

---

## 7. Help & Version

### 7.1 Show help (--help)

**Command:**
```bash
./bin/get-md.js --help
```

**Expected:** Shows usage info including all options:
- `--output`, `--no-extract`, `--no-frontmatter`
- `--no-images`, `--no-links`, `--no-tables`
- `--use-llm`, `--llm-model-path`, `--llm-temperature`
- `--download-model`, `--model-info`, `--remove-model`, `--model-path`
- `--config`, `--show-config`, `--compare`

**Actual:**
```
[ ] Pass  [ ] Fail
Notes:
```

---

### 7.2 Show version (--version)

**Command:**
```bash
./bin/get-md.js --version
```

**Expected:** Shows version number (e.g., "1.0.3")

**Actual:**
```
[ ] Pass  [ ] Fail
Notes:
```

---

## 8. Error Handling

### 8.1 Missing file

**Command:**
```bash
./bin/get-md.js /nonexistent/file.html
```

**Expected:** Error message containing "ENOENT" or "no such file"

**Actual:**
```
[ ] Pass  [ ] Fail
Notes:
```

---

### 8.2 Invalid URL

**Command:**
```bash
./bin/get-md.js https://thissitedoesnotexist12345.com
```

**Expected:** Error message about failed fetch

**Actual:**
```
[ ] Pass  [ ] Fail
Notes:
```

---

### 8.3 No input provided

**Command:**
```bash
./bin/get-md.js
```

**Expected:** Error message "No input provided" or shows help

**Actual:**
```
[ ] Pass  [ ] Fail
Notes:
```

---

## 9. Example Scripts

### 9.1 Basic usage example

**Command:**
```bash
npx tsx examples/basic-usage.ts
```

**Expected:** Shows markdown output, metadata JSON, and stats JSON

**Actual:**
```
[ ] Pass  [ ] Fail
Notes:
```

---

### 9.2 Config usage example

**Command:**
```bash
npx tsx examples/config-usage.ts
```

**Expected:** Shows config search results, loaded config, merge example

**Actual:**
```
[ ] Pass  [ ] Fail
Notes:
```

---

### 9.3 LLM model management example

**Command:**
```bash
npx tsx examples/llm-model-management.ts
```

**Expected:** Shows model info, checks availability, optionally downloads

**Actual:**
```
[ ] Pass  [ ] Fail
Notes:
```

---

### 9.4 LLM conversion example

**Prerequisite:** Model must be downloaded

**Command:**
```bash
npx tsx examples/llm-conversion.ts
```

**Expected:** Shows Turndown vs LLM comparison with timing and both outputs

**Actual:**
```
[ ] Pass  [ ] Fail
Notes:
```

---

## Test Summary

| Section | Tests | Passed | Failed |
|---------|-------|--------|--------|
| 1. Basic Conversion | 4 | | |
| 2. Content Options | 7 | | |
| 3. LLM Model Management | 4 | | |
| 4. LLM Conversion | 3 | | |
| 5. Comparison Mode | 2 | | |
| 6. Configuration | 4 | | |
| 7. Help & Version | 2 | | |
| 8. Error Handling | 3 | | |
| 9. Example Scripts | 4 | | |
| **Total** | **33** | | |

## Issues Found

Use this section to document any issues for feedback:

### Issue 1
**Test:**
**Expected:**
**Actual:**
**Steps to reproduce:**

### Issue 2
**Test:**
**Expected:**
**Actual:**
**Steps to reproduce:**

### Issue 3
**Test:**
**Expected:**
**Actual:**
**Steps to reproduce:**
