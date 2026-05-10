#!/usr/bin/env node
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import fs from "node:fs/promises";
import path from "node:path";
import { getApiKey } from "../lib/config.js";
import { uploadTestSpec, estimateExperimentCost, getTestCombinations } from "../lib/api.js";
import type { TestSpecification, InterviewAnswers, EvalSuite, EvalSweepAxis } from "../types.js";

const TEST_COMBINATIONS = [
  { suite: "output_quality" as EvalSuite, sweepAxis: "model" as EvalSweepAxis, name: "Model vs Output Quality", description: "Compare LLM models on quality" },
  { suite: "output_quality" as EvalSuite, sweepAxis: "model" as EvalSweepAxis, name: "Model vs Cost", description: "Analyze cost per model" },
  { suite: "output_quality" as EvalSuite, sweepAxis: "model" as EvalSweepAxis, name: "Model vs Latency", description: "Compare response times" },
  { suite: "instruction_following" as EvalSuite, sweepAxis: "model" as EvalSweepAxis, name: "Model vs Instruction Following", description: "Test instruction adherence" },
  { suite: "output_quality" as EvalSuite, sweepAxis: "system_prompt" as EvalSweepAxis, name: "System Prompt vs Output Quality", description: "Compare prompt variants" },
  { suite: "instruction_following" as EvalSuite, sweepAxis: "system_prompt" as EvalSweepAxis, name: "System Prompt vs Instruction Following", description: "Prompt impact on instructions" },
  { suite: "injection_resistance" as EvalSuite, sweepAxis: "system_prompt" as EvalSweepAxis, name: "System Prompt vs Prompt Injections", description: "Security testing" },
];

