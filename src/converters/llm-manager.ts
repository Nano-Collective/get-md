// src/converters/llm-manager.ts

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createModelDownloader } from "node-llama-cpp";
import type {
  LLMDownloadOptions,
  LLMEventCallback,
  LLMModelInfo,
  LLMModelStatus,
  LLMModelVariant,
} from "../types.js";

// Model configuration
const MODEL_CONFIG = {
  name: "ReaderLM-v2-Q4_K_M",
  huggingFaceRepo: "jinaai/ReaderLM-v2-GGUF",
  fileName: "ReaderLM-v2-Q4_K_M.gguf",
  size: 986 * 1024 * 1024, // 986MB in bytes
  quantization: "Q4_K_M",
  ramRequired: "2-4GB",
  version: "2.0",
} as const;

// Available model variants for future use
const MODEL_VARIANTS: LLMModelVariant[] = [
  {
    name: "ReaderLM-v2-Q2_K",
    size: 500 * 1024 * 1024,
    quantization: "Q2_K",
    ramRequired: "1-2GB",
  },
  {
    name: "ReaderLM-v2-Q4_K_M",
    size: 986 * 1024 * 1024,
    quantization: "Q4_K_M",
    ramRequired: "2-4GB",
  },
  {
    name: "ReaderLM-v2-Q8_0",
    size: 1600 * 1024 * 1024,
    quantization: "Q8_0",
    ramRequired: "3-5GB",
  },
];

/**
 * Formats bytes into a human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(0)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
}

/**
 * Gets the default model directory path
 * Stored in ~/.get-md/models/
 */
function getDefaultModelDir(): string {
  return path.join(os.homedir(), ".get-md", "models");
}

/**
 * Gets the default model file path
 */
function getDefaultModelPath(): string {
  return path.join(getDefaultModelDir(), MODEL_CONFIG.fileName);
}

/**
 * Ensures the model directory exists
 */
async function ensureModelDir(modelPath: string): Promise<void> {
  const dir = path.dirname(modelPath);
  await fs.promises.mkdir(dir, { recursive: true });
}

/**
 * LLM Manager - handles model availability checking, downloading, and management
 */
export class LLMManager {
  private modelPath: string;
  private eventCallback?: LLMEventCallback;

  constructor(options?: { modelPath?: string; onEvent?: LLMEventCallback }) {
    this.modelPath = options?.modelPath ?? getDefaultModelPath();
    this.eventCallback = options?.onEvent;
  }

  /**
   * Emit an event to the callback if registered
   */
  private async emit(event: Parameters<LLMEventCallback>[0]): Promise<void> {
    if (this.eventCallback) {
      await this.eventCallback(event);
    }
  }

  /**
   * Check if the model is available locally
   */
  async checkModel(): Promise<LLMModelStatus> {
    await this.emit({ type: "model-check", status: "checking" });

    try {
      const stats = await fs.promises.stat(this.modelPath);

      if (stats.isFile() && stats.size > 0) {
        await this.emit({
          type: "model-check",
          status: "found",
          path: this.modelPath,
        });

        return {
          available: true,
          path: this.modelPath,
          size: stats.size,
          sizeFormatted: formatBytes(stats.size),
          version: MODEL_CONFIG.version,
        };
      }
    } catch {
      // File doesn't exist
    }

    await this.emit({ type: "model-check", status: "not-found" });

    return {
      available: false,
      path: this.modelPath,
    };
  }

  /**
   * Get the model path
   */
  getModelPath(): string {
    return this.modelPath;
  }

