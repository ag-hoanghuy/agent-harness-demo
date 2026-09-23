# Architecture Boundaries

Part 01 establishes ownership boundaries only. It does not implement orchestration, integrations, persistence, or business workflows.

```text
Operator
   ↓
Harness
   ↓
Channel Runtime
   ├── Agent
   │    ↓
   │ Tool Broker
   │    ↓
   │   MCP
   │
   └── Mini M2
```

## Harness owns

- `run_id`
- Run lifecycle
- Policy
- Pause, resume, and stop controls
- Retry behavior
- Checkpoints
- Tool permissions
- Audit records

The Harness Run Orchestrator coordinates harness runs. It is not the Mini M2 Production Orchestrator.

## Mini M2 owns

- `episode_id`
- Production workflow and state
- Gates
- Artifacts
- Business validation

Mini M2 does not own harness run lifecycle or runtime permissions.

## Agent boundary

The Agent performs reasoning only within an assigned task. It does not directly change workflow state, approve a Gate, access a database or storage, run arbitrary shell commands, or invoke workers.

## MCP boundary

MCP is an integration protocol. It is neither the Agent nor the Harness. Future tool integrations will be mediated by the Tool Broker.

## M1 and M4 boundary

M1 and M4 are not implemented in Part 01. Later parts will begin with adapters or mocks before any real integration is introduced.
