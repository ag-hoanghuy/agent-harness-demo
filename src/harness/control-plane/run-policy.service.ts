import { Injectable } from '@nestjs/common';
import { RunId } from '../../contracts/ids.js';
import {
  ChannelDisabledError,
  InvalidPreflightStepError,
  RunCapacityExceededError,
} from '../orchestrator/run-orchestrator.errors.js';
import { consumesChannelCapacity } from '../run/active-run-states.js';
import { HarnessRun } from '../run/run.contract.js';
import { HarnessRunState } from '../run/run-state.enum.js';
import { RunStep } from '../run/run-step.enum.js';
import { ChannelConfig } from '../runtime/contracts/channel-config.contract.js';
import { ChannelContext } from '../runtime/contracts/channel-context.contract.js';

const TOPIC_RESEARCH_SKILL = 'topic-research';

@Injectable()
export class RunPolicyService {
  checkCanCreateRun(channel: ChannelConfig): void {
    this.checkChannelEnabled(channel);
  }

  checkChannelEnabled(channel: ChannelConfig): void {
    if (!channel.enabled) {
      throw new ChannelDisabledError(channel.channelId);
    }
  }

  checkCapacity(
    channel: ChannelConfig,
    activeRuns: readonly HarnessRun[],
    currentRunId: RunId,
  ): void {
    const competingRuns = activeRuns.filter(
      (run) => run.id !== currentRunId && consumesChannelCapacity(run.state),
    );
    if (competingRuns.length >= channel.concurrency.maxActiveRuns) {
      throw new RunCapacityExceededError(
        channel.channelId,
        competingRuns.length,
        channel.concurrency.maxActiveRuns,
      );
    }
  }

  checkCanEnterStep(
    run: HarnessRun,
    context: ChannelContext,
    step: RunStep,
  ): void {
    if (run.state !== HarnessRunState.PREFLIGHT) {
      throw new InvalidPreflightStepError(
        run.id,
        step,
        `state hiện tại là ${run.state}`,
      );
    }
    if (context.channel.channelId !== run.channel_id) {
      throw new InvalidPreflightStepError(
        run.id,
        step,
        'ChannelContext không thuộc run',
      );
    }
    if (step !== RunStep.TOPIC_RESEARCH) {
      throw new InvalidPreflightStepError(
        run.id,
        step,
        'Part 05 chỉ chuẩn bị TOPIC_RESEARCH',
      );
    }
    if (!context.skills.some((skill) => skill.name === TOPIC_RESEARCH_SKILL)) {
      throw new InvalidPreflightStepError(
        run.id,
        step,
        `thiếu skill ${TOPIC_RESEARCH_SKILL}`,
      );
    }
  }
}