  /**
   * Download the model with progress tracking
   */
  async downloadModel(options?: LLMDownloadOptions): Promise<string> {
    const targetPath = options?.modelPath ?? this.modelPath;

    await ensureModelDir(targetPath);

    await this.emit({
      type: "download-start",
      modelName: MODEL_CONFIG.name,
      totalSize: MODEL_CONFIG.size,
    });

    try {
      const downloader = await createModelDownloader({
        modelUri: `hf:${MODEL_CONFIG.huggingFaceRepo}/${MODEL_CONFIG.fileName}`,
        dirPath: path.dirname(targetPath),
        fileName: path.basename(targetPath),
        onProgress: (progress) => {
          const downloaded = progress.downloadedSize;
          const total = progress.totalSize;
          const percentage = total > 0 ? (downloaded / total) * 100 : 0;

          // Calculate speed if available
          let speed: string | undefined;
          if (progress.downloadedSize && progress.totalSize) {
            // Speed calculation would need time tracking, simplified for now
            speed = undefined;
          }

          // Emit unified event
          void this.emit({
            type: "download-progress",
            downloaded,
            total,
            percentage,
            speed,
          });

          // Call simplified callback if provided
          if (options?.onProgress) {
            options.onProgress(downloaded, total, percentage);
          }
        },
      });

      // Start the download
      const resolvedPath = await downloader.download();

      await this.emit({
        type: "download-complete",
        path: resolvedPath,
        size: MODEL_CONFIG.size,
      });

      if (options?.onComplete) {
        options.onComplete(resolvedPath);
      }

      return resolvedPath;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      await this.emit({
        type: "download-error",
        error: err,
      });

      if (options?.onError) {
        options.onError(err);
      }

      throw err;
    }
  }

  /**
   * Remove the downloaded model
   */
  async removeModel(): Promise<void> {
    try {
      await fs.promises.unlink(this.modelPath);
    } catch (error) {
      // Ignore if file doesn't exist
      const err = error as NodeJS.ErrnoException;
      if (err.code !== "ENOENT") {
        throw error;
      }
    }
  }

  /**
   * Get information about available models
   */
  static getModelInfo(): LLMModelInfo {
    return {
      defaultPath: getDefaultModelPath(),
      recommendedModel: MODEL_CONFIG.name,
      availableModels: MODEL_VARIANTS,
    };
  }
}

// ============================================================================
// Exported utility functions (for SDK API)
// ============================================================================

/**
 * Check if the LLM model is available locally
 *
 * @example
 * ```typescript
 * const status = await checkLLMModel();
 * console.log(status.available); // false
 * console.log(status.path); // ~/.get-md/models/ReaderLM-v2-Q4_K_M.gguf
 * ```
 */
export async function checkLLMModel(options?: {
  modelPath?: string;
}): Promise<LLMModelStatus> {
  const manager = new LLMManager({ modelPath: options?.modelPath });
  return manager.checkModel();
}

/**
 * Download the LLM model with progress tracking
 *
 * @example
 * ```typescript
 * await downloadLLMModel({
 *   onProgress: (downloaded, total, percentage) => {
 *     console.log(`Downloading: ${percentage.toFixed(1)}%`);
 *   },
 *   onComplete: (path) => {
 *     console.log(`Model ready at: ${path}`);
 *   }
 * });
 * ```
 */
export async function downloadLLMModel(
  options?: LLMDownloadOptions,
): Promise<string> {
  const manager = new LLMManager({ modelPath: options?.modelPath });
  return manager.downloadModel(options);
}

/**
 * Remove the downloaded LLM model
 *
 * @example
 * ```typescript
 * await removeLLMModel();
 * ```
 */
export async function removeLLMModel(options?: {
  modelPath?: string;
}): Promise<void> {
  const manager = new LLMManager({ modelPath: options?.modelPath });
  return manager.removeModel();
}

/**
 * Get information about the LLM model
 *
 * @example
 * ```typescript
 * const info = getLLMModelInfo();
 * console.log(info.recommendedModel); // "ReaderLM-v2-Q4_K_M"
 * console.log(info.defaultPath); // ~/.get-md/models/ReaderLM-v2-Q4_K_M.gguf
 * ```
 */
export function getLLMModelInfo(): LLMModelInfo {
  return LLMManager.getModelInfo();
}
