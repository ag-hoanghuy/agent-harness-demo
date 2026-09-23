import { Inject, Injectable } from '@nestjs/common';
import {
  AUDIT_EVENT_SCHEMA_VERSION,
  CHECKPOINT_SCHEMA_VERSION,
  RUN_SCHEMA_VERSION,
} from '../../contracts/schema-version.js';
import { RunId } from '../../contracts/ids.js';
import { RuntimeStoreService } from '../../database/runtime-store.service.js';
import { AuditEvent } from '../audit/audit-event.contract.js';
import { AuditEventType } from '../audit/audit-event-type.enum.js';
import { Checkpoint } from '../checkpoint/checkpoint.contract.js';
import { RunPolicyService } from '../control-plane/run-policy.service.js';
import { HarnessRun } from '../run/run.contract.js';
import {
  RunNotFoundError,
  RunVersionConflictError,
} from '../run/run.errors.js';
import { RUN_REPOSITORY } from '../run/run.repository.js';
import type { RunRepository } from '../run/run.repository.js';
import { HarnessRunState } from '../run/run-state.enum.js';
import { RunStep } from '../run/run-step.enum.js';
import { assertRunTransition } from '../run/run-transition.js';
import {
  ChannelConfigMismatchError,
  ChannelConfigNotFoundError,
  ChannelNotFoundError,
  InvalidChannelConfigError,
  SkillNotFoundError,
  UnsafeWorkspacePathError,
} from '../runtime/channel-runtime.errors.js';
import { ContextLoaderService } from '../runtime/context-loader.service.js';
import { createContextSnapshot } from '../runtime/context-snapshot.js';
import type { ChannelContext } from '../runtime/contracts/channel-context.contract.js';
import {
  CreateRunCommand,
  RunLifecycleCommand,
} from './run-orchestrator.contracts.js';
import {
  ChannelDisabledError,
  InvalidPreflightStepError,
  RunCapacityExceededError,
  RunPreflightError,
} from './run-orchestrator.errors.js';
import { RuntimeIdFactory } from './runtime-id.factory.js';

const PREFLIGHT_SKILLS = Object.freeze(['topic-research']);

interface FailureClassification {
  readonly state: HarnessRunState;
  readonly errorToThrow: Error;
}

@Injectable()
export class HarnessRunOrchestrator {
  constructor(
    @Inject(RUN_REPOSITORY)
    private readonly runRepository: RunRepository,
    private readonly runtimeStore: RuntimeStoreService,
    private readonly contextLoader: ContextLoaderService,
    private readonly policy: RunPolicyService,
    private readonly ids: RuntimeIdFactory,
  ) {}

  async createRun(command: CreateRunCommand): Promise<HarnessRun> {
    const channel = await this.contextLoader.loadChannelConfig(
      command.channelId,
    );
    this.policy.checkCanCreateRun(channel);

    const timestamp = new Date().toISOString();
    const run: HarnessRun = {
      id: this.ids.createRunId(),
      channel_id: channel.channelId,
      state: HarnessRunState.SCHEDULED,
      current_step: null,
      retry_count: 0,
      max_retries: channel.limits.maxRetriesPerStep,
      schema_version: RUN_SCHEMA_VERSION,
      version: 1,
      created_at: timestamp,
      updated_at: timestamp,
    };
    const auditEvent = this.createAuditEvent(
      run,
      command,
      AuditEventType.RUN_CREATED,
      { state: HarnessRunState.SCHEDULED },
      timestamp,
    );

    return this.runtimeStore.createRunWithAudit(run, auditEvent);
  }

  async queueRun(command: RunLifecycleCommand): Promise<HarnessRun> {
    const run = await this.getRunAtVersion(
      command.runId,
      command.expectedVersion,
    );
    assertRunTransition(run.state, HarnessRunState.QUEUED);

    const timestamp = new Date().toISOString();
    const queuedRun: HarnessRun = {
      ...run,
      state: HarnessRunState.QUEUED,
      current_step: null,
      updated_at: timestamp,
    };
    const auditEvent = this.createStateChangedAudit(
      queuedRun,
      command,
      run.state,
      HarnessRunState.QUEUED,
      timestamp,
    );

    return this.runtimeStore.saveRunWithAudits(
      queuedRun,
      command.expectedVersion,
      [auditEvent],
    );
  }

