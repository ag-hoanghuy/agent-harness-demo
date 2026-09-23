# Agent Harness Demo

## Goal

This repository is a learning demo of a Local Agent Harness for one content channel. Part 01 bootstraps a NestJS application and records the intended architecture without implementing runtime or business behavior.

## Architecture Principles

- The Harness controls workflow execution, runtime lifecycle, policy, and permissions.
- The Agent reasons only within its assigned task; it does not mutate workflow state or approve gates.
- Mini M2 owns the production workflow, gates, artifacts, and business validation.
- Tool access will go through the Tool Broker.
- PostgreSQL will be added in a later part as the runtime source of truth.
- M1 and M4 are not implemented yet; later work will begin with adapters or mocks.

See [Architecture Boundaries](docs/architecture-boundaries.md) for the ownership model.

## Current Progress

- [x] Part 01 - Bootstrap & Architecture Skeleton
- [ ] Part 02 - Core Contracts & State Models
- [ ] Part 03 - PostgreSQL Runtime Store
- [ ] Part 04 - Channel Runtime & Context Loader
- [ ] Part 05 - Harness Run Orchestrator
- [ ] Part 06 - Agent Provider Interface + FakeProvider
- [ ] Part 07 - Tool Broker
- [ ] Part 08 - MCP Local Tools
- [ ] Part 09 - Mini M2 + Gate 1
- [ ] Part 10 - Gemini Provider
- [ ] Part 11 - Checkpoint / Pause / Resume / Recovery
- [ ] Part 12 - End-to-End Demo

## Run Locally

Requirements: Node.js 22 or newer and npm.

```bash
npm install
npm run start:dev
```

The application listens on port `3000` by default. Override it by setting the `APP_PORT` environment variable. The sample contract is documented in `.env.example`; Part 01 does not load `.env` files automatically.

Request `GET http://localhost:3000/` to receive:

```json
{
  "name": "agent-harness-demo",
  "status": "ok",
  "phase": "part-01"
}
```

## Verification

```bash
npm run lint
npm test
npm run test:e2e
npm run build
```
