import type { z } from 'zod';
import {
  getAssetMetadataInputSchema,
  getRecentAnalyticsInputSchema,
  searchAssetsInputSchema,
} from './local-tool-definitions.js';
import { findMockAsset, searchMockAssets } from './mock-media-catalog.js';
import { getMockRecentAnalytics, hasMockAnalytics } from './mock-analytics.js';

export class LocalMcpToolError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'LocalMcpToolError';
  }
}

export const searchAssets = (
  input: z.infer<typeof searchAssetsInputSchema>,
): Readonly<Record<string, unknown>> => ({
  assets: searchMockAssets(input.query, input.limit),
});

export const getAssetMetadata = (
  input: z.infer<typeof getAssetMetadataInputSchema>,
): Readonly<Record<string, unknown>> => {
  const asset = findMockAsset(input.asset_id);
  if (asset === undefined) {
    throw new LocalMcpToolError(
      'ASSET_NOT_FOUND',
      `Không tìm thấy mock asset: ${input.asset_id}`,
    );
  }
  return { asset };
};

export const getRecentAnalytics = (
  input: z.infer<typeof getRecentAnalyticsInputSchema>,
): Readonly<Record<string, unknown>> => {
  if (!hasMockAnalytics(input.channel_id)) {
    throw new LocalMcpToolError(
      'ANALYTICS_NOT_FOUND',
      `Không có mock analytics cho channel: ${input.channel_id}`,
    );
  }
  return getMockRecentAnalytics(input.channel_id, input.days);
};
