import { ARTIFACT_SCHEMA_VERSION } from '../../contracts/schema-version.js';
import { ArtifactId, EpisodeId } from '../../contracts/ids.js';
import { ArtifactKind } from './artifact-kind.enum.js';

export interface Artifact {
  id: ArtifactId;
  episode_id: EpisodeId;
  kind: ArtifactKind;
  uri?: string;
  content_type: string;
  sha256?: string;
  producer: string;
  schema_version: typeof ARTIFACT_SCHEMA_VERSION;
  created_at: string;
}
