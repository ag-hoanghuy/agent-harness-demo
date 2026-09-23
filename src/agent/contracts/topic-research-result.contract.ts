export interface TopicResearchResult extends Readonly<Record<string, unknown>> {
  readonly topic: string;
  readonly summary: string;
  readonly candidate_asset_queries: readonly string[];
}
