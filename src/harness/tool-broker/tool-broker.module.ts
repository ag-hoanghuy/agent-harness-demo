import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { ToolBrokerService } from './tool-broker.service.js';
import { ToolRegistryService } from './tool-registry.service.js';
import { ToolSchemaValidatorService } from './tool-schema-validator.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [
    ToolSchemaValidatorService,
    ToolRegistryService,
    ToolBrokerService,
  ],
  exports: [ToolBrokerService, ToolRegistryService],
})
export class ToolBrokerModule {}
