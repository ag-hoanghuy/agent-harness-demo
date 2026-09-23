import {
  getAssetMetadata,
  getRecentAnalytics,
  LocalMcpToolError,
  searchAssets,
} from './local-mcp-tools.js';

describe('Local MCP tools', () => {
  describe('search_assets', () => {
    it('tìm đúng mock asset theo từ khóa', () => {
      const result = searchAssets({ query: 'floating market', limit: 5 });

      expect(result).toEqual({
        assets: [
          {
            id: 'asset-001',
            title: 'Chợ nổi Cái Răng lúc bình minh',
            media_type: 'video',
            duration_seconds: 42,
            tags: ['can-tho', 'floating-market', 'vietnam'],
          },
        ],
      });
    });

    it('trả assets rỗng khi query không match', () => {
      expect(searchAssets({ query: 'antarctica' })).toEqual({ assets: [] });
    });

    it('tôn trọng limit', () => {
      const result = searchAssets({ query: 'vietnam', limit: 2 });

      expect(result.assets).toHaveLength(2);
    });

    it('deterministic với cùng input', () => {
      const input = { query: 'vietnam', limit: 4 };

      expect(searchAssets(input)).toEqual(searchAssets(input));
    });
  });

  describe('get_asset_metadata', () => {
    it('trả metadata của asset tồn tại', () => {
      expect(getAssetMetadata({ asset_id: 'asset-001' })).toEqual({
        asset: {
          id: 'asset-001',
          title: 'Chợ nổi Cái Răng lúc bình minh',
          media_type: 'video',
          duration_seconds: 42,
          resolution: '1920x1080',
          location: 'Can Tho',
          tags: ['can-tho', 'floating-market', 'vietnam'],
        },
      });
    });

    it('báo typed error khi asset không tồn tại', () => {
      expect(() => getAssetMetadata({ asset_id: 'asset-missing' })).toThrow(
        LocalMcpToolError,
      );
    });
  });

  describe('get_recent_analytics', () => {
    it('trả đúng channel, period và dữ liệu deterministic', () => {
      const input = { channel_id: 'channel-vietnam-discovery', days: 7 };
      const first = getRecentAnalytics(input);
      const second = getRecentAnalytics(input);

      expect(first).toEqual(second);
      expect(first).toMatchObject({
        channel_id: 'channel-vietnam-discovery',
        period_days: 7,
        metrics: { views: 125_000, average_watch_seconds: 31 },
      });
    });
  });
});
