import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { WorkshopSummaryQueuedResponse } from '@unihub/types';
import { Queue } from 'bullmq';
import {
  WORKSHOP_SUMMARY_JOB_NAME,
  WORKSHOP_SUMMARY_MAX_PDF_BYTES,
  WORKSHOP_SUMMARY_QUEUE,
} from '../../constant';
import { WorkshopsRepository } from '../database/repository/workshops.repository';
import { bufferLooksLikePdf, extractPdfPlainText } from './extract-pdf-text';
import type { WorkshopSummaryJobPayload } from './workshop-summary';

export interface WorkshopSummaryJobDone {
  workshopId: string;
  outcome: 'ready';
}

@Injectable()
export class WorkshopSummaryService {
  private readonly log = new Logger(WorkshopSummaryService.name);

  constructor(
    private readonly workshopsRepo: WorkshopsRepository,
    @InjectQueue(WORKSHOP_SUMMARY_QUEUE)
    private readonly summaryQueue: Queue,
  ) {}

  async enqueuePdfSummary(
    workshopId: string,
    pdfBuffer: Buffer,
  ): Promise<WorkshopSummaryQueuedResponse> {
    if (pdfBuffer.byteLength === 0) {
      throw new BadRequestException({
        code: 'pdf_required',
        message: 'Vui lòng tải lên file PDF.',
      });
    }
    if (pdfBuffer.byteLength > WORKSHOP_SUMMARY_MAX_PDF_BYTES) {
      throw new BadRequestException({
        code: 'pdf_too_large',
        message: `PDF tối đa ${WORKSHOP_SUMMARY_MAX_PDF_BYTES / (1024 * 1024)} MB.`,
      });
    }
    if (!bufferLooksLikePdf(pdfBuffer)) {
      throw new BadRequestException({
        code: 'pdf_invalid',
        message: 'File không phải PDF hợp lệ.',
      });
    }

    const workshop = await this.workshopsRepo.findById(workshopId);
    if (!workshop) {
      throw new NotFoundException({
        code: 'not_found',
        message: 'Workshop không tồn tại.',
      });
    }

    const updated = await this.workshopsRepo.markSummaryPending(workshopId);
    if (!updated) {
      throw new NotFoundException({
        code: 'not_found',
        message: 'Workshop không tồn tại.',
      });
    }

    const payload: WorkshopSummaryJobPayload = {
      workshopId,
      pdfBase64: pdfBuffer.toString('base64'),
    };
    const job = await this.summaryQueue.add(
      WORKSHOP_SUMMARY_JOB_NAME,
      payload,
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );

    return { status: 'pending', jobId: String(job.id) };
  }

  async runQueuedPdfSummary(
    workshopId: string,
    pdfBase64: string,
  ): Promise<WorkshopSummaryJobDone> {
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    if (!pdfBuffer.byteLength || !bufferLooksLikePdf(pdfBuffer)) {
      await this.workshopsRepo.applySummaryFromPdfText(
        workshopId,
        '',
        'failed',
      );
      throw new Error('PDF trong job không hợp lệ.');
    }

    let text: string;
    try {
      text = await extractPdfPlainText(pdfBuffer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log.warn(`extractPdfPlainText failed for ${workshopId}: ${msg}`);
      await this.workshopsRepo.applySummaryFromPdfText(
        workshopId,
        '',
        'failed',
      );
      throw err instanceof Error ? err : new Error(msg);
    }

    const trimmed = text.trim();
    if (!trimmed) {
      await this.workshopsRepo.applySummaryFromPdfText(
        workshopId,
        '',
        'failed',
      );
      throw new Error('Không trích xuất được văn bản từ PDF.');
    }

    const saved = await this.workshopsRepo.applySummaryFromPdfText(
      workshopId,
      trimmed,
      'ready',
    );
    if (!saved) {
      throw new Error('Workshop không tồn tại khi lưu giới thiệu.');
    }

    return { workshopId, outcome: 'ready' };
  }
}
