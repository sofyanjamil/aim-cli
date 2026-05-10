import chalk from "chalk";
import { loadConfig, getConfigValue, setConfigValue } from "../lib/config.js";
import type { CliConfig } from "../types.js";

interface ConfigOptions {
  get?: string;
  set?: string[];
  list?: boolean;
}

export async function configCommand(options: ConfigOptions): Promise<void> {
  try {
    if (options.list) {
      const config = await loadConfig();
      console.log(chalk.bold("\n⚙️  AIM CLI Configuration:\n"));
      console.log(JSON.stringify(config, null, 2));
      return;
    }

    if (options.get) {
      const key = options.get as keyof CliConfig;
      const value = await getConfigValue(key);
      if (value !== undefined) {
        console.log(value);
      } else {
        console.log(chalk.yellow(`Configuration key '${options.get}' not found`));
      }
      return;
    }

    if (options.set && options.set.length >= 2) {
      const [keyStr, ...valueParts] = options.set;
      const key = keyStr as keyof CliConfig;
      const value = valueParts.join(" ");
      await setConfigValue(key, value);
      console.log(chalk.green(`✓ Set ${keyStr} = ${value}`));
      return;
    }

    // Show help if no options provided
    console.log(chalk.bold("\n⚙️  AIM CLI Configuration\n"));
    console.log("Usage:");
    console.log(`  aim config --list                List all configuration`);
    console.log(`  aim config --get <key>           Get a specific value`);
    console.log(`  aim config --set <key> <value>   Set a configuration value\n`);
    console.log("Available keys:");
    console.log(`  apiUrl          API endpoint URL`);
    console.log(`  defaultProject  Default project ID\n`);

  } catch (error) {
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}
