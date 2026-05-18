import { Injectable } from '@nestjs/common';

/** Phản hồi cố định cho mock (không phân tích nội dung đầu vào). */
export const MOCK_AI_FIXED_SUMMARY =
  'Bạn đang chuẩn bị tìm internship hoặc công việc đầu tiên trong ngành IT? Workshop này sẽ giúp bạn nắm cách viết CV, xây dựng portfolio và trả lời phỏng vấn kỹ thuật hiệu quả hơn.';

@Injectable()
export class MockAiSummaryService {
  summarize(raw: string): { summary: string; inputChars: number } {
    const text = raw.replace(/\s+/g, ' ').trim();
    const inputChars = text.length;
    return { summary: MOCK_AI_FIXED_SUMMARY, inputChars };
  }
}
