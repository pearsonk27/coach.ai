# AI-Native Monorepo Architecture Blueprint

## Goals

This repository architecture is optimized for:

- AI-assisted software engineering
- Cross-platform frontend/mobile development
- Durable backend systems
- AI agent consistency
- Drift prevention
- Long-term maintainability
- Strong automated testing
- Shared standards across projects
- Monorepo scalability
- Layered context for AI agents
- Reusable skills/prompts/workflows
- Fast local development

The architecture assumes:

- Frontend/mobile: React + TypeScript + React Native + Expo
- Backend APIs: Python (FastAPI)
- Durable backend systems: Java/Kotlin when needed
- Monorepo orchestration: Turborepo
- Python package management: uv
- CI/CD: GitHub Actions
- Docs platform: Astro Starlight
- Containers: Docker

---

## High-Level Philosophy

### Core Principles

#### 1. Standards Over Tooling

Tools change rapidly.

Standards should remain stable.

The repository should encode:

- engineering rules
- architectural conventions
- testing philosophy
- AI-agent operating instructions

independently from frameworks.

---

### 2. Thin Orchestration

Avoid giant custom CLIs.

Prefer:

- official generators
- reusable standards
- reusable templates
- AI-generated glue code

---

### 3. Prevent Drift Structurally

Do not rely on humans or agents remembering conventions.

Use:

- CI enforcement
- pre-commit hooks
- centralized standards
- reusable templates
- architecture checks
- typed contracts

---

### 4. AI Agents Are Contributors, Not Owners

AI agents:

- propose implementations
- generate boilerplate
- assist with testing
- help with docs

Humans:

- own architecture
- approve standards
- review major changes

---

## Repository Structure

```text
platform/
├── apps/
│   ├── api/
│   ├── web/
│   ├── mobile/
│   ├── desktop/
│   └── docs/
│
├── services/
│   ├── ai-orchestrator/
│   ├── automation/
│   └── workers/
│
├── packages/
│   ├── ui/
│   ├── shared-types/
│   ├── api-client/
│   ├── prompts/
│   ├── agent-skills/
│   ├── config/
│   ├── observability/
│   └── testing/
│
├── standards/
│   ├── AGENTS.md
│   ├── architecture.md
│   ├── coding-standards.md
│   ├── testing-policy.md
│   ├── prompting-guide.md
│   ├── documentation-policy.md
│   ├── dependency-policy.md
│   ├── security-policy.md
│   ├── branching-strategy.md
│   └── release-policy.md
│
├── infrastructure/
│   ├── docker/
│   ├── compose/
│   ├── terraform/
│   └── kubernetes/
│
├── mcp/
│   ├── filesystem/
│   ├── github/
│   ├── postgres/
│   ├── playwright/
│   ├── docs/
│   └── shared/
│
├── scripts/
│   ├── bootstrap/
│   ├── generators/
│   ├── validation/
│   └── ci/
│
├── tasks/
│   ├── active/
│   ├── backlog/
│   └── completed/
│
├── templates/
│   ├── feature-spec/
│   ├── api-service/
│   ├── mobile-screen/
│   └── ai-skill/
│
├── .github/
│   ├── workflows/
│   ├── ISSUE_TEMPLATE/
│   └── PULL_REQUEST_TEMPLATE.md
│
├── .cursor/
├── .claude/
├── .vscode/
├── .devcontainer/
│
├── turbo.json
├── package.json
├── pnpm-workspace.yaml
├── justfile
├── README.md
├── CONTRIBUTING.md
├── CODEOWNERS
└── LICENSE
```

---

## Core Technology Decisions

### Frontend/Web

#### Stack

- React
- TypeScript
- Next.js
- Tailwind CSS
- TanStack Query
- Zustand (lightweight state)
- Zod

#### Why This Stack

This provides:

- broad ecosystem support
- excellent AI-agent familiarity
- strong type sharing
- mobile interoperability
- mature tooling

---

### Mobile

#### Mobile Stack

- React Native
- Expo
- TypeScript

#### Why for Mobile

This enables:

- iOS support
- Android support
- shared business logic
- shared types
- shared validation
- shared API clients

---

### Desktop

#### Desktop Stack

- Tauri (preferred)
- Electron only if required

#### Why for Desktop

Tauri provides:

- lower memory usage
- smaller bundles
- improved security model
- Rust-based backend

---

### Python Services

#### Python Stack

- FastAPI
- uv
- Pydantic
- SQLAlchemy
- Alembic
- pytest
- Ruff
- Pyright

