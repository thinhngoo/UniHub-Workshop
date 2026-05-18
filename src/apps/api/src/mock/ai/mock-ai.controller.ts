import { Body, Controller, Post, ValidationPipe } from '@nestjs/common';
import { SummarizeTextDto } from './dto/summarize-text.dto';
import { MockAiSummaryService } from './mock-ai-summary.service';

const summarizePipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

export type MockAiSummarizeResponse = {
  model: 'mock-ai-v1';
  inputChars: number;
  summary: string;
};

@Controller('mock/ai')
export class MockAiController {
  constructor(private readonly summary: MockAiSummaryService) {}

  @Post('summary')
  summarize(
    @Body(summarizePipe) body: SummarizeTextDto,
  ): MockAiSummarizeResponse {
    const out = this.summary.summarize(body.text);
    return {
      model: 'mock-ai-v1',
      inputChars: out.inputChars,
      summary: out.summary,
    };
  }
}
