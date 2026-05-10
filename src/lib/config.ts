import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import type { CliConfig } from "../types.js";

const CONFIG_DIR = path.join(os.homedir(), ".aim");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

const DEFAULT_CONFIG: CliConfig = {
  apiUrl: process.env.AIM_API_URL ?? "https://api.aim.io",
};

export async function loadConfig(): Promise<CliConfig> {
  try {
    const content = await fs.readFile(CONFIG_FILE, "utf-8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(content) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveConfig(config: Partial<CliConfig>): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  const current = await loadConfig();
  const merged = { ...current, ...config };
  await fs.writeFile(CONFIG_FILE, JSON.stringify(merged, null, 2));
}

export async function getConfigValue(key: keyof CliConfig): Promise<string | undefined> {
  const config = await loadConfig();
  const value = config[key];
  return value !== undefined ? String(value) : undefined;
}

export async function setConfigValue(key: keyof CliConfig, value: string): Promise<void> {
  const config = await loadConfig();
  const configRecord = config as unknown as Record<string, string>;
  configRecord[key as string] = value;
  await saveConfig(config);
}

export async function saveApiKey(apiKey: string): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  const keyFile = path.join(CONFIG_DIR, "api-key");
  await fs.writeFile(keyFile, apiKey, { mode: 0o600 }); // Restrictive permissions
}

export async function getApiKey(): Promise<string | null> {
  try {
    const keyFile = path.join(CONFIG_DIR, "api-key");
    return await fs.readFile(keyFile, "utf-8");
  } catch {
    // Check environment variable
    return process.env.AIM_API_KEY ?? null;
  }
}

export async function clearApiKey(): Promise<void> {
  try {
    const keyFile = path.join(CONFIG_DIR, "api-key");
    await fs.unlink(keyFile);
  } catch {
    // File doesn't exist
  }
}
