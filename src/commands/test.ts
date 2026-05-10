import chalk from "chalk";
import ora from "ora";
import fs from "node:fs/promises";
import path from "node:path";
import { getApiKey } from "../lib/config.js";
import { uploadTestSpec, estimateExperimentCost, getCurrentPlan, getTestCombinations } from "../lib/api.js";
import type { TestSpecification, EvalSuite, EvalSweepAxis } from "../types.js";

interface TestOptions {
  config?: string;
  dryRun?: boolean;
  interactive?: boolean;
}

export async function testCommand(options: TestOptions): Promise<void> {
  console.log(chalk.bold("\n🧪 AIM Test Runner\n"));

  try {
    // Load test configuration
    let testSpec: TestSpecification;

    if (options.config) {
      const configPath = path.resolve(options.config);
      const configContent = await fs.readFile(configPath, "utf-8");
      testSpec = JSON.parse(configContent);
    } else {
      // Look for default config files
      const defaultPaths = [
        "aim-test-spec.json",
        "aim.config.js",
        "aim.config.json",
        ".aim/config.json",
      ];

      let foundPath: string | null = null;
      for (const p of defaultPaths) {
        try {
          await fs.access(p);
          foundPath = p;
          break;
        } catch {
          continue;
        }
      }

      if (!foundPath) {
        console.log(chalk.yellow("No test configuration found."));
        console.log("Run one of the following to create a test spec:");
        console.log(`  ${chalk.cyan("aim interview")} - Interactive interview`);
        console.log(`  ${chalk.cyan("aim scan")} - Scan codebase for patterns`);
        process.exit(1);
      }

      const configContent = await fs.readFile(foundPath, "utf-8");
      testSpec = JSON.parse(configContent);
    }

    // Validate test spec
    if (!testSpec.testCases || testSpec.testCases.length === 0) {
      console.log(chalk.yellow("No test cases found in specification."));
      process.exit(1);
    }

    console.log(`Loaded test suite: ${chalk.bold(testSpec.name)}`);
    console.log(`Description: ${testSpec.description}`);
    console.log(`Test combinations: ${chalk.bold(testSpec.config.testCombinations.length)}`);
    console.log(`Test cases: ${chalk.bold(testSpec.testCases.length)}\n`);

    // Show test combinations
    console.log(chalk.bold("Test combinations:"));
    testSpec.config.testCombinations.forEach((combo, i) => {
      console.log(`  ${i + 1}. ${combo.name} (${combo.suite} / ${combo.sweepAxis})`);
    });
    console.log("");

    // Get API key
    const apiKey = await getApiKey();
    if (!apiKey) {
      console.log(chalk.red("\n❌ API key required. Run 'aim auth --api-key YOUR_KEY'"));
      process.exit(1);
    }

    // Get cost estimate
    const estimateSpinner = ora("Getting cost estimate...").start();
    try {
      // Get estimate for first combination
      const firstCombo = testSpec.config.testCombinations[0];
      const estimate = await estimateExperimentCost(
        {
          suite: firstCombo.suite,
          sweepAxis: firstCombo.sweepAxis,
          caseCount: testSpec.testCases.length,
          modelCount: testSpec.evalConfig.modelCandidates.length,
          promptVariantCount: testSpec.evalConfig.systemPromptVariants?.length ?? 1,
          syntheticCount: testSpec.evalConfig.syntheticCount,
        },
        apiKey
      );
      estimateSpinner.succeed("Cost estimate received");

      console.log(chalk.bold("\n💰 Cost Estimate:"));
      console.log(`  Estimated credits: ${chalk.cyan(estimate.estimate.estimatedCredits)}`);
      console.log(`  Worst case: ${chalk.cyan(estimate.estimate.worstCaseCredits)}`);
      if (estimate.currentBalance) {
        console.log(`  Current balance: ${chalk.cyan(estimate.currentBalance)}`);
      }

      if (!estimate.canProceed) {
        console.log(chalk.red("\n❌ Insufficient credits for this test run."));
        console.log("Top up your credits in the AIM dashboard.");
        process.exit(1);
      }
    } catch (error) {
      estimateSpinner.warn("Could not get cost estimate");
      console.warn(chalk.yellow("Continuing without cost estimate..."));
    }

    // Dry run mode
    if (options.dryRun) {
      console.log(chalk.bold("\n📋 Test Configurations (Dry Run):\n"));
      testSpec.config.testCombinations.forEach((combo, index) => {
        console.log(`${index + 1}. ${chalk.bold(combo.name)}`);
        console.log(`   Suite: ${combo.suite}`);
        console.log(`   Sweep Axis: ${combo.sweepAxis}`);
        console.log(`   Models: ${testSpec.evalConfig.modelCandidates.join(", ")}`);
        if (testSpec.evalConfig.systemPromptVariants) {
          console.log(`   Prompt Variants: ${testSpec.evalConfig.systemPromptVariants.length}`);
        }
        console.log("");
      });
      console.log(chalk.green("✓ Dry run complete. No tests executed."));
      return;
    }

    // Interactive confirmation
    if (options.interactive) {
      const inquirer = await import("inquirer");
      const { proceed } = await inquirer.default.prompt({
        type: "confirm",
        name: "proceed",
        message: "Proceed with creating eval experiments?",
        default: true,
      });

      if (!proceed) {
        console.log(chalk.yellow("Test execution cancelled."));
        return;
      }
    }

    // Upload and create experiments
    const uploadSpinner = ora("Uploading test specification...").start();
    try {
      const uploadResult = await uploadTestSpec(testSpec, apiKey);
      uploadSpinner.succeed("Test specification uploaded");

      console.log(chalk.bold("\n🚀 Eval Experiments Created:"));
      console.log(`  Dataset ID: ${chalk.cyan(uploadResult.suiteId)}`);
      console.log(`  Experiments: ${chalk.bold(testSpec.config.testCombinations.length)}`);

      console.log(chalk.bold("\n✨ Experiments queued for execution!"));
      console.log("View results in your AIM dashboard:");
      console.log(`  ${chalk.cyan("http://localhost:3002/dashboard/evals")}\n`);

    } catch (error) {
      uploadSpinner.fail("Upload failed");
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }

  } catch (error) {
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}
