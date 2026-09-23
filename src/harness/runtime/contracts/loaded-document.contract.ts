export interface LoadedDocument {
  readonly name: string;
  readonly relativePath: string;
  readonly content: string;
  readonly checksum: string;
}

export interface LoadedSkill extends LoadedDocument {
  readonly allowedTools: readonly string[];
}
