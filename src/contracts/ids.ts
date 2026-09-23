declare const idBrand: unique symbol;

type BrandedId<TName extends string> = string & {
  readonly [idBrand]: TName;
};

export type RunId = BrandedId<'RunId'>;
export type EpisodeId = BrandedId<'EpisodeId'>;
export type ChannelId = BrandedId<'ChannelId'>;
export type GateId = BrandedId<'GateId'>;
export type ArtifactId = BrandedId<'ArtifactId'>;
export type ToolCallId = BrandedId<'ToolCallId'>;
export type CheckpointId = BrandedId<'CheckpointId'>;
export type AuditEventId = BrandedId<'AuditEventId'>;
export type CorrelationId = BrandedId<'CorrelationId'>;
export type AgentTaskId = BrandedId<'AgentTaskId'>;

export const asRunId = (value: string): RunId => value as RunId;
export const asEpisodeId = (value: string): EpisodeId => value as EpisodeId;
export const asChannelId = (value: string): ChannelId => value as ChannelId;
export const asGateId = (value: string): GateId => value as GateId;
export const asArtifactId = (value: string): ArtifactId => value as ArtifactId;
export const asToolCallId = (value: string): ToolCallId => value as ToolCallId;
export const asCheckpointId = (value: string): CheckpointId =>
  value as CheckpointId;
export const asAuditEventId = (value: string): AuditEventId =>
  value as AuditEventId;
export const asCorrelationId = (value: string): CorrelationId =>
  value as CorrelationId;
export const asAgentTaskId = (value: string): AgentTaskId =>
  value as AgentTaskId;
