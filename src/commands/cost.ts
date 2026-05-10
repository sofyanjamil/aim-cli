import chalk from "chalk";
import ora from "ora";
import fs from "node:fs/promises";
import path from "node:path";
import { getApiKey } from "../lib/config.js";
import { estimateExperimentCost, getCurrentPlan } from "../lib/api.js";
import type { TestSpecification } from "../types.js";

interface CostOptions {
  config?: string;
}

export async function costCommand(options: CostOptions): Promise<void> {
  console.log(chalk.bold("\n💰 Cost Estimation\n"));

  try {
    // Load test configuration
    let specPath: string;
    if (options.config) {
      specPath = path.resolve(options.config);
    } else {
      const defaultPath = path.join(process.cwd(), "aim-test-spec.json");
      try {
        await fs.access(defaultPath);
        specPath = defaultPath;
      } catch {
        console.log(chalk.yellow("No test spec found. Run 'aim interview' first."));
        process.exit(1);
      }
    }

    const content = await fs.readFile(specPath, "utf-8");
    const testSpec: TestSpecification = JSON.parse(content);

    console.log(`Test Suite: ${chalk.cyan(testSpec.name)}`);
    console.log(`Combinations: ${chalk.bold(testSpec.config.testCombinations.length)}`);
    console.log(`Test Cases: ${chalk.bold(testSpec.testCases.length)}\n`);

    const apiKey = await getApiKey();
    if (!apiKey) {
      console.log(chalk.yellow("Not authenticated. Showing estimated costs only.\n"));
      showEstimatedCosts(testSpec);
      return;
    }

    // Get current plan info
    const planSpinner = ora("Fetching plan information...").start();
    try {
      const plan = await getCurrentPlan(apiKey);
      planSpinner.succeed(`Plan: ${chalk.cyan(plan.plan.name)} | Balance: ${chalk.green(formatCredits(plan.creditBalance))} credits`);
    } catch {
      planSpinner.warn("Could not fetch plan info");
    }

    console.log("");

    // Estimate each combination
    for (const combo of testSpec.config.testCombinations) {
      const spinner = ora(`Estimating: ${combo.name}...`).start();
      try {
        const estimate = await estimateExperimentCost(
          {
            suite: combo.suite,
            sweepAxis: combo.sweepAxis,
            caseCount: testSpec.testCases.length,
            modelCount: testSpec.evalConfig.modelCandidates.length,
            promptVariantCount: testSpec.evalConfig.systemPromptVariants?.length ?? 1,
            syntheticCount: testSpec.evalConfig.syntheticCount,
          },
          apiKey
        );

        spinner.succeed(`${combo.name}`);
        console.log(`  Estimated: ${chalk.cyan(formatCredits(estimate.estimate.estimatedCredits))} credits`);
        console.log(`  Worst case: ${chalk.yellow(formatCredits(estimate.estimate.worstCaseCredits))} credits`);
        if (estimate.currentBalance) {
          const balance = BigInt(estimate.currentBalance);
          const cost = BigInt(estimate.estimate.estimatedCredits);
          if (balance < cost) {
            console.log(`  ⚠️  ${chalk.red("Insufficient balance")}`);
          } else {
            console.log(`  ✓ ${chalk.green("Can proceed")}`);
          }
        }
        console.log("");
      } catch (error) {
        spinner.fail(`Failed to estimate ${combo.name}`);
      }
    }

    console.log(chalk.bold("Total Estimated Cost:"));
    // Show sum if we had all estimates
    console.log(`  Run 'aim test --dry-run' for full breakdown\n`);

  } catch (error) {
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

function formatCredits(credits: string): string {
  const num = BigInt(credits);
  return (Number(num) / 1_000_000).toFixed(2);
}

function showEstimatedCosts(testSpec: TestSpecification): void {
  console.log(chalk.bold("Estimated Cost Breakdown (Offline):\n"));

  for (const combo of testSpec.config.testCombinations) {
    console.log(`${chalk.cyan(combo.name)}`);
    const caseCount = testSpec.testCases.length;
    const modelCount = combo.sweepAxis === "model" ? testSpec.evalConfig.modelCandidates.length : 1;
    const promptCount = combo.sweepAxis === "system_prompt" ? (testSpec.evalConfig.systemPromptVariants?.length ?? 1) : 1;
    const variants = combo.sweepAxis === "model" ? modelCount : promptCount;

    // Rough estimate: (model calls + judge calls) * cases * variants
    const calls = caseCount * variants * 2; // 1 model + 1 judge
    const estimatedCredits = calls * 2000; // ~0.002 per call

    console.log(`  ~${chalk.yellow(formatCredits(estimatedCredits.toString()))} credits (${calls} LLM calls)`);
    console.log("");
  }

  console.log(chalk.dim("Note: Connect with 'aim auth' for accurate pricing based on your plan."));
  console.log("");
}