export async function interviewCommand(): Promise<void> {
  console.clear();
  console.log(chalk.bold.cyan("\n╔══════════════════════════════════════════════════════════╗"));
  console.log(chalk.bold.cyan("║         🎤 AIM Test Configuration Wizard                 ║"));
  console.log(chalk.bold.cyan("║     Let's set up tests for your AI agent                 ║"));
  console.log(chalk.bold.cyan("╚══════════════════════════════════════════════════════════╝\n"));

  try {
    const answers = await inquirer.prompt<InterviewAnswers>([
      {
        type: "input",
        name: "agentName",
        message: chalk.bold("What's the name of your AI agent?"),
        validate: (input) => input.length > 0 || "Please enter a name",
      },
      {
        type: "input",
        name: "agentDescription",
        message: chalk.bold("What does your agent do? (one sentence)"),
        validate: (input) => input.length > 0 || "Please enter a description",
      },
      {
        type: "list",
        name: "agentType",
        message: chalk.bold("What type of agent is this?"),
        choices: [
          { name: "🤖 Chat / Conversational Agent", value: "chat" },
          { name: "✅ Task Completion Agent", value: "task" },
          { name: "📊 Data Processing Pipeline", value: "data" },
          { name: "🔄 Multi-step Workflow", value: "workflow" },
          { name: "📚 RAG (Retrieval Augmented Generation)", value: "rag" },
          { name: "🔧 Other", value: "other" },
        ],
      },
      {
        type: "checkbox",
        name: "testCombinations",
        message: chalk.bold("Which tests do you want to run? (Press space to select)"),
        choices: TEST_COMBINATIONS.map((tc, i) => ({
          name: `${i + 1}. ${tc.name} - ${chalk.dim(tc.description)}`,
          value: `${tc.suite}:${tc.sweepAxis}`,
          checked: i < 3, // Default select first 3
        })),
        validate: (input) => input.length > 0 || "Please select at least one test",
      },
      {
        type: "input",
        name: "mainModel",
        message: chalk.bold("Primary LLM model?"),
        default: "gpt-4o",
        suffix: chalk.dim(" (e.g., gpt-4o, claude-3-opus)"),
      },
      {
        type: "confirm",
        name: "hasSystemPrompt",
        message: chalk.bold("Does your agent use a system prompt?"),
        default: true,
      },
      {
        type: "editor",
        name: "systemPrompt",
        message: chalk.bold("Paste your system prompt:"),
        when: (answers) => answers.hasSystemPrompt,
      },
      {
        type: "input",
        name: "desiredBehavior",
        message: chalk.bold("Describe the desired behavior/outputs:"),
        suffix: chalk.dim(" (what should the agent do well?)"),
        validate: (input) => input.length > 0 || "Please describe expected behavior",
      },
      {
        type: "input",
        name: "undesiredBehavior",
        message: chalk.bold("What should the agent avoid?"),
        default: "Hallucinations, incorrect information, offensive content",
      },
      {
        type: "checkbox",
        name: "evaluationCriteria",
        message: chalk.bold("Evaluation criteria:"),
        choices: [
          { name: "✓ Accuracy - Information is correct", value: "accuracy", checked: true },
          { name: "✓ Helpfulness - Responses are useful", value: "helpfulness", checked: true },
          { name: "✓ Safety - No harmful content", value: "safety", checked: true },
          { name: "⏱ Conciseness - Not too verbose", value: "conciseness" },
          { name: "🎭 Tone - Appropriate voice/style", value: "tone" },
        ],
      },
      {
        type: "input",
        name: "sampleInputs",
        message: chalk.bold("Sample user inputs:"),
        suffix: chalk.dim(" (2-3 examples, one per line)"),
        validate: (input: string) => input.split("\n").filter((l: string) => l.trim()).length >= 1 || "Please provide at least one example",
      },
      {
        type: "input",
        name: "expectedOutputs",
        message: chalk.bold("Expected outputs for each input:"),
        suffix: chalk.dim(" (one per line, matching inputs)"),
        validate: (input: string) => input.split("\n").filter((l: string) => l.trim()).length >= 1 || "Please provide expected outputs",
      },
      {
        type: "confirm",
        name: "uploadToAIM",
        message: chalk.bold("Upload test specification to AIM dashboard?"),
        default: true,
      },
    ]);

    // Generate test specification
    const spinner = ora({
      text: "Generating test specification...",
      spinner: "dots",
    }).start();

    const testSpec = generateTestSpecification(answers);

    const specPath = path.join(process.cwd(), "aim-test-spec.json");
    await fs.writeFile(specPath, JSON.stringify(testSpec, null, 2));

    spinner.succeed(`Test spec saved to ${chalk.cyan("aim-test-spec.json")}`);

    // Show summary
    console.log("");
    console.log(chalk.bold("📋 Test Suite Summary:"));
    console.log(`  Name: ${chalk.cyan(testSpec.name)}`);
    console.log(`  Test combinations: ${chalk.bold(testSpec.config.testCombinations.length)}`);
    console.log(`  Test cases: ${chalk.bold(testSpec.testCases.length)}`);
    console.log(`  Models to test: ${chalk.cyan(testSpec.evalConfig.modelCandidates.join(", "))}`);
    console.log("");

    // Get cost estimates if authenticated
    const apiKey = await getApiKey();
    if (apiKey) {
      const costSpinner = ora("Getting cost estimate...").start();
      try {
        const firstCombo = testSpec.config.testCombinations[0];
        const estimate = await estimateExperimentCost(
          {
            suite: firstCombo.suite,
            sweepAxis: firstCombo.sweepAxis,
            caseCount: testSpec.testCases.length,
            modelCount: testSpec.evalConfig.modelCandidates.length,
          },
          apiKey
        );
        costSpinner.succeed("Cost estimate ready");

        console.log(chalk.bold("💰 Estimated Cost:"));
        console.log(`  ${formatCredits(estimate.estimate.estimatedCredits)} credits per combination`);
        console.log(`  Total: ~${formatCredits((BigInt(estimate.estimate.estimatedCredits) * BigInt(testSpec.config.testCombinations.length)).toString())} credits`);
        if (estimate.currentBalance) {
          console.log(`  Your balance: ${chalk.green(formatCredits(estimate.currentBalance))} credits`);
        }
        console.log("");
      } catch {
        costSpinner.warn("Could not get cost estimate");
      }
    }

    // Upload to AIM if requested
    if (answers.uploadToAIM) {
      if (!apiKey) {
        console.log(chalk.yellow("\n⚠️  Not authenticated. Run 'aim auth --api-key YOUR_KEY' to upload.\n"));
      } else {
        const uploadSpinner = ora("Uploading to AIM...").start();
        try {
          await uploadTestSpec(testSpec, apiKey);
          uploadSpinner.succeed("Uploaded to AIM dashboard!");
        } catch (error) {
          uploadSpinner.fail("Upload failed");
          console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        }
      }
    }

    // Final message
    console.log("");
    console.log(chalk.bold.green("✨ All set!"));
    console.log("");
    console.log(chalk.bold("Next steps:"));
    console.log(`  1. Review spec: ${chalk.cyan("aim-test-spec.json")}`);
    console.log(`  2. Check cost:  ${chalk.cyan("aim cost")}`);
    console.log(`  3. Run tests:   ${chalk.cyan("aim test --interactive")}`);
    console.log(`  4. View results: ${chalk.cyan("https://aim.io/dashboard/evals")}`);
    console.log("");

  } catch (error) {
    if (error instanceof Error && error.name === "ExitPromptError") {
      console.log(chalk.yellow("\n\nInterview cancelled. Run 'aim interview' to start again.\n"));
      return;
    }
    console.error(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

function generateTestSpecification(answers: InterviewAnswers): TestSpecification {
  const testCases = generateTestCases(answers);

  const selectedCombinations = answers.testCombinations.map((combo) => {
    const [suite, sweepAxis] = combo.split(":") as [EvalSuite, EvalSweepAxis];
    const name = TEST_COMBINATIONS.find((tc) => tc.suite === suite && tc.sweepAxis === sweepAxis)?.name ?? combo;
    return { suite, sweepAxis, name };
  });

  const modelCandidates = [answers.mainModel];
  if (selectedCombinations.some((c) => c.sweepAxis === "model")) {
    modelCandidates.push("gpt-4o-mini", "claude-3-haiku");
  }

  const systemPromptVariants = answers.hasSystemPrompt && selectedCombinations.some((c) => c.sweepAxis === "system_prompt")
    ? [answers.systemPrompt ?? "Default prompt", "Alternative variant"]
    : undefined;

  return {
    version: "1.0",
    name: `${answers.agentName} Eval Suite`,
    description: answers.agentDescription,
    agent: {
      name: answers.agentName,
      type: answers.agentType,
      mainModel: answers.mainModel,
      systemPrompt: answers.systemPrompt,
    },
    config: {
      testCombinations: selectedCombinations,
      evaluationCriteria: answers.evaluationCriteria,
    },
    evalConfig: {
      modelCandidates: [...new Set(modelCandidates)],
      systemPromptVariants,
      useSyntheticCases: true,
      syntheticCount: Math.min(testCases.length * 2, 20),
    },
    testCases,
    metadata: {
      generatedAt: new Date().toISOString(),
      source: "aim-cli-interview",
    },
  };
}

function generateTestCases(answers: InterviewAnswers): TestSpecification["testCases"] {
  const testCases: TestSpecification["testCases"] = [];

  const inputs = answers.sampleInputs.split("\n").filter((i) => i.trim());
  const outputs = answers.expectedOutputs.split("\n").filter((o) => o.trim());
  const selectedSuites = [...new Set(answers.testCombinations.map((c) => c.split(":")[0]))] as EvalSuite[];

  inputs.forEach((input, index) => {
    const expectedOutput = outputs[index] ?? outputs[0];
    selectedSuites.forEach((suite) => {
      testCases.push({
        id: `${suite}-${index + 1}`,
        type: "eval",
        suite,
        sweepAxis: "model",
        name: `${suite} - Case ${index + 1}`,
        input: input.trim(),
        expectedOutput: expectedOutput?.trim(),
        criteria: answers.evaluationCriteria,
        baselineModel: answers.mainModel,
      });
    });
  });

  return testCases;
}

function formatCredits(credits: string): string {
  const num = BigInt(credits);
  return (Number(num) / 1_000_000).toFixed(2);
}