#### Why

Optimized for:

- AI ecosystem compatibility
- rapid iteration
- automation
- AI orchestration
- typed APIs

---

### Durable JVM Services

#### JVM Services Stack

- Java 21+
- Spring Boot
- Gradle (Kotlin DSL)
- Testcontainers

#### Why for JVM Services

Optimized for:

- enterprise durability
- long-term maintainability
- strong typing
- scalability

---

## Code Quality & Linting Standards

### Philosophy

Linting, formatting, type checking, and testing should be standardized across
all projects.

The goals are:

- Reduce cognitive overhead
- Improve AI-agent consistency
- Prevent configuration drift
- Minimize tooling fragmentation
- Ensure deterministic code quality checks

AI agents should encounter the same quality gates across all repositories
whenever possible.

---

### Standard Validation Pipeline

Every project should expose the following commands:

```bash
just format
just lint
just typecheck
just test
````

The implementation may differ by language, but the interface should remain consistent.

All CI pipelines should execute:

```text
format
→ lint
→ typecheck
→ unit tests
→ integration tests
→ build
```

before merge.

---

### Python Standards

#### Formatting & Linting

Tool:

- Ruff

Responsibilities:

- formatting
- linting
- import sorting

#### Python Type Checking

Tool:

- Pyrefly

#### Testing

Tool:

- pytest

#### Standard Commands

```bash
ruff format .
ruff check .
uv run pyrefly check
uv run pytest
```

---

### TypeScript / React / React Native Standards

#### Linting

Tool:

- ESLint

#### Formatting

Tool:

- Prettier

#### Type Checking

Tool:

- TypeScript Compiler

#### TypeScript Testing

Tools:

- Vitest
- Playwright

#### Standard TypeScript Commands

```bash
eslint .
prettier --check .
tsc --noEmit
vitest
```

---

### Java Spring Boot Standards

#### Java Formatting

Tool:

- Spotless

#### Style Enforcement

Tool:

- Checkstyle

#### Static Analysis

Tool:

- SpotBugs

#### Dependency Security

Tool:

- OWASP Dependency Check

#### Java Testing

Tools:

- JUnit 5
- Testcontainers

#### Standard Java Commands

```bash
./gradlew spotlessCheck
./gradlew checkstyleMain
./gradlew spotbugsMain
./gradlew test
```

---

### Kotlin Standards

#### Kotlin Formatting

Tool:

- Spotless + ktfmt

#### Kotlin Static Analysis

Tool:

- detekt

#### Kotlin Testing

Tools:

- JUnit 5
- Testcontainers

---

### SQL Standards

#### SQL Linting

Tool:

- SQLFluff

Required for:

- analytics queries
- reporting systems
- migration validation

---

### Docker Standards

#### Docker Linting

Tool:

- Hadolint

Required for:

- Dockerfiles
- containerized applications

---

### YAML Standards

#### YAML Linting

Tool:

- yamllint

Required for:

- GitHub Actions
- Kubernetes manifests
- Docker Compose files
- configuration repositories

---

### Infrastructure Standards

#### Terraform

Formatting:

- terraform fmt

Validation:

- terraform validate

Security:

- tfsec

---

### AI Agent Quality Rules

Generated code is not complete until:

- formatting passes
- linting passes
- type checking passes
- tests pass
- documentation is updated

AI agents should never consider a task complete until all required quality
gates succeed.

---

### Approved Tool Matrix

|Ecosystem|Standard Tools|
|---|---|
|Python|Ruff, Pyright, pytest|
|React / TypeScript|ESLint, Prettier, TypeScript, Vitest|
|React Native|ESLint, Prettier, TypeScript|
|Java Spring Boot|Spotless, Checkstyle, SpotBugs|
|Kotlin|Spotless, ktfmt, detekt|
|SQL|SQLFluff|
|Docker|Hadolint|
|YAML|yamllint|
|Terraform|terraform fmt, terraform validate, tfsec|

These standards should be used by:

- new-project generators
- CI pipelines
- pre-commit hooks
- AGENTS.md guidance
- repository validation tooling

---

### Standard Project Commands

Every project should expose the following commands:

```bash
just format
just lint
just typecheck
just test
```

## Standards System

### Purpose

The standards directory is the:

"engineering constitution"

All AI agents and contributors should reference it.

---

## standards/AGENTS.md

This is the most important file.

It should define:

- coding rules
- testing rules
- documentation rules
- architectural constraints
- dependency management
- review expectations

---

### Recommended AGENTS.md Sections

#### Dependency Management

- Use uv for Python dependency management
- Never use pip directly
- Maintain uv.lock
- Use pnpm for TypeScript workspaces
- Never use npm install in workspace packages

---

#### Testing Rules

- Business logic requires unit tests
- Public APIs require integration tests
- Critical user flows require E2E tests
- Generated code without tests is incomplete

---

#### Documentation Rules

- Architecture changes require docs updates
- New environment variables require documentation
- Public APIs require examples
- New tables in .md files should be compact (single space around cell content). E.g.:

| Character | Meaning |
| --- | --- |
| Y | Yes |
| N | No |

---

#### Architecture Rules

```md
- Shared types belong in packages/shared-types
- Avoid duplicate utilities
- Prefer composition over inheritance
- Avoid massive files
```

---

#### AI Workflow Rules

```md
Before implementing:
1. Create implementation plan
2. Identify affected systems
3. Update docs
4. Implement
5. Run tests
6. Validate lint/typecheck
```

---

## Monorepo Strategy

### Orchestration

Use:

- Turborepo
- pnpm

#### Why pnpm

Benefits:

- workspace support
- fast installs
- disk efficiency
- good monorepo ergonomics

---

### Shared Packages

#### packages/ui

Shared UI components:

- buttons
- forms
- dialogs
- design tokens
- typography

Used by:

- web
- mobile
- desktop

---

#### packages/shared-types

Shared:

- DTOs
- API contracts
- enums
- schemas
- validation types

This package is critical.

It becomes:

- the contract layer
- the anti-drift layer

---

#### packages/api-client

Shared generated clients.

Should include:

- typed requests
- auth handling
- retries
- observability hooks

---

#### packages/prompts

Contains:

- reusable AI prompts
- workflow prompts
- generation prompts
- review prompts

This prevents:

- prompt duplication
- prompt drift

---

#### packages/agent-skills

Contains reusable AI workflows.

Examples:

```text
create-api-endpoint.md
write-db-migration.md
review-pr.md
create-mobile-screen.md
investigate-production-issue.md
```

Each skill should contain:

- objective
- constraints
- required checks
- implementation steps
- testing expectations
- documentation expectations

---

#### packages/testing

Reusable:

- fixtures
- mocks
- factories
- test utilities
- Playwright helpers

---

## Context Layering Strategy

### Problem

AI agents fail when:

- context windows overflow
- repos become too large
- standards become fragmented

---

### Solution: Layered Context

#### Tier 1 — Global Context

Always loaded:

```text
standards/AGENTS.md
standards/architecture.md
```

Should remain concise.

---

#### Tier 2 — Domain Context

Per subsystem:

```text
apps/api/CONTEXT.md
apps/web/CONTEXT.md
services/workers/CONTEXT.md
```

Should contain:

- architecture
- patterns
- constraints
- common workflows

---

#### Tier 3 — Task Context

Per feature/task:

```text
tasks/active/feature-x.md
```

Contains:

- implementation goals
- acceptance criteria
- impacted systems
- migration notes

---

## Documentation Architecture

### Platform

Use:

- Astro
- Starlight

---

### Documentation Structure

```text
apps/docs/
├── architecture/
├── api/
├── frontend/
├── mobile/
├── infrastructure/
├── ai-workflows/
├── standards/
└── onboarding/
```

---

### Documentation Drift Prevention

#### CI Requirements

Require docs updates when:

- APIs change
- architecture changes
- env vars change
- workflows change

Example policy:

```text
If backend changes and docs do not change,
CI should fail.
```

---

## MCP Strategy

### MCP Purpose

MCP servers become reusable AI infrastructure.

Treat them as:

- platform capabilities
- shared tooling
- reusable agent integrations

---

### Initial MCP Servers

#### Filesystem MCP

Purpose:

- safe repo navigation
- file discovery
- structured edits

---

#### Git MCP

Purpose:

- commit awareness
- branch analysis
- PR summaries
- history tracing

---

#### PostgreSQL MCP

Purpose:

- schema understanding
- query assistance
- migration analysis

---

#### GitHub MCP

Purpose:

- issue management
- PR automation
- workflow integration

---

#### Playwright MCP

Purpose:

- E2E validation
- browser automation
- UI regression checks

---

#### Docs MCP

Purpose:

- standards retrieval
- architecture lookup
- internal knowledge retrieval

---

## Automated Testing Strategy

### Test Philosophy

AI-generated code is not complete until:

- typed
- linted
- tested
- documented

---

## Testing Pyramid

### Unit Tests

Required for:

- business logic
- utility functions
- parsers
- transformers
- validation

Fast and broad.

---

### Integration Tests

Required for:

- APIs
- databases
- queues
- authentication
- external integrations

---

### E2E Tests

Required only for:

- critical user flows
- payments
- authentication
- onboarding
- high-risk workflows

Avoid excessive E2E coverage.

---

## Frontend Testing

### Test Stack

- Vitest
- React Testing Library
- Playwright

---

## Python Testing

### Python Test Stack

- pytest
- pytest-asyncio
- pytest-cov
- Testcontainers

---

## JVM Testing

### JVM Test Stack

- JUnit 5
- Testcontainers
- Mockito

---

## CI/CD Architecture

### GitHub Actions

Pipeline stages:

```text
lint
→ typecheck
→ unit tests
→ integration tests
→ docs validation
→ architecture checks
→ build
→ deploy
```

---

### Required Checks

#### Frontend

- ESLint
- TypeScript
- tests
- bundle checks

---

#### Python

- Ruff
- Pyright
- pytest

---

#### Java

- Gradle build
- unit tests
- integration tests

---

### Drift Prevention Checks

#### Prevent pip usage

```bash
if grep -R "pip install" .
then
  echo "Use uv instead of pip"
  exit 1
