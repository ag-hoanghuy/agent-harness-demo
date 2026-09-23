import { Injectable } from '@nestjs/common';
import { Ajv, type ErrorObject, type ValidateFunction } from 'ajv';
import type { JsonSchema } from './tool.contract.js';

export interface ToolSchemaValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

@Injectable()
export class ToolSchemaValidatorService {
  private readonly ajv = new Ajv({ allErrors: true, strict: true });
  private readonly validators = new WeakMap<object, ValidateFunction>();

  validate(schema: JsonSchema, value: unknown): ToolSchemaValidationResult {
    const validator = this.getValidator(schema);
    const valid = validator(value);

    return Object.freeze({
      valid,
      errors: Object.freeze(
        valid ? [] : (validator.errors ?? []).map(this.formatError),
      ),
    });
  }

  assertValidSchema(toolName: string, schema: JsonSchema): void {
    this.getValidator(schema, toolName);
  }

  private getValidator(
    schema: JsonSchema,
    toolName = 'unknown',
  ): ValidateFunction {
    const cached = this.validators.get(schema);
    if (cached !== undefined) {
      return cached;
    }

    try {
      const validator = this.ajv.compile(schema);
      this.validators.set(schema, validator);
      return validator;
    } catch (error) {
      throw new Error(`JSON Schema của tool ${toolName} không hợp lệ`, {
        cause: error,
      });
    }
  }

  private readonly formatError = (error: ErrorObject): string =>
    `${error.instancePath || '/'} ${error.keyword}`;
}