  async preflightRun(command: RunLifecycleCommand): Promise<HarnessRun> {
    const queuedRun = await this.getRunAtVersion(
      command.runId,
      command.expectedVersion,
    );
    assertRunTransition(queuedRun.state, HarnessRunState.PREFLIGHT);

    const preflightTimestamp = new Date().toISOString();
    const preflightCandidate: HarnessRun = {
      ...queuedRun,
      state: HarnessRunState.PREFLIGHT,
      current_step: RunStep.PRECHECK,
      updated_at: preflightTimestamp,
    };
    const preflightRun = await this.runtimeStore.saveRunWithAudits(
      preflightCandidate,
      command.expectedVersion,
      [
        this.createStateChangedAudit(
          preflightCandidate,
          command,
          queuedRun.state,
          HarnessRunState.PREFLIGHT,
          preflightTimestamp,
        ),
        this.createAuditEvent(
          preflightCandidate,
          command,
          AuditEventType.STEP_STARTED,
          { step: RunStep.PRECHECK },
          preflightTimestamp,
        ),
      ],
    );

    let context: ChannelContext;
    try {
      context = await this.contextLoader.loadChannelContext(
        preflightRun.channel_id,
        { skills: PREFLIGHT_SKILLS },
      );
      this.policy.checkChannelEnabled(context.channel);
      const activeRuns = await this.runRepository.findActiveByChannel(
        preflightRun.channel_id,
      );
      this.policy.checkCapacity(context.channel, activeRuns, preflightRun.id);
      this.policy.checkCanEnterStep(
        preflightRun,
        context,
        RunStep.TOPIC_RESEARCH,
      );
    } catch (error) {
      const classification = this.classifyPreflightFailure(
        preflightRun.id,
        error,
      );
      await this.persistPreflightFailure(
        preflightRun,
        command,
        classification.state,
        error,
      );
      throw classification.errorToThrow;
    }

    const snapshot = createContextSnapshot(context);
    const completedAt = new Date().toISOString();
    const readyRun: HarnessRun = {
      ...preflightRun,
      state: HarnessRunState.RUNNING_STEP,
      current_step: RunStep.TOPIC_RESEARCH,
      updated_at: completedAt,
    };
    const checkpoint: Checkpoint = {
      id: this.ids.createCheckpointId(),
      run_id: readyRun.id,
      step: RunStep.PRECHECK,
      run_state: HarnessRunState.RUNNING_STEP,
      episode_id: readyRun.episode_id,
      artifact_refs: [],
      context_snapshot: snapshot,
      correlation_id: command.correlationId,
      created_at: completedAt,
      schema_version: CHECKPOINT_SCHEMA_VERSION,
    };

    return this.runtimeStore.saveRunWithCheckpointAndAudits(
      readyRun,
      preflightRun.version,
      checkpoint,
      [
        this.createAuditEvent(
          readyRun,
          command,
          AuditEventType.STEP_COMPLETED,
          { step: RunStep.PRECHECK },
          completedAt,
        ),
        this.createStateChangedAudit(
          readyRun,
          command,
          HarnessRunState.PREFLIGHT,
          HarnessRunState.RUNNING_STEP,
          completedAt,
        ),
      ],
    );
  }

  private async getRunAtVersion(
    runId: RunId,
    expectedVersion: number,
  ): Promise<HarnessRun> {
    const run = await this.runRepository.findById(runId);
    if (run === null) {
      throw new RunNotFoundError(runId);
    }
    if (run.version !== expectedVersion) {
      throw new RunVersionConflictError(runId, expectedVersion);
    }
    return run;
  }

  private async persistPreflightFailure(
    run: HarnessRun,
    command: RunLifecycleCommand,
    failureState: HarnessRunState,
    cause: unknown,
  ): Promise<void> {
    assertRunTransition(run.state, failureState);
    const timestamp = new Date().toISOString();
    const failedRun: HarnessRun = {
      ...run,
      state: failureState,
      updated_at: timestamp,
    };
    const reason = cause instanceof Error ? cause.name : 'UnknownError';
    const auditEvents: AuditEvent[] = [
      this.createStateChangedAudit(
        failedRun,
        command,
        run.state,
        failureState,
        timestamp,
        { reason },
      ),
    ];
    if (
      failureState === HarnessRunState.FAILED_FINAL ||
      failureState === HarnessRunState.FAILED_RECOVERABLE
    ) {
      auditEvents.push(
        this.createAuditEvent(
          failedRun,
          command,
          AuditEventType.RUN_FAILED,
          {
            reason,
            recoverable: failureState === HarnessRunState.FAILED_RECOVERABLE,
          },
          timestamp,
        ),
      );
    }
    await this.runtimeStore.saveRunWithAudits(
      failedRun,
      run.version,
      auditEvents,
    );
  }

  private classifyPreflightFailure(
    runId: RunId,
    error: unknown,
  ): FailureClassification {
    if (
      error instanceof ChannelDisabledError ||
      error instanceof RunCapacityExceededError
    ) {
      return { state: HarnessRunState.BLOCKED, errorToThrow: error };
    }
    if (
      error instanceof ChannelNotFoundError ||
      error instanceof ChannelConfigNotFoundError ||
      error instanceof InvalidChannelConfigError ||
      error instanceof ChannelConfigMismatchError ||
      error instanceof SkillNotFoundError ||
      error instanceof UnsafeWorkspacePathError ||
      error instanceof InvalidPreflightStepError
    ) {
      return { state: HarnessRunState.FAILED_FINAL, errorToThrow: error };
    }
    return {
      state: HarnessRunState.FAILED_RECOVERABLE,
      errorToThrow: new RunPreflightError(runId, { cause: error }),
    };
  }

  private createStateChangedAudit(
    run: HarnessRun,
    command: Pick<RunLifecycleCommand, 'actor' | 'correlationId'>,
    from: HarnessRunState,
    to: HarnessRunState,
    timestamp: string,
    extraMetadata: Readonly<Record<string, unknown>> = {},
  ): AuditEvent {
    return this.createAuditEvent(
      run,
      command,
      AuditEventType.RUN_STATE_CHANGED,
      { from_state: from, to_state: to, ...extraMetadata },
      timestamp,
    );
  }

  private createAuditEvent(
    run: HarnessRun,
    command: Pick<CreateRunCommand, 'actor' | 'correlationId'>,
    eventType: AuditEventType,
    metadata: Readonly<Record<string, unknown>>,
    timestamp: string,
  ): AuditEvent {
    return {
      id: this.ids.createAuditEventId(),
      run_id: run.id,
      episode_id: run.episode_id,
      channel_id: run.channel_id,
      event_type: eventType,
      actor: command.actor,
      correlation_id: command.correlationId,
      metadata,
      created_at: timestamp,
      schema_version: AUDIT_EVENT_SCHEMA_VERSION,
    };
  }
}
