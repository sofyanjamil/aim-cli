import type { TestSpecification, ExperimentEstimate, EvalSuite, EvalSweepAxis } from "../types.js";

const API_BASE = process.env.AIM_API_URL ?? "http://localhost:3001";

async function apiFetch<T>(
  path: string,
  options: RequestInit & { token: string }
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${options.token}`);
  headers.set("Content-Type", "application/json");

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text}`);
  }

  return response.json() as Promise<T>;
}

export async function uploadTestSpec(
  spec: TestSpecification,
  token: string
): Promise<{ suiteId: string }> {
  // First create a dataset
  const dataset = await apiFetch<{ dataset: { id: string } }>("/dashboard/eval/datasets", {
    method: "POST",
    token,
    body: JSON.stringify({
      workflowId: spec.agent.name, // Use agent name as workflow identifier
      name: spec.name,
      cases: spec.testCases.map((tc) => ({
        name: tc.name,
        input: { text: tc.input },
        expected: tc.expectedOutput,
      })),
    }),
  });

  // Then create experiments for each test combination
  for (const combo of spec.config.testCombinations) {
    await apiFetch("/dashboard/eval/experiments", {
      method: "POST",
      token,
      body: JSON.stringify({
        datasetId: dataset.dataset.id,
        modelCandidates: spec.evalConfig.modelCandidates,
        systemPromptVariants: spec.evalConfig.systemPromptVariants,
        suite: combo.suite,
        sweepAxis: combo.sweepAxis,
        syntheticCount: spec.evalConfig.syntheticCount,
        scorerType: "llm_judge",
      }),
    });
  }

  return { suiteId: dataset.dataset.id };
}

export async function estimateExperimentCost(
  params: {
    suite: EvalSuite;
    sweepAxis: EvalSweepAxis;
    caseCount: number;
    modelCount: number;
    promptVariantCount?: number;
    syntheticCount?: number;
  },
  token: string
): Promise<ExperimentEstimate> {
  return apiFetch("/dashboard/billing/estimate", {
    method: "POST",
    token,
    body: JSON.stringify({
      suite: params.suite,
      sweepAxis: params.sweepAxis,
      caseCount: params.caseCount,
      modelCount: params.modelCount,
      promptVariantCount: params.promptVariantCount ?? 1,
      syntheticCount: params.syntheticCount ?? 0,
    }),
  });
}

export async function getCurrentPlan(token: string): Promise<{
  plan: { key: string; name: string };
  creditBalance: string;
}> {
  return apiFetch("/dashboard/billing/plans/current", {
    method: "GET",
    token,
  });
}

export async function getTestCombinations(token: string): Promise<{
  testCombinations: Array<{
    suite: EvalSuite;
    sweepAxis: EvalSweepAxis;
    name: string;
    allowed: boolean;
  }>;
}> {
  return apiFetch("/dashboard/billing/test-combinations", {
    method: "GET",
    token,
  });
}
