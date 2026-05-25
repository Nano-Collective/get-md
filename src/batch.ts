// src/batch.ts

// Batch conversion: run `convertToMarkdown` across many URLs with bounded
// concurrency. Two surfaces:
//
// - `convertBatch(urls, options)` is an async iterator that yields per-URL
//   results AS THEY COMPLETE. Best for huge batches and streaming output
//   (CLI JSONL, server-sent events, progress bars).
// - `convertBatchAll(urls, options)` is the Promise-based convenience that
//   resolves to an array. Use for small batches when you want the whole
//   result set in memory anyway.

import { convertToMarkdown } from "./index.js";
import type { BatchOptions, BatchResult } from "./types.js";

const DEFAULT_CONCURRENCY = 5;

interface QueuedTask {
  index: number;
  url: string;
}

/**
 * Convert a list of URLs to Markdown with bounded concurrency. Yields one
 * `BatchResult` per URL as it completes (NOT in input order).
 *
 * @example
 * ```typescript
 * import { convertBatch } from '@nanocollective/get-md';
 *
 * for await (const result of convertBatch(urls, { concurrency: 5 })) {
 *   if (result.status === 'ok') {
 *     console.log(`${result.url}: ${result.stats.estimatedTokens} tokens`);
 *   } else {
 *     console.error(`${result.url}: ${result.error.message}`);
 *   }
 * }
 * ```
 */
export async function* convertBatch(
  urls: string[],
  options: BatchOptions = {},
): AsyncGenerator<BatchResult, void, void> {
  const concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY);
  const continueOnError = options.continueOnError !== false;
  const total = urls.length;
  let completed = 0;

  if (urls.length === 0) return;

  // Strip the batch-only fields before passing the rest down to
  // convertToMarkdown so it doesn't see anything it doesn't understand.
  const {
    concurrency: _c,
    continueOnError: _ce,
    onProgress,
    ...passthrough
  } = options;
  void _c;
  void _ce;

  // Worker pool: each worker pulls from the queue until empty. Results are
  // streamed through a small in-memory channel so they surface as soon as
  // they're ready, in completion order.
  const queue: QueuedTask[] = urls.map((url, index) => ({ index, url }));

  // Channel: pending Promises emit results; the iterator awaits them in
  // arrival order via Promise.race semantics over the active worker set.
  const ready: BatchResult[] = [];
  let pendingResolve: (() => void) | null = null;
  let finishedWorkers = 0;
  let firstError: Error | null = null;

  const wakeIterator = () => {
    if (pendingResolve) {
      const r = pendingResolve;
      pendingResolve = null;
      r();
    }
  };

  const worker = async (): Promise<void> => {
    while (queue.length > 0) {
      const task = queue.shift();
      if (!task) break;

      const result = await runOne(task.url, passthrough);
      ready.push(result);
      completed++;

      if (onProgress) {
        await onProgress({
          completed,
          total,
          url: result.url,
          status: result.status,
        });
      }

      if (result.status === "error" && !continueOnError) {
        firstError = result.error;
        queue.length = 0; // drain so other workers exit
      }

      wakeIterator();
    }
  };

  const workerCount = Math.min(concurrency, urls.length);
  const workers: Promise<void>[] = [];
  for (let i = 0; i < workerCount; i++) {
    workers.push(
      worker().finally(() => {
        finishedWorkers++;
        wakeIterator();
      }),
    );
  }

  // Yield results as they arrive. When the buffer is empty but workers are
  // still alive, park on a Promise that the next completion resolves.
  while (true) {
    while (ready.length > 0) {
      const next = ready.shift() as BatchResult;
      yield next;
    }
    if (finishedWorkers === workerCount) break;
    await new Promise<void>((resolve) => {
      pendingResolve = resolve;
    });
  }

  // Surface any non-recoverable error AFTER draining the buffer so callers
  // see the partial results that did succeed.
  await Promise.all(workers);
  if (firstError && !continueOnError) {
    throw firstError;
  }
}

/**
 * Promise-based convenience over `convertBatch`. Buffers every result in
 * memory — use for small batches; reach for `convertBatch` directly when
 * the URL list is large or you want to stream output.
 */
export async function convertBatchAll(
  urls: string[],
  options: BatchOptions = {},
): Promise<BatchResult[]> {
  const results: BatchResult[] = [];
  for await (const result of convertBatch(urls, options)) {
    results.push(result);
  }
  return results;
}

async function runOne(
  url: string,
  options: BatchOptions,
): Promise<BatchResult> {
  try {
    const result = await convertToMarkdown(url, { ...options, isUrl: true });
    return {
      status: "ok",
      url,
      markdown: result.markdown,
      metadata: result.metadata,
      stats: result.stats,
    };
  } catch (error) {
    return {
      status: "error",
      url,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
