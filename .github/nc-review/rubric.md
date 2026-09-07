# nc-review rubric — get-md

This is the **project** half of the rubric: what get-md cares about. The
reviewing method — how to read a diff against a base checkout, how to rate
severity, what to emit — is the shared base rubric you were also given. Read
both; where they disagree, this file wins. `AGENTS.md` is the architecture
document.

## What this project is, and why that changes review

get-md converts HTML, PDF, DOCX and Markdown into Markdown **optimised for LLM
consumption**. The pipeline is roughly: extract → parse → convert → optimise.

Two properties follow, and they pull against each other.

**The input is untrusted, by definition.** Nobody converts a document they wrote
themselves — they convert one they were sent or scraped. So every parser and
extractor is an attack surface fed by a stranger, and the failure modes are the
classic document ones rather than anything exotic.

**The output is fed to a model.** So silent content loss is worse than it looks:
a section dropped in conversion does not produce an error, it produces a
confident answer from an LLM that never saw the paragraph that mattered. Losing
content quietly is a real defect, not a cosmetic one.

## Where to look hardest

### Untrusted document parsing

For any change to `src/parsers`, `src/extractors` or `src/converters`, ask what
a malicious file does to it:

- **DOCX is a zip.** Check for zip-slip on entry paths, decompression bombs, and
  entry counts or sizes taken on trust.
- **XML inside DOCX** — external entity expansion and billion-laughs, if a new
  parser is introduced or an existing one reconfigured.
- **PDF** — malformed structures, deeply nested or recursive objects, unbounded
  page or object loops.
- **HTML** — deeply nested elements causing stack exhaustion.
- **Regex over document text** — catastrophic backtracking. A pattern with
  nested quantifiers applied to attacker-supplied content is a finding, and this
  codebase runs a lot of regex over prose.
- **Resource bounds generally** — a converter that will happily allocate
  proportional to whatever the file claims is a denial-of-service on the calling
  process.

A crash on a malformed file is `important` and honest. **Silent truncation on a
malformed file is worse**, because the caller cannot tell.

### Fidelity and content loss

`docx-converter-fidelity.spec.ts` exists because fidelity is a tracked property
here, not an afterthought. When a converter changes, ask what happens to the
constructs that are easy to drop: nested lists, tables, footnotes, code blocks,
links, images, headings that come from styles rather than heading levels.

A change that improves output for one document shape usually degrades another.
If the PR does not say which, that is worth asking about.

### The optimiser must not change meaning

`src/optimizers` exists to make output cheaper for a model to read. Whitespace,
boilerplate and redundancy are fair game. **Content is not.** An optimiser that
drops a table header, collapses distinct sections, or removes text that carried
meaning has broken the product's contract while appearing to do its job.

### LLM-backed conversion

`llm-converter`, `remote-llm-converter` and `llm-manager` send document content
to a model, local or remote. Check that a remote path is opt-in and obvious,
that API keys stay out of logs and error messages, and that a local path
degrades sensibly when the model is unavailable rather than silently producing
worse output.

## Public contracts

Breaking these is `blocking` without a changeset and a deliberate bump:

- The exported API from `src/index.ts` — this is a library first.
- CLI flags and their semantics, including `batch`.
- The config shape.
- Output stability in the sense that matters: callers pipe this into prompts, so
  a change that reshapes typical output is a behavioural break even when no
  signature changes.

## Tests

Tests are colocated as `src/**/*.spec.ts`. Ava excludes `*-helpers.ts` and
`test-helpers.ts`, so shared fixtures belong in those.

For a parser or converter change, the useful tests are:

- a **real fixture document**, not a hand-written string that happens to parse
- the **malformed** case — truncated, wrong magic bytes, absurd nesting
- the **fidelity** case — the construct the change was meant to improve, and at
  least one it could plausibly have broken

A converter test asserting only that output is non-empty proves nothing here.

## Scope

New format support is a large commitment: a new parser is a new attack surface
and a new fidelity burden forever. That is not a reason to refuse one, but it is
a reason to expect the malformed-input tests up front rather than later.
