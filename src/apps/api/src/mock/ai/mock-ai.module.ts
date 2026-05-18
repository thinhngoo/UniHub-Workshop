import { Module } from '@nestjs/common';
import { MockAiController } from './mock-ai.controller';
import { MockAiSummaryService } from './mock-ai-summary.service';

@Module({
  controllers: [MockAiController],
  providers: [MockAiSummaryService],
  exports: [MockAiSummaryService],
})
export class MockAiModule {}
