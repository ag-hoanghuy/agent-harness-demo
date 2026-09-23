import type { z } from 'zod';
import type {
  assetMetadataSchema,
  searchAssetSchema,
} from './local-tool-definitions.js';

type MutableSearchAsset = z.infer<typeof searchAssetSchema>;
type MutableAssetMetadata = z.infer<typeof assetMetadataSchema>;

export type SearchAsset = Readonly<
  Omit<MutableSearchAsset, 'tags'> & { readonly tags: readonly string[] }
>;
export type AssetMetadata = Readonly<
  Omit<MutableAssetMetadata, 'tags'> & { readonly tags: readonly string[] }
>;

const createAsset = (asset: AssetMetadata): Readonly<AssetMetadata> =>
  Object.freeze({ ...asset, tags: Object.freeze([...asset.tags]) });

export const MOCK_MEDIA_CATALOG: readonly Readonly<AssetMetadata>[] =
  Object.freeze([
    createAsset({
      id: 'asset-001',
      title: 'Chợ nổi Cái Răng lúc bình minh',
      media_type: 'video',
      duration_seconds: 42,
      resolution: '1920x1080',
      location: 'Can Tho',
      tags: ['can-tho', 'floating-market', 'vietnam'],
    }),
    createAsset({
      id: 'asset-002',
      title: 'Phố cổ Hội An lên đèn',
      media_type: 'video',
      duration_seconds: 35,
      resolution: '3840x2160',
      location: 'Hoi An',
      tags: ['hoi-an', 'lanterns', 'heritage', 'vietnam'],
    }),
    createAsset({
      id: 'asset-003',
      title: 'Đèo Mã Pí Lèng ở Hà Giang',
      media_type: 'video',
      duration_seconds: 51,
      resolution: '3840x2160',
      location: 'Ha Giang',
      tags: ['ha-giang', 'mountains', 'road-trip', 'vietnam'],
    }),
    createAsset({
      id: 'asset-004',
      title: 'Ẩm thực đường phố Hà Nội',
      media_type: 'video',
      duration_seconds: 47,
      resolution: '1920x1080',
      location: 'Ha Noi',
      tags: ['ha-noi', 'street-food', 'vietnam'],
    }),
    createAsset({
      id: 'asset-005',
      title: 'Vịnh Hạ Long nhìn từ trên cao',
      media_type: 'image',
      duration_seconds: 0,
      resolution: '6000x4000',
      location: 'Ha Long',
      tags: ['ha-long', 'bay', 'aerial', 'vietnam'],
    }),
  ]);

const normalizeSearchText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim();

const toSearchAsset = (asset: AssetMetadata): SearchAsset => ({
  id: asset.id,
  title: asset.title,
  media_type: asset.media_type,
  duration_seconds: asset.duration_seconds,
  tags: [...asset.tags],
});

export const searchMockAssets = (
  query: string,
  limit = 5,
): readonly SearchAsset[] => {
  const terms = normalizeSearchText(query).split(/\s+/u).filter(Boolean);

  return MOCK_MEDIA_CATALOG.filter((asset) => {
    const searchable = normalizeSearchText(
      [asset.title, asset.location, ...asset.tags].join(' '),
    );
    return terms.every((term) => searchable.includes(term));
  })
    .slice(0, limit)
    .map(toSearchAsset);
};

export const findMockAsset = (assetId: string): AssetMetadata | undefined => {
  const asset = MOCK_MEDIA_CATALOG.find(({ id }) => id === assetId);
  return asset === undefined ? undefined : { ...asset, tags: [...asset.tags] };
};
