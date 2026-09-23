import { Module } from '@nestjs/common';
import path from 'node:path';
import {
  CHANNELS_ROOT,
  ChannelRegistryService,
} from '../control-plane/channel-registry.service.js';
import { ContextLoaderService } from './context-loader.service.js';
import { SkillLoaderService } from './skill-loader.service.js';

@Module({
  providers: [
    {
      provide: CHANNELS_ROOT,
      useFactory: (): string => path.resolve(process.cwd(), 'channels'),
    },
    ChannelRegistryService,
    SkillLoaderService,
    ContextLoaderService,
  ],
  exports: [ChannelRegistryService, SkillLoaderService, ContextLoaderService],
})
export class HarnessRuntimeModule {}
