import { z } from 'zod';
import { TOOL_DEFINITION_SCHEMA_VERSION } from '../../contracts/schema-version.js';
import type {
  JsonSchema,
  ToolDefinition,
} from '../../harness/tool-broker/tool.contract.js';

export const LOCAL_MCP_TOOL_NAMES = Object.freeze({
  SEARCH_ASSETS: 'search_assets',
  GET_ASSET_METADATA: 'get_asset_metadata',
  GET_RECENT_ANALYTICS: 'get_recent_analytics',
} as const);

export type LocalMcpToolName =
  (typeof LOCAL_MCP_TOOL_NAMES)[keyof typeof LOCAL_MCP_TOOL_NAMES];

export const mediaTypeSchema = z.enum(['video', 'image']);

export const searchAssetSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    media_type: mediaTypeSchema,
    duration_seconds: z.number().int().nonnegative(),
    tags: z.array(z.string().min(1)),
  })
  .strict();

export const searchAssetsInputSchema = z
  .object({
    query: z.string().min(1).regex(/\S/u),
    limit: z.number().int().min(1).max(20).optional(),
  })
  .strict();

export const searchAssetsOutputSchema = z
  .object({
    assets: z.array(searchAssetSchema),
  })
  .strict();

export const getAssetMetadataInputSchema = z
  .object({
    asset_id: z.string().min(1).regex(/\S/u),
  })
  .strict();

export const assetMetadataSchema = searchAssetSchema
  .extend({
    resolution: z.string().min(1),
    location: z.string().min(1),
  })
  .strict();

export const getAssetMetadataOutputSchema = z
  .object({
    asset: assetMetadataSchema,
  })
  .strict();

export const getRecentAnalyticsInputSchema = z
  .object({
    channel_id: z.string().min(1).regex(/\S/u),
    days: z.number().int().min(1).max(90),
  })
  .strict();

export const getRecentAnalyticsOutputSchema = z
  .object({
    channel_id: z.string().min(1),
    period_days: z.number().int().min(1),
    metrics: z
      .object({
        views: z.number().int().nonnegative(),
        average_watch_seconds: z.number().nonnegative(),
      })
      .strict(),
    top_topics: z.array(
      z
        .object({
          topic: z.string().min(1),
          score: z.number().min(0).max(1),
        })
        .strict(),
    ),
  })
  .strict();

const toBrokerSchema = (schema: z.ZodType): JsonSchema =>
  Object.freeze(
    z.toJSONSchema(schema, { target: 'draft-7' }) as Readonly<
      Record<string, unknown>
    >,
  );

const createDefinition = (
  name: LocalMcpToolName,
  inputSchema: z.ZodType,
  outputSchema: z.ZodType,
  requiredPermissions: readonly string[],
): ToolDefinition =>
  Object.freeze({
    name,
    schema_version: TOOL_DEFINITION_SCHEMA_VERSION,
    required_permissions: Object.freeze([...requiredPermissions]),
    input_schema: toBrokerSchema(inputSchema),
    output_schema: toBrokerSchema(outputSchema),
    timeout_ms: 2_000,
    max_retries: 1,
    idempotent: true,
    side_effect: false,
  });

export const LOCAL_MCP_TOOL_DEFINITIONS: Readonly<
  Record<LocalMcpToolName, ToolDefinition>
> = Object.freeze({
  [LOCAL_MCP_TOOL_NAMES.SEARCH_ASSETS]: createDefinition(
    LOCAL_MCP_TOOL_NAMES.SEARCH_ASSETS,
    searchAssetsInputSchema,
    searchAssetsOutputSchema,
    ['media:read'],
  ),
  [LOCAL_MCP_TOOL_NAMES.GET_ASSET_METADATA]: createDefinition(
    LOCAL_MCP_TOOL_NAMES.GET_ASSET_METADATA,
    getAssetMetadataInputSchema,
    getAssetMetadataOutputSchema,
    ['media:read'],
  ),
  [LOCAL_MCP_TOOL_NAMES.GET_RECENT_ANALYTICS]: createDefinition(
    LOCAL_MCP_TOOL_NAMES.GET_RECENT_ANALYTICS,
    getRecentAnalyticsInputSchema,
    getRecentAnalyticsOutputSchema,
    ['analytics:read'],
  ),
});

export const LOCAL_MCP_TOOL_NAME_LIST = Object.freeze(
  Object.values(LOCAL_MCP_TOOL_NAMES),
);
