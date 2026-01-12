// examples/config-usage.ts
// Demonstrates configuration file loading and merging

import {
  findConfigPath,
  type GetMdConfig,
  loadConfig,
  mergeConfigWithOptions,
} from "@nanocollective/get-md";

async function main() {
  console.log("=== Configuration Usage Example ===\n");

  // 1. Find config file
  console.log("1. Searching for config file...");
  const configPath = findConfigPath();
  if (configPath) {
    console.log(`   Found: ${configPath}`);
  } else {
    console.log("   No config file found.");
    console.log(
      "   Supported files: .getmdrc, .getmdrc.json, get-md.config.json, getmd.config.json",
    );
    console.log("   Search locations: current directory, home directory");
  }

  // 2. Load config
  console.log("\n2. Loading configuration...");
  const config = loadConfig();
  console.log("   Loaded config:", JSON.stringify(config, null, 2));

  // 3. Example of merging config with options
  console.log("\n3. Merging config with CLI options...");

  const fileConfig: GetMdConfig = {
    useLLM: true,
    llmTemperature: 0.5,
    extractContent: true,
    includeMeta: true,
  };
  console.log("   File config:", JSON.stringify(fileConfig, null, 2));

  const cliOptions = {
    useLLM: false, // CLI overrides file config
    maxLength: 50000,
  };
  console.log("   CLI options:", JSON.stringify(cliOptions, null, 2));

  const merged = mergeConfigWithOptions(fileConfig, cliOptions);
  console.log("   Merged result:", JSON.stringify(merged, null, 2));
  console.log(
    "   Note: CLI options (useLLM: false) override file config (useLLM: true)",
  );

  // 4. Example config file content
  console.log("\n4. Example .getmdrc file:");
  const exampleConfig = {
    useLLM: true,
    llmTemperature: 0.1,
    llmFallback: true,
    extractContent: true,
    includeMeta: true,
    includeImages: true,
    includeLinks: true,
    includeTables: true,
    aggressiveCleanup: true,
    maxLength: 1000000,
  };
  console.log(JSON.stringify(exampleConfig, null, 2));

  console.log("\n=== Done ===");
}

main().catch(console.error);
