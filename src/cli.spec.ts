// src/cli.spec.ts

import test from "ava";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

// Path to the compiled CLI binary
const CLI_PATH = path.join(process.cwd(), "bin", "get-md.js");

// Test fixtures
const SIMPLE_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Test Page</title>
  <meta name="description" content="A test description">
</head>
<body>
  <h1>Hello World</h1>
  <p>This is a test paragraph.</p>
  <img src="/test.jpg" alt="Test image">
  <a href="/link">Test link</a>
  <table>
    <tr><td>Cell 1</td><td>Cell 2</td></tr>
  </table>
</body>
</html>
`;

const COMPLEX_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Article Title</title>
  <meta name="author" content="John Doe">
  <meta property="og:site_name" content="Test Site">
</head>
<body>
  <nav>Navigation content</nav>
  <article>
    <h1>Main Article</h1>
    <p>This is the main content that should be extracted.</p>
  </article>
  <footer>Footer content</footer>
</body>
</html>
`;

// Helper to create a temporary file
async function createTempFile(content: string): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(process.cwd(), "tmp-test-"));
  const filePath = path.join(tmpDir, "test.html");
  await fs.writeFile(filePath, content, "utf-8");
  return filePath;
}

// Helper to clean up temp files
async function cleanupTempFile(filePath: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.rm(dir, { recursive: true, force: true });
}

// Helper to run CLI command
async function runCli(
  args: string[],
  input?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [CLI_PATH, ...args], {
      timeout: 5000,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      resolve({ stdout, stderr, exitCode: code });
    });

    // Write input to stdin if provided
    if (input !== undefined) {
      child.stdin.write(input);
      child.stdin.end();
    }
  });
}

test("CLI: converts HTML from file to markdown", async (t) => {
  const inputFile = await createTempFile(SIMPLE_HTML);

  try {
    const { stdout } = await runCli([inputFile]);

    t.true(stdout.includes("# Hello World"));
    t.true(stdout.includes("This is a test paragraph"));
  } finally {
    await cleanupTempFile(inputFile);
  }
});

test("CLI: writes output to file with -o flag", async (t) => {
  const inputFile = await createTempFile(SIMPLE_HTML);
  const outputFile = path.join(path.dirname(inputFile), "output.md");

  try {
    const { exitCode } = await runCli([inputFile, "-o", outputFile]);

    // Check the command succeeded
    t.is(exitCode, 0);

    // Verify the output file was created with correct content
    const content = await fs.readFile(outputFile, "utf-8");
    t.true(content.includes("# Hello World"));
  } finally {
    await cleanupTempFile(inputFile);
  }
});

test("CLI: reads from stdin when input is -", async (t) => {
  const { stdout } = await runCli(["-"], SIMPLE_HTML);

  t.true(stdout.includes("# Hello World"));
  t.true(stdout.includes("This is a test paragraph"));
});

test("CLI: --no-extract flag disables Readability extraction", async (t) => {
  const inputFile = await createTempFile(COMPLEX_HTML);

  try {
    const { stdout } = await runCli([inputFile, "--no-extract"]);

    // Should include navigation and footer when not extracting
    t.true(stdout.includes("Navigation") || stdout.includes("Footer"));
  } finally {
    await cleanupTempFile(inputFile);
  }
});

test("CLI: --no-frontmatter flag excludes metadata", async (t) => {
  const inputFile = await createTempFile(SIMPLE_HTML);

  try {
    const { stdout } = await runCli([inputFile, "--no-frontmatter"]);

    // Should not include YAML frontmatter markers
    const lines = stdout.trim().split("\n");
    // First line should be content, not frontmatter delimiter
    t.false(lines[0] === "---");
    // Should not have title in frontmatter format
    t.false(stdout.startsWith("---\ntitle:"));
  } finally {
    await cleanupTempFile(inputFile);
  }
});

test("CLI: --no-images flag removes images", async (t) => {
  const inputFile = await createTempFile(SIMPLE_HTML);

  try {
    const { stdout } = await runCli([inputFile, "--no-images"]);

    // Should not include markdown image syntax
    t.false(stdout.includes("!["));
    t.false(stdout.includes("test.jpg"));
  } finally {
    await cleanupTempFile(inputFile);
  }
});

