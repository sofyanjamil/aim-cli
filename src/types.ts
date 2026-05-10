// CLI Types

export type Framework =
  | "react"
  | "vue"
  | "svelte"
  | "next"
  | "remix"
  | "express"
  | "fastify"
  | "nestjs"
  | "angular"
  | null;

/** The 3 eval suites supported by AIM */
export type EvalSuite = "output_quality" | "instruction_following" | "injection_resistance";

/** The 2 sweep axes for eval experiments */
export type EvalSweepAxis = "model" | "system_prompt";

/** All 7 test combinations */
export const TEST_COMBINATIONS: Array<{ suite: EvalSuite; sweepAxis: EvalSweepAxis; name: string }> = [
  { suite: "output_quality", sweepAxis: "model", name: "Model vs Output Quality" },
  { suite: "output_quality", sweepAxis: "model", name: "Model vs Cost" },
  { suite: "output_quality", sweepAxis: "model", name: "Model vs Latency" },
  { suite: "instruction_following", sweepAxis: "model", name: "Model vs Instruction Following" },
  { suite: "output_quality", sweepAxis: "system_prompt", name: "System Prompt vs Output Quality" },
  { suite: "instruction_following", sweepAxis: "system_prompt", name: "System Prompt vs Instruction Following" },
  { suite: "injection_resistance", sweepAxis: "system_prompt", name: "System Prompt vs Prompt Injections" },
];

export interface ScanResult {
  targetDir: string;
  totalFiles: number;
  framework: Framework;
  aimSdkUsage: ImportInfo[];
  gatewayPatterns: GatewayCall[];
  agentPatterns: AgentPattern[];
  entryPoints: string[];
  configFiles: string[];
  dependencies: Record<string, string>;
  suggestedTestTypes: Array<{ name: string; suite: EvalSuite; sweepAxis: EvalSweepAxis; reason: string }>;
}

export interface ImportInfo {
  source: string;
  file: string;
  imports: string[];
}

export interface GatewayCall {
  pattern: string;
  file: string;
  line: number;
  code: string;
}

export interface AgentPattern {
  type: string;
  file: string;
  line: number;
  description?: string;
}

export interface CodebaseContext {
  files: Array<{
    path: string;
    content: string;
    size: number;
  }>;
  imports: ImportInfo[];
  exports: string[];
  functionCalls: Array<{
    name: string;
    file: string;
    line: number;
  }>;
}

// Configuration
export interface CliConfig {
  apiUrl: string;
  defaultProject?: string;
  defaultOrg?: string;
}

// Interview
export interface InterviewAnswers {
  agentName: string;
  agentDescription: string;
  agentType: "chat" | "task" | "data" | "workflow" | "rag" | "other";
  testCombinations: string[]; // Selected from the 7 combinations
  mainModel: string;
  hasSystemPrompt: boolean;
  systemPrompt?: string;
  desiredBehavior: string;
  undesiredBehavior: string;
  evaluationCriteria: string[];
  sampleInputs: string;
  expectedOutputs: string;
  hasExternalTools: boolean;
  externalTools?: string;
  uploadToAIM: boolean;
}

// Test Specification for Eval Experiments
export interface TestSpecification {
  version: string;
  name: string;
  description: string;
  agent: {
    name: string;
    type: string;
    mainModel: string;
    systemPrompt?: string;
  };
  config: {
    testCombinations: Array<{
      suite: EvalSuite;
      sweepAxis: EvalSweepAxis;
      name: string;
    }>;
    evaluationCriteria: string[];
  };
  // Eval experiment configuration
  evalConfig: {
    modelCandidates: string[];
    systemPromptVariants?: string[];
    useSyntheticCases: boolean;
    syntheticCount: number;
  };
  testCases: TestCase[];
  metadata: {
    generatedAt: string;
    source: string;
  };
}

export interface TestCase {
  id: string;
  type: "eval";
  suite: EvalSuite;
  sweepAxis: EvalSweepAxis;
  name: string;
  input: string;
  expectedOutput?: string;
  expectedBehavior?: string;
  criteria: string[];
  baselineModel?: string;
}

// API Types
export interface TestRunParams {
  suiteId: string;
  testCaseId: string;
  suite: EvalSuite;
  sweepAxis: EvalSweepAxis;
  config: unknown;
}

export interface CostEstimate {
  estimatedCredits: string;
  worstCaseCredits: string;
  currentBalance: string;
  canProceed: boolean;
}

export interface ExperimentEstimate {
  estimate: {
    estimatedCredits: string;
    worstCaseCredits: string;
    fixedCredits: string;
    planFactor: number;
    stepBreakdown: Array<{
      stepKey: string;
      stepName: string;
      count: number;
      maxPricePerCall: string;
      subtotal: string;
    }>;
  };
  canProceed: boolean;
  currentBalance?: string;
}
