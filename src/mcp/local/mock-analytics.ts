import type { z } from 'zod';
import type { getRecentAnalyticsOutputSchema } from './local-tool-definitions.js';

export type RecentAnalytics = z.infer<typeof getRecentAnalyticsOutputSchema>;

const DEMO_CHANNEL_ID = 'channel-vietnam-discovery';

const MOCK_ANALYTICS = Object.freeze({
  metrics: Object.freeze({
    views: 125_000,
    average_watch_seconds: 31,
  }),
  topTopics: Object.freeze([
    Object.freeze({ topic: 'Vietnam street food', score: 0.91 }),
    Object.freeze({ topic: 'Mekong Delta', score: 0.84 }),
  ]),
});

export const hasMockAnalytics = (channelId: string): boolean =>
  channelId === DEMO_CHANNEL_ID;

export const getMockRecentAnalytics = (
  channelId: string,
  days: number,
): RecentAnalytics => ({
  channel_id: channelId,
  period_days: days,
  metrics: { ...MOCK_ANALYTICS.metrics },
  top_topics: MOCK_ANALYTICS.topTopics.map((topic) => ({ ...topic })),
});