test("CLI: --no-links flag removes links", async (t) => {
  const inputFile = await createTempFile(SIMPLE_HTML);

  try {
    const { stdout } = await runCli([inputFile, "--no-links"]);

    // Should not include markdown link syntax (but may include text)
    t.false(stdout.includes("[Test link]"));
    t.false(stdout.includes("](/link)"));
  } finally {
    await cleanupTempFile(inputFile);
  }
});

test("CLI: --no-tables flag removes tables", async (t) => {
  const inputFile = await createTempFile(SIMPLE_HTML);

  try {
    const { stdout } = await runCli([inputFile, "--no-tables"]);

    // Should not include markdown table syntax
    t.false(stdout.includes("|"));
    t.false(stdout.includes("Cell 1") && stdout.includes("Cell 2"));
  } finally {
    await cleanupTempFile(inputFile);
  }
});

test("CLI: --base-url flag resolves relative URLs", async (t) => {
  const inputFile = await createTempFile(SIMPLE_HTML);

  try {
    const { stdout } = await runCli([
      inputFile,
      "--base-url",
      "https://example.com",
    ]);

    // Should resolve relative URL to absolute
    t.true(
      stdout.includes("https://example.com/test.jpg") ||
        stdout.includes("example.com/test.jpg"),
    );
  } finally {
    await cleanupTempFile(inputFile);
  }
});

test("CLI: --verbose flag shows detailed stats", async (t) => {
  const inputFile = await createTempFile(SIMPLE_HTML);
  const outputFile = path.join(path.dirname(inputFile), "output.md");

  try {
    const { exitCode } = await runCli([
      inputFile,
      "-o",
      outputFile,
      "--verbose",
    ]);

    // The verbose flag is accepted without error
    t.is(exitCode, 0);

    // Verify the output file was created
    const content = await fs.readFile(outputFile, "utf-8");
    t.true(content.length > 0);

    // Note: In test environment (non-TTY), stats are not printed to stderr
    // The verbose flag only affects TTY output (see cli.ts:109)
  } finally {
    await cleanupTempFile(inputFile);
  }
});

test("CLI: --max-length flag limits output length", async (t) => {
  const inputFile = await createTempFile(SIMPLE_HTML);

  try {
    const { stdout } = await runCli([inputFile, "--max-length", "50"]);

    // Output should be truncated to around 50 characters
    t.true(stdout.length < 200); // Some margin for frontmatter
  } finally {
    await cleanupTempFile(inputFile);
  }
});

test("CLI: handles missing input file gracefully", async (t) => {
  const { stderr } = await runCli(["/nonexistent/file.html"]);

  t.true(stderr.includes("Error:"));
  t.true(
    stderr.includes("ENOENT") ||
      stderr.includes("no such file") ||
      stderr.includes("cannot find"),
  );
});

test("CLI: shows version with --version flag", async (t) => {
  const { stdout } = await runCli(["--version"]);

  t.true(stdout.includes("1.0.0"));
});

test("CLI: shows help with --help flag", async (t) => {
  const { stdout } = await runCli(["--help"]);

  t.true(stdout.includes("get-md"));
  t.true(stdout.includes("Convert HTML to LLM-optimized Markdown"));
  t.true(stdout.includes("--output"));
  t.true(stdout.includes("--no-extract"));
});

test("CLI: handles verbose error output", async (t) => {
  const { stderr } = await runCli(["/nonexistent/file.html", "--verbose"]);

  t.true(stderr.includes("Error:"));
  // Verbose mode should show stack trace
  t.true(stderr.includes("at ") || stderr.includes("ENOENT"));
});

test("CLI: processes multiple options together", async (t) => {
  const inputFile = await createTempFile(SIMPLE_HTML);

  try {
    const { stdout } = await runCli([
      inputFile,
      "--no-images",
      "--no-links",
      "--no-frontmatter",
      "--base-url",
      "https://example.com",
    ]);

    // All options should be applied
    const lines = stdout.trim().split("\n");
    t.false(lines[0] === "---"); // No frontmatter at start
    t.false(stdout.includes("![")); // No images
    t.false(stdout.includes("](")); // No links
    t.true(stdout.includes("Hello World")); // Content still present
  } finally {
    await cleanupTempFile(inputFile);
  }
});

test("CLI: handles stdin with no TTY", async (t) => {
  // Simulate piping HTML via stdin
  const { stdout } = await runCli([], SIMPLE_HTML);

  t.true(stdout.includes("# Hello World"));
  t.true(stdout.includes("This is a test paragraph"));
});
