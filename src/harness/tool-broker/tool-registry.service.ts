import { Injectable } from '@nestjs/common';
import { TOOL_DEFINITION_SCHEMA_VERSION } from '../../contracts/schema-version.js';
import {
  DuplicateToolRegistrationError,
  InvalidToolDefinitionError,
  ToolNotRegisteredError,
} from './tool-broker.errors.js';
import type { RegisteredTool } from './tool-executor.interface.js';
import { ToolSchemaValidatorService } from './tool-schema-validator.service.js';

const TOOL_NAME = /^[a-z][a-z0-9_:-]*$/u;

@Injectable()
export class ToolRegistryService {
  private readonly tools = new Map<string, RegisteredTool>();

  constructor(private readonly schemas: ToolSchemaValidatorService) {}

  register(tool: RegisteredTool): void {
    const { definition } = tool;
    this.assertDefinition(definition);
    if (this.tools.has(definition.name)) {
      throw new DuplicateToolRegistrationError(definition.name);
    }
    this.tools.set(definition.name, Object.freeze(tool));
  }

  resolve(toolName: string): RegisteredTool {
    const tool = this.tools.get(toolName);
    if (tool === undefined) {
      throw new ToolNotRegisteredError(toolName);
    }
    return tool;
  }

  private assertDefinition(definition: RegisteredTool['definition']): void {
    if (!TOOL_NAME.test(definition.name)) {
      throw new InvalidToolDefinitionError(
        definition.name,
        'name không đúng định dạng',
      );
    }
    if (definition.schema_version !== TOOL_DEFINITION_SCHEMA_VERSION) {
      throw new InvalidToolDefinitionError(
        definition.name,
        'schema_version phải là tool-definition-1.1',
      );
    }
    if (!Number.isInteger(definition.timeout_ms) || definition.timeout_ms < 1) {
      throw new InvalidToolDefinitionError(
        definition.name,
        'timeout_ms phải là số nguyên dương',
      );
    }
    if (
      !Number.isInteger(definition.max_retries) ||
      definition.max_retries < 0
    ) {
      throw new InvalidToolDefinitionError(
        definition.name,
        'max_retries phải là số nguyên không âm',
      );
    }

    try {
      this.schemas.assertValidSchema(definition.name, definition.input_schema);
      this.schemas.assertValidSchema(definition.name, definition.output_schema);
    } catch (error) {
      throw new InvalidToolDefinitionError(
        definition.name,
        'input_schema hoặc output_schema không hợp lệ',
        { cause: error },
      );
    }
  }
}
