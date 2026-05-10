# AIM CLI

> Test and evaluate AI agents with confidence

[![npm version](https://img.shields.io/npm/v/@aim/cli.svg)](https://www.npmjs.com/package/@aim/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

The AIM CLI is a powerful command-line tool for testing, evaluating, and monitoring AI agents. It integrates with the AIM platform to provide comprehensive eval suites for comparing models, testing system prompts, and ensuring your AI agents perform as expected.

## 🚀 Quick Start

```bash
# Install globally
npm install -g @aim/cli

# Or use with npx (no install)
npx @aim/cli --help
```

```bash
# Authenticate with AIM
aim auth --api-key YOUR_API_KEY

# Scan your codebase
aim scan --dir ./src

# Interactive wizard to configure tests
aim interview

# Estimate costs
aim cost

# Run tests
aim test --interactive
```

## 📖 Documentation

### Commands

#### `aim scan`

Analyze your codebase to detect AI SDK usage, gateway patterns, and agent structures.

```bash
aim scan --dir ./src                    # Scan a directory
aim scan --output results.json          # Save results
aim scan --json                         # Machine-readable output
```

**Output includes:**
- Framework detection (React, Vue, Next.js, etc.)
- AIM SDK usage patterns
- Gateway and API call patterns
- Agent structure analysis
- Recommended test combinations

#### `aim interview`

Interactive wizard that guides you through configuring tests for your AI agent.

```bash
aim interview
```

**Walks you through:**
1. Agent description and type
2. Test combination selection
3. System prompt configuration
4. Expected behavior definition
5. Sample inputs/outputs

Generates an `aim-test-spec.json` file ready for execution.

#### `aim cost`

Estimate costs before running tests.

```bash
aim cost                               # Estimate current spec
aim cost --config my-spec.json         # Estimate custom spec
```

Shows credit costs per test combination and checks your balance.

#### `aim test`

Upload and execute test specifications.

```bash
aim test                               # Run with aim-test-spec.json
aim test --config my-spec.json         # Use custom spec
aim test --dry-run                     # Preview without uploading
aim test --interactive                 # Confirm each step
```

#### `aim auth`

Manage API authentication.

```bash
aim auth                               # Check status
aim auth --api-key YOUR_KEY           # Authenticate
aim auth --logout                      # Sign out
```

#### `aim config`

Manage CLI configuration.

```bash
aim config --list                      # Show all config
aim config --get apiUrl                # Get specific value
aim config --set apiUrl https://...   # Set value
```

## 🧪 Test Combinations

AIM provides 7 eval test combinations across 3 suites:

### Suites

| Suite | Description |
|-------|-------------|
| **output_quality** | Evaluates response quality using judge models |
| **instruction_following** | Tests adherence to instructions |
| **injection_resistance** | Security tests for prompt injection |

### Sweep Axes

| Axis | Description |
|------|-------------|
| **model** | Compare different LLM models |
| **system_prompt** | Compare prompt variants |

### Test Combinations

1. **Model vs Output Quality** - Compare LLM models on quality metrics
2. **Model vs Cost** - Cost analysis per model
3. **Model vs Latency** - Response time comparison
4. **Model vs Instruction Following** - Test instruction adherence
5. **System Prompt vs Output Quality** - Prompt variant comparison
6. **System Prompt vs Instruction Following** - Prompt impact analysis
7. **System Prompt vs Prompt Injections** - Security testing

## 💰 Pricing

Costs are calculated based on:
- Number of test cases
- Number of model/prompt variants
- Judge model calls for evaluation
- Synthetic case generation (if used)

Formula: `credits = calls × plan_factor + fixed_cost`

Check your plan and balance with `aim cost`.

## 🔧 Configuration

### Environment Variables

```bash
AIM_API_KEY=your_api_key           # API authentication
AIM_API_URL=https://api.aim.io     # Custom API endpoint
```

### Config File

Stored in `~/.aim/config.json`:

```json
{
  "apiUrl": "https://api.aim.io",
  "defaultProject": "your-project-id"
}
```

## 📝 Example Workflow

```bash
# 1. Scan your project
aim scan --dir ./src

# 2. Configure tests interactively
aim interview
# ... answer questions ...
# ✓ Generated aim-test-spec.json

# 3. Check costs
aim cost
# 💰 Estimated: 45.50 credits per combination
# 💰 Your balance: 500.00 credits

# 4. Run tests
aim test --interactive
# ✓ Created 3 eval experiments
# ✓ View results at https://aim.io/dashboard/evals
```

## 🎯 Use Cases

### Compare LLM Models
```bash
aim interview
# Select: Model vs Output Quality
# Models: gpt-4o, claude-3-opus, gemini-pro
```

### Test System Prompts
```bash
aim interview
# Select: System Prompt vs Output Quality
# Prompt variants: Professional, Casual, Technical
```

### Security Testing
```bash
aim interview
# Select: System Prompt vs Prompt Injections
# Tests resistance to jailbreaks and injections
```

### Regression Testing
```bash
# Run same test suite after code changes
aim test --config regression-spec.json
```

## 🛠️ Development

```bash
# Clone repository
git clone https://github.com/your-org/aim-cli.git
cd aim-cli

# Install dependencies
npm install

# Build
npm run build

# Run locally
node dist/index.js --help
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

MIT © [AIM Team](https://aim.io)

## 🔗 Links

- [Documentation](https://docs.aim.io)
- [Dashboard](https://aim.io/dashboard)
- [API Reference](https://docs.aim.io/api)
- [Support](mailto:support@aim.io)

---

<p align="center">
  Built with ❤️ by the AIM team
</p>