fi
```

---

#### Enforce lockfiles

Require:

- uv.lock
- pnpm-lock.yaml

---

#### Prevent undocumented env vars

CI should validate:

- .env.example
- docs
- runtime config

remain aligned.

---

## Bootstrap Workflow

### New Project Flow

#### Step 1

Generate base app:

Examples:

```bash
npx create-next-app
uv init
npx create-expo-app
```

---

#### Step 2

Apply standards layer:

- copy AGENTS.md
- configure CI
- configure pre-commit
- configure linting
- configure testing

---

#### Step 3

Generate context files:

```text
CONTEXT.md
IMPLEMENTATION_GUIDE.md
```

---

#### Step 4

Register MCP integrations.

---

## Local Development

### Tooling

#### Required

- Docker Desktop
- uv
- pnpm
- just
- Node.js LTS
- Python 3.13+
- Java 21+

---

## justfile Strategy

Use `just` as the unified command interface.

Example:

```text
just setup
just test
just lint
just typecheck
just dev
```

This becomes:

- human-friendly
- AI-agent-friendly

---

## Dev Containers

Use `.devcontainer` for:

- reproducible onboarding
- consistent tooling
- agent compatibility

---

## Observability Strategy

### Initial Stack

- OpenTelemetry
- structured logging
- Sentry
- Prometheus
- Grafana

---

## Security Standards

### Requirements

- secret scanning
- dependency scanning
- SBOM generation
- signed commits optional later
- least privilege for MCPs

---

## AI Workflow Architecture

### Recommended Agent Workflow

#### 1. Planning Phase

Agent:

- reviews standards
- reviews architecture
- creates implementation plan

---

#### 2. Implementation Phase

Agent:

- generates code
- generates tests
- updates docs

---

#### 3. Validation Phase

Agent:

- runs lint
- runs tests
- validates types
- validates docs

---

#### 4. Human Review

Human:

- reviews architecture
- reviews security
- reviews maintainability

---

## Long-Term Evolution Strategy

### Avoid Hardcoding Ecosystem Assumptions

The architecture should support future changes.

Examples:

- uv may evolve
- MCP standards will evolve
- React Native may evolve
- AI agents will evolve

The repository should isolate tooling decisions.

---

## Recommended Future Expansion

### Phase 1

Build:

- monorepo
- standards system
- CI
- docs
- AI workflows

---

### Phase 2

Add:

- MCP orchestration
- reusable skills
- code generators
- observability

---

### Phase 3

Add:

- deployment automation
- infrastructure automation
- advanced AI workflows
- autonomous maintenance tooling

---

## Final Recommendations

### Optimize For

- maintainability
- consistency
- AI collaboration
- reusable standards
- drift prevention
- layered context
- typed contracts
- automated validation

---

### Avoid

- giant custom CLIs
- excessive abstraction
- over-sharing UI code
- massive prompts
- duplicated standards
- uncontrolled agent autonomy
- framework churn obsession

---

## Golden Rule

The repository should behave like:

"an AI-native engineering platform"

not:

"a pile of generated code"

---
