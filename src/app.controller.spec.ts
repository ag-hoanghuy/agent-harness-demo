import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return the Part 01 status', () => {
      expect(appController.getStatus()).toEqual({
        name: 'agent-harness-demo',
        status: 'ok',
        phase: 'part-01',
      });
    });
  });
});
