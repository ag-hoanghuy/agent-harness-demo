import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MCP_LOCAL_SERVER_LAUNCH = Symbol('MCP_LOCAL_SERVER_LAUNCH');

export interface McpLocalServerLaunch {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
}

export const createLocalMcpServerLaunch = (): McpLocalServerLaunch => {
  const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(currentDirectory, '..', '..');
  const compiledEntrypoint = path.resolve(
    projectRoot,
    'dist',
    'mcp',
    'local',
    'local-mcp-server.js',
  );

  if (path.extname(fileURLToPath(import.meta.url)) === '.js') {
    return Object.freeze({
      command: process.execPath,
      args: Object.freeze([compiledEntrypoint]),
      cwd: projectRoot,
    });
  }

  const sourceEntrypoint = path.resolve(
    projectRoot,
    'src',
    'mcp',
    'local',
    'local-mcp-server.ts',
  );
  return Object.freeze({
    command: process.execPath,
    args: Object.freeze(['--loader', 'ts-node/esm', sourceEntrypoint]),
    cwd: projectRoot,
  });
};
