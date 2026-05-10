import type { Framework, ImportInfo, GatewayCall, AgentPattern } from "../types.js";

export function detectFramework(pkgJson: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }): Framework | null {
  const allDeps = {
    ...pkgJson.dependencies,
    ...pkgJson.devDependencies,
  };

  if (allDeps["next"]) return "next";
  if (allDeps["react"]) return "react";
  if (allDeps["vue"]) return "vue";
  if (allDeps["svelte"]) return "svelte";
  if (allDeps["express"]) return "express";
  if (allDeps["fastify"]) return "fastify";
  if (allDeps["nest"]) return "nestjs";
  if (allDeps["@angular/core"]) return "angular";
  if (allDeps["@remix-run/core"]) return "remix";

  return null;
}

export function analyzeImports(content: string, file: string): ImportInfo[] {
  const imports: ImportInfo[] = [];

  // ES6 imports
  const es6Regex = /import\s+(?:(?:\{[^}]*\}|[^'"]*)\s+from\s+)?['"]([^'"]+)['"];?/g;
  let match: RegExpExecArray | null;
  while ((match = es6Regex.exec(content)) !== null) {
    const source = match[1];
    const fullMatch = match[0];

    // Extract imported names
    const importedNames: string[] = [];
    const namedMatch = fullMatch.match(/\{([^}]*)\}/);
    if (namedMatch) {
      importedNames.push(...namedMatch[1].split(",").map((s) => s.trim().split(/\s+as\s+/)[0]));
    }

    // Default import
    const defaultMatch = fullMatch.match(/import\s+(\w+)\s+from/);
    if (defaultMatch) {
      importedNames.push(defaultMatch[1]);
    }

    // Namespace import
    const namespaceMatch = fullMatch.match(/import\s+\*\s+as\s+(\w+)/);
    if (namespaceMatch) {
      importedNames.push(`* as ${namespaceMatch[1]}`);
    }

    imports.push({ source, file, imports: importedNames });
  }

  // CommonJS requires
  const cjsRegex = /(?:const|let|var)\s+(?:(?:\{[^}]*\}|\w+)\s*=\s*)?require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = cjsRegex.exec(content)) !== null) {
    const source = match[1];

    imports.push({ source, file, imports: ["require"] });
  }

  return imports;
}

export function findGatewayCalls(content: string, file: string): GatewayCall[] {
  const calls: GatewayCall[] = [];
  const lines = content.split("\n");

  // Pattern: fetch, axios, or SDK calls to API endpoints
  const gatewayPatterns = [
    { regex: /fetch\s*\(\s*['"`]([^'"`]*\/(?:api|gateway|v1|chat|completions))['"`]/, type: "fetch" },
    { regex: /axios\.(?:get|post|put|delete)\s*\(\s*['"`]([^'"`]*\/(?:api|gateway|v1|chat|completions))['"`]/, type: "axios" },
    { regex: /\.(?:chat\.completions|completions|embeddings)\.create\s*\(/, type: "openai-sdk" },
    { regex: /createGatewayClient|useGateway|AIMClient/, type: "aim-sdk" },
    { regex: /openrouter|openai|anthropic|cohere/, type: "llm-provider" },
  ];

  lines.forEach((line, index) => {
    for (const pattern of gatewayPatterns) {
      const match = line.match(pattern.regex);
      if (match) {
        calls.push({
          pattern: pattern.type,
          file,
          line: index + 1,
          code: line.trim().slice(0, 80),
        });
      }
    }
  });

  return calls;
}

export function findAgentPatterns(content: string, file: string): AgentPattern[] {
  const patterns: AgentPattern[] = [];
  const lines = content.split("\n");

  // Agent pattern detection
  const agentPatterns = [
    { regex: /systemPrompt|system_prompt|system prompt/i, type: "system_prompt" },
    { regex: /userPrompt|user_prompt|user prompt/i, type: "user_prompt" },
    { regex: /agentLoop|agent_loop|while.*agent/i, type: "agent_loop" },
    { regex: /workflow|pipeline|chain.*invoke/i, type: "workflow" },
    { regex: /toolCall|tool_call|useTool/i, type: "tool_usage" },
    { regex: /memory|contextWindow|conversationHistory/i, type: "memory" },
    { regex: /rag|retrieval|vectorStore|embedding/i, type: "rag" },
    { regex: /llm\s*\.\s*(?:call|invoke|generate|complete)/i, type: "llm_call" },
    { regex: /generate.*response|getCompletion|createChatCompletion/i, type: "llm_call" },
    { regex: /input.*user|userInput|getUserMessage/i, type: "user_input" },
    { regex: /outputParser|output_parser|parseOutput/i, type: "output_parsing" },
    { regex: /retry|backoff|maxRetries/i, type: "retry_logic" },
  ];

  lines.forEach((line, index) => {
    for (const pattern of agentPatterns) {
      const match = line.match(pattern.regex);
      if (match) {
        // Avoid duplicates
        const existing = patterns.find(
          (p) => p.type === pattern.type && p.file === file && Math.abs(p.line - (index + 1)) < 5
        );
        if (!existing) {
          patterns.push({
            type: pattern.type,
            file,
            line: index + 1,
            description: match[0].slice(0, 50),
          });
        }
      }
    }
  });

  return patterns;
}
