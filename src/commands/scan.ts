import chalk from "chalk";
import { globby } from "globby";
import ora from "ora";
import fs from "node:fs/promises";
import path from "node:path";
import { detectFramework, analyzeImports, findGatewayCalls, findAgentPatterns } from "../lib/analyzer.js";
import type { ScanResult, CodebaseContext, EvalSuite, EvalSweepAxis } from "../types.js";

interface ScanOptions {
  dir: string;
  output?: string;
  json?: boolean;
}

export async function scanCommand(options: ScanOptions): Promise<void> {
  const spinner = ora({
    text: "Scanning codebase...",
    spinner: "dots",
  }).start();

  try {
    const targetDir = path.resolve(options.dir);

    // Find relevant files
    const files = await globby(
      [
        "**/*.{ts,tsx,js,jsx,mjs,cjs}",
        "!**/node_modules/**",
        "!**/.git/**",
        "!**/dist/**",
        "!**/build/**",
        "!**/*.d.ts",
      ],
      { cwd: targetDir, gitignore: true }
    );

    spinner.text = `Analyzing ${files.length} files...`;

    const scanResult: ScanResult = {
      targetDir,
      totalFiles: files.length,
      framework: null,
      aimSdkUsage: [],
      gatewayPatterns: [],
      agentPatterns: [],
      entryPoints: [],
      configFiles: [],
      dependencies: {},
      suggestedTestTypes: [],
    };

    // Analyze package.json
    const pkgJsonPath = path.join(targetDir, "package.json");
    try {
      const pkgJson = JSON.parse(await fs.readFile(pkgJsonPath, "utf-8"));
      scanResult.dependencies = {
        ...pkgJson.dependencies,
        ...pkgJson.devDependencies,
      };
      scanResult.framework = detectFramework(pkgJson);
    } catch {
      // No package.json found
    }

    // Analyze each file
    const context: CodebaseContext = {
      files: [],
      imports: [],
      exports: [],
      functionCalls: [],
    };

    for (let i = 0; i < Math.min(files.length, 100); i++) {
      const file = files[i];
      spinner.text = `Analyzing ${chalk.cyan(file)} (${i + 1}/${Math.min(files.length, 100)})`;

      try {
        const content = await fs.readFile(path.join(targetDir, file), "utf-8");

        context.files.push({
          path: file,
          content,
          size: content.length,
        });

        const imports = analyzeImports(content, file);
        context.imports.push(...imports);

        const gatewayCalls = findGatewayCalls(content, file);
        scanResult.gatewayPatterns.push(...gatewayCalls);

        const agentPatterns = findAgentPatterns(content, file);
        scanResult.agentPatterns.push(...agentPatterns);

        if (
          file.includes("main") ||
          file.includes("index") ||
          file.includes("app") ||
          file.includes("server")
        ) {
          if (content.length > 50) {
            scanResult.entryPoints.push(file);
          }
        }

        if (
          file.includes("config") ||
          file.endsWith(".config.js") ||
          file.endsWith(".config.ts")
        ) {
          scanResult.configFiles.push(file);
        }
      } catch (err) {
        // Skip files that can't be read
      }
    }

    // Detect AIM SDK usage
    scanResult.aimSdkUsage = context.imports.filter(
      (imp) =>
        imp.source.includes("@aim/sdk") ||
        imp.source.includes("aim") ||
        imp.source.includes("ai-management")
    );

    // Suggest test combinations
    scanResult.suggestedTestTypes = suggestTestCombinations(scanResult);

    spinner.succeed(`Scanned ${files.length} files in ${path.basename(targetDir)}`);

    // Output results
    if (options.json) {
      if (options.output) {
        await fs.writeFile(options.output, JSON.stringify(scanResult, null, 2));
        console.log(chalk.green(`\n✓ Results saved to ${options.output}\n`));
      } else {
        console.log(JSON.stringify(scanResult, null, 2));
      }
    } else {
      printScanResults(scanResult);
      if (options.output) {
        await fs.writeFile(options.output, JSON.stringify(scanResult, null, 2));
        console.log(chalk.green(`\n✓ Results saved to ${options.output}\n`));
      }
    }
  } catch (error) {
    spinner.fail("Scan failed");
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

function printScanResults(result: ScanResult): void {
  console.log("");
  const title = "📊 AIM Codebase Analysis";
  const padding = Math.max(0, 60 - title.length) / 2;
  console.log(chalk.bold("═".repeat(60)));
  console.log(chalk.bold(" ".repeat(Math.floor(padding)) + title));
  console.log(chalk.bold("═".repeat(60)));
  console.log("");

  // Framework
  console.log(chalk.bold("Framework:"));
  const frameworkIcon = getFrameworkIcon(result.framework);
  console.log(`  ${frameworkIcon} ${result.framework ?? "Generic JavaScript/TypeScript"}\n`);

  // Stats
  console.log(chalk.bold("Statistics:"));
  console.log(`  📁 Files analyzed: ${chalk.cyan(result.totalFiles)}`);
  console.log(`  🔗 AIM SDK imports: ${chalk.cyan(result.aimSdkUsage.length)}`);
  console.log(`  🌐 Gateway patterns: ${chalk.cyan(result.gatewayPatterns.length)}`);
  console.log(`  🤖 Agent patterns: ${chalk.cyan(result.agentPatterns.length)}\n`);

  // AIM SDK Usage
  if (result.aimSdkUsage.length > 0) {
    console.log(chalk.bold("AIM SDK Usage:"));
    result.aimSdkUsage.slice(0, 5).forEach((usage) => {
      console.log(`  ${chalk.cyan("→")} ${chalk.white(usage.source)}`);
      console.log(`    ${chalk.dim(usage.file)}`);
    });
    if (result.aimSdkUsage.length > 5) {
      console.log(`    ${chalk.dim(`... and ${result.aimSdkUsage.length - 5} more`)}`);
    }
    console.log("");
  }

  // Entry Points
  if (result.entryPoints.length > 0) {
    console.log(chalk.bold("Entry Points:"));
    result.entryPoints.slice(0, 5).forEach((ep) => {
      console.log(`  ${chalk.green("→")} ${ep}`);
    });
    console.log("");
  }

  // Suggested Tests
  if (result.suggestedTestTypes.length > 0) {
    console.log(chalk.bold("🎯 Recommended Test Combinations:"));
    console.log("");
    result.suggestedTestTypes.forEach((test, index) => {
      console.log(`  ${index + 1}. ${chalk.bold(test.name)}`);
      console.log(`     ${chalk.dim(`Suite: ${test.suite} | Sweep: ${test.sweepAxis}`)}`);
      console.log(`     ${chalk.green("✓")} ${test.reason}`);
      console.log("");
    });
  }

  // Next Steps
  console.log(chalk.bold("─".repeat(60)));
  console.log(chalk.bold("Next Steps:"));
  console.log(`  1. Run ${chalk.cyan("aim interview")} to configure tests`);
  console.log(`  2. Run ${chalk.cyan("aim cost")} to estimate pricing`);
  console.log(`  3. Run ${chalk.cyan("aim test")} to execute tests`);
  console.log("");
}

function getFrameworkIcon(framework: string | null): string {
  const icons: Record<string, string> = {
    react: "⚛️",
    vue: "🟢",
    svelte: "🔥",
    next: "▲",
    express: "🚂",
    nestjs: "🦁",
    angular: "🅰️",
  };
  return icons[framework ?? ""] ?? "📦";
}

function suggestTestCombinations(result: ScanResult): Array<{ name: string; suite: EvalSuite; sweepAxis: EvalSweepAxis; reason: string }> {
  const suggestions: Array<{ name: string; suite: EvalSuite; sweepAxis: EvalSweepAxis; reason: string }> = [];

  suggestions.push({
    name: "Model vs Output Quality",
    suite: "output_quality",
    sweepAxis: "model",
    reason: "Core evaluation suite for all AI agents",
  });

  suggestions.push({
    name: "Model vs Cost",
    suite: "output_quality",
    sweepAxis: "model",
    reason: "Cost analysis included in quality reports",
  });

  suggestions.push({
    name: "Model vs Latency",
    suite: "output_quality",
    sweepAxis: "model",
    reason: "Latency metrics included in quality reports",
  });

  if (result.agentPatterns.some((p) => p.type === "agent_loop" || p.type === "task_completion")) {
    suggestions.push({
      name: "Model vs Instruction Following",
      suite: "instruction_following",
      sweepAxis: "model",
      reason: "Agent pattern detected - test instruction adherence",
    });
  }

  if (result.agentPatterns.some((p) => p.type === "system_prompt")) {
    suggestions.push({
      name: "System Prompt vs Output Quality",
      suite: "output_quality",
      sweepAxis: "system_prompt",
      reason: "System prompt detected - compare variants",
    });

    suggestions.push({
      name: "System Prompt vs Instruction Following",
      suite: "instruction_following",
      sweepAxis: "system_prompt",
      reason: "Test prompt impact on instruction adherence",
    });
  }

  if (result.agentPatterns.some((p) => p.type === "user_input")) {
    suggestions.push({
      name: "System Prompt vs Prompt Injections",
      suite: "injection_resistance",
      sweepAxis: "system_prompt",
      reason: "User input detected - test security",
    });
  }

  return suggestions;
}
