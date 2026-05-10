#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { scanCommand } from "./commands/scan.js";
import { testCommand } from "./commands/test.js";
import { configCommand } from "./commands/config.js";
import { authCommand } from "./commands/auth.js";
import { interviewCommand } from "./commands/interview.js";
import { getApiKey } from "./lib/config.js";

const program = new Command();

program
  .name("aim")
  .description("AIM CLI - Test and evaluate AI agents with confidence")
  .version("0.1.0")
  .configureHelp({
    sortSubcommands: true,
    helpWidth: 80,
  });

// Global hook to check auth status
program.hook("preAction", async (thisCommand) => {
  const cmdName = thisCommand.args[0];
  // Skip auth check for auth and config commands
  if (cmdName !== "auth" && cmdName !== "config" && cmdName !== "--help") {
    const apiKey = await getApiKey();
    if (!apiKey && process.env.NODE_ENV !== "development") {
      console.log(chalk.yellow("\n⚠️  Not authenticated. Run 'aim auth --api-key YOUR_KEY' first.\n"));
    }
  }
});

program
  .command("scan")
  .description("🔍 Scan your codebase for AIM SDK usage and AI patterns")
  .option("-d, --dir <path>", "Directory to scan", ".")
  .option("-o, --output <file>", "Save results to JSON file")
  .option("--json", "Output as JSON instead of formatted text")
  .addHelpText("after", `
Examples:
  $ aim scan                           # Scan current directory
  $ aim scan --dir ./src               # Scan specific folder
  $ aim scan --output results.json     # Save to file
  $ aim scan --json                    # Machine-readable output
`)
  .action(scanCommand);

program
  .command("interview")
  .description("🎤 Interactive wizard to configure your AI agent tests")
  .addHelpText("after", `
This will guide you through:
  • Describing your agent/pipeline
  • Selecting test combinations
  • Defining expected behaviors
  • Generating test specifications

Example:
  $ aim interview
`)
  .action(async () => {
    await interviewCommand();
  });

program
  .command("test")
  .description("🧪 Upload and run test specifications")
  .option("-c, --config <file>", "Path to test spec file (default: aim-test-spec.json)")
  .option("--dry-run", "Preview tests without uploading")
  .option("-i, --interactive", "Confirm before creating experiments")
  .addHelpText("after", `
Examples:
  $ aim test                           # Run with default spec
  $ aim test --config my-spec.json   # Use custom spec
  $ aim test --dry-run               # Preview only
  $ aim test --interactive           # Confirm each step
`)
  .action(testCommand);

program
  .command("auth")
  .description("🔑 Authenticate with AIM API")
  .option("--api-key <key>", "Your AIM API key")
  .option("--logout", "Clear stored credentials")
  .addHelpText("after", `
Examples:
  $ aim auth                           # Check current status
  $ aim auth --api-key YOUR_KEY      # Authenticate
  $ aim auth --logout                # Sign out
`)
  .action(authCommand);

program
  .command("config")
  .description("⚙️  Manage CLI configuration")
  .option("--get <key>", "Get configuration value")
  .option("--set <key> <value>", "Set configuration value")
  .option("--list", "List all configuration")
  .addHelpText("after", `
Available keys:
  apiUrl          API endpoint URL
  defaultProject  Default project ID

Examples:
  $ aim config --list
  $ aim config --get apiUrl
  $ aim config --set apiUrl https://api.aim.io
`)
  .action(configCommand);

program
  .command("cost")
  .description("💰 Estimate test costs before running")
  .option("-c, --config <file>", "Test spec to estimate")
  .addHelpText("after", `
Examples:
  $ aim cost                 # Estimate current spec
  $ aim cost --config spec.json
`)
  .action(async (options) => {
    const { costCommand } = await import("./commands/cost.js");
    await costCommand(options);
  });

// Pretty error handling
program.exitOverride();

try {
  program.parse();
} catch (error: any) {
  if (error.code === "commander.help") {
    process.exit(0);
  }
  if (error.code === "commander.version") {
    process.exit(0);
  }
  console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
  process.exit(1);
}

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason) => {
  console.error(chalk.red("\n❌ Unexpected error:"), reason);
  process.exit(1);
});
