// examples/llm-model-management.ts
// Demonstrates model checking, downloading, and removal

import {
  checkLLMModel,
  downloadLLMModel,
  getLLMModelInfo,
} from "@nanocollective/get-md";

async function main() {
  console.log("=== LLM Model Management Example ===\n");

  // 1. Get model information
  console.log("1. Model Information:");
  const info = getLLMModelInfo();
  console.log(`   Default path: ${info.defaultPath}`);
  console.log(`   Recommended model: ${info.recommendedModel}`);
  console.log(`   Available variants:`);
  for (const variant of info.availableModels) {
    const size = Math.round(variant.size / (1024 * 1024));
    console.log(
      `   - ${variant.name} (${size}MB, RAM: ${variant.ramRequired})`,
    );
  }

  // 2. Check if model is available
  console.log("\n2. Checking model availability...");
  const status = await checkLLMModel();
  console.log(`   Available: ${status.available}`);
  if (status.available) {
    console.log(`   Path: ${status.path}`);
    console.log(`   Size: ${status.sizeFormatted}`);
    console.log(`   Version: ${status.version}`);
  }

  // 3. Download model (if not available)
  if (!status.available) {
    console.log("\n3. Model not found. Starting download...");
    console.log("   (This will download ~986MB, press Ctrl+C to cancel)\n");

    try {
      const modelPath = await downloadLLMModel({
        onProgress: (downloaded, total, percentage) => {
          const downloadedMB = Math.round(downloaded / (1024 * 1024));
          const totalMB = Math.round(total / (1024 * 1024));
          process.stdout.write(
            `\r   Downloading: ${percentage.toFixed(1)}% (${downloadedMB}MB / ${totalMB}MB)`,
          );
        },
        onComplete: (path) => {
          console.log(`\n   Download complete!`);
          console.log(`   Saved to: ${path}`);
        },
        onError: (error) => {
          console.error(`\n   Download failed: ${error.message}`);
        },
      });

      console.log(`\n   Model ready at: ${modelPath}`);
    } catch (error) {
      console.error(`   Error: ${(error as Error).message}`);
    }
  } else {
    console.log("\n3. Model already downloaded, skipping download.");
  }

  // 4. Verify model is now available
  console.log("\n4. Verifying model...");
  const verifyStatus = await checkLLMModel();
  console.log(`   Available: ${verifyStatus.available}`);

  // 5. Optional: Remove model (uncomment to test)
  // console.log("\n5. Removing model...");
  // await removeLLMModel();
  // const afterRemoval = await checkLLMModel();
  // console.log(`   Available after removal: ${afterRemoval.available}`);

  console.log("\n=== Done ===");
}

main().catch(console.error);
