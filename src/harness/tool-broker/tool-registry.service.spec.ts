import { TOOL_DEFINITION_SCHEMA_VERSION } from '../../contracts/schema-version.js';
import {
  DuplicateToolRegistrationError,
  ToolNotRegisteredError,
} from './tool-broker.errors.js';
import type { RegisteredTool } from './tool-executor.interface.js';
import { ToolRegistryService } from './tool-registry.service.js';
import { ToolSchemaValidatorService } from './tool-schema-validator.service.js';

const registeredTool: RegisteredTool = {
  definition: {
    name: 'search_assets',
    schema_version: TOOL_DEFINITION_SCHEMA_VERSION,
    required_permissions: [],
    input_schema: { type: 'object' },
    output_schema: { type: 'object' },
    timeout_ms: 1_000,
    max_retries: 0,
    idempotent: true,
    side_effect: false,
  },
  executor: {
    execute: vi.fn().mockResolvedValue({}),
  },
};

describe('ToolRegistryService', () => {
  let registry: ToolRegistryService;

  beforeEach(() => {
    registry = new ToolRegistryService(new ToolSchemaValidatorService());
  });

  it('register và resolve ToolDefinition + ToolExecutor theo name', () => {
    registry.register(registeredTool);

    expect(registry.resolve('search_assets')).toBe(registeredTool);
  });

  it('từ chối duplicate registration', () => {
    registry.register(registeredTool);

    expect(() => registry.register(registeredTool)).toThrow(
      DuplicateToolRegistrationError,
    );
  });

  it('báo typed error khi tool chưa đăng ký', () => {
    expect(() => registry.resolve('missing_tool')).toThrow(
      ToolNotRegisteredError,
    );
  });
});
