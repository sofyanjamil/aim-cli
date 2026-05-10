import chalk from "chalk";
import ora from "ora";
import { saveApiKey, clearApiKey, getApiKey } from "../lib/config.js";

interface AuthOptions {
  apiKey?: string;
  logout?: boolean;
}

export async function authCommand(options: AuthOptions): Promise<void> {
  if (options.logout) {
    const spinner = ora("Clearing credentials...").start();
    await clearApiKey();
    spinner.succeed("Logged out successfully");
    return;
  }

  if (options.apiKey) {
    const spinner = ora("Saving API key...").start();
    try {
      await saveApiKey(options.apiKey);
      spinner.succeed("API key saved");

      // Verify it works
      const verifySpinner = ora("Verifying API key...").start();
      try {
        const currentKey = await getApiKey();
        if (currentKey) {
          verifySpinner.succeed("API key verified");
          console.log(chalk.green("\n✓ You are now authenticated with AIM"));
        } else {
          verifySpinner.fail("Could not verify API key");
        }
      } catch (error) {
        verifySpinner.fail("Verification failed");
        console.error(chalk.yellow("Warning: API key saved but verification failed"));
      }
    } catch (error) {
      spinner.fail("Failed to save API key");
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
    return;
  }

  // Show current auth status
  const currentKey = await getApiKey();
  if (currentKey) {
    const masked = `${currentKey.slice(0, 8)}...${currentKey.slice(-4)}`;
    console.log(chalk.green(`✓ Authenticated with API key: ${masked}`));
    console.log(chalk.dim("Run 'aim auth --logout' to clear credentials"));
  } else {
    console.log(chalk.yellow("⚠ Not authenticated"));
    console.log(chalk.dim("Run 'aim auth --api-key YOUR_KEY' to authenticate"));
  }
}
