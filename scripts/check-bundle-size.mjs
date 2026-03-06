import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const rawKey = token.slice(2);
    if (rawKey.includes("=")) {
      const [key, value] = rawKey.split("=", 2);
      result[key] = value;
      continue;
    }

    const nextToken = argv[index + 1];
    if (nextToken && !nextToken.startsWith("--")) {
      result[rawKey] = nextToken;
      index += 1;
      continue;
    }

    result[rawKey] = "true";
  }
  return result;
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(2)} KiB`;
}

function loadBudget(manifestPath) {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Bundle budget manifest not found: ${manifestPath}`);
  }

  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function collectAssetSizes(assetsDir) {
  if (!fs.existsSync(assetsDir)) {
    throw new Error(`Assets directory not found: ${assetsDir}`);
  }

  return fs.readdirSync(assetsDir).map((fileName) => {
    const filePath = path.join(assetsDir, fileName);
    const stats = fs.statSync(filePath);
    return {
      fileName,
      bytes: stats.size
    };
  });
}

function evaluateBudgets(assetSizes, budgetConfig) {
  const failures = [];

  for (const budget of budgetConfig.assets) {
    const matcher = new RegExp(budget.pattern);
    const matchedAsset = assetSizes.find((asset) => matcher.test(asset.fileName));
    if (!matchedAsset) {
      failures.push(
        `Missing expected asset for ${budget.label} (${budget.pattern}).`
      );
      continue;
    }

    if (matchedAsset.bytes > budget.maxBytes) {
      failures.push(
        `${budget.label} exceeds budget: ${matchedAsset.fileName} = ${formatBytes(
          matchedAsset.bytes
        )}, limit = ${formatBytes(budget.maxBytes)}.`
      );
    } else {
      console.log(
        `[size-check] OK ${budget.label}: ${matchedAsset.fileName} = ${formatBytes(
          matchedAsset.bytes
        )} / ${formatBytes(budget.maxBytes)}`
      );
    }
  }

  return failures;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifestPath = path.resolve(process.cwd(), args.manifest ?? "bundle-budget.json");
  const distDir = path.resolve(process.cwd(), args.dir ?? "dist");
  const assetsDir = path.join(distDir, "assets");

  const budgetConfig = loadBudget(manifestPath);
  const assetSizes = collectAssetSizes(assetsDir);
  const failures = evaluateBudgets(assetSizes, budgetConfig);

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`[size-check] FAIL ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("[size-check] All bundle budgets passed.");
}

try {
  main();
} catch (error) {
  console.error(`[size-check] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
