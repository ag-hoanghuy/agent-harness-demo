import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getStatus() {
    return {
      name: 'agent-harness-demo',
      status: 'ok',
      phase: 'part-01',
    };
  }
}
