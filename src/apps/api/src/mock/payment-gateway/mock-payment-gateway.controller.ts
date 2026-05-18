import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Logger,
  Param,
  Post,
  Body,
  InternalServerErrorException,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import {
  canonicalWebhookPayload,
  parseMockWebhookPayload,
  signMockWebhook,
  type MockWebhookPayload,
} from './mock-payment-signing';
import { MockPaymentSessionStore } from './mock-payment-session.store';

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const MOCK_SIGNATURE_HEADER = 'x-mock-payment-signature';

@Controller('mock/payment-gateway')
export class MockPaymentGatewayController {
  private readonly logger = new Logger(MockPaymentGatewayController.name);

  constructor(private readonly sessions: MockPaymentSessionStore) {}

  @Get('checkout/:sessionId')
  @Header('Content-Type', 'text/html; charset=utf-8')
  checkoutPage(@Param('sessionId') sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"/><title>Mock PG</title></head><body><p>Phiên checkout không hợp lệ hoặc đã hết hạn.</p></body></html>`;
    }

    const safeAmount = htmlEscape(String(session.amount));
    const returnHint = session.returnUrl
      ? `<p class="hint">Sau khi xử lý xong, trình duyệt sẽ chuyển về ứng dụng của bạn.</p>`
      : `<p class="hint">Để tự động quay về web app sau thanh toán, gửi <code>returnUrl</code> (đã khớp allowlist) trong body POST <code>/payments</code>.</p>`;

    return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8"/>
  <title>Mock Payment Gateway</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 28rem; margin: 3rem auto; padding: 0 1rem; }
    h1 { font-size: 1.125rem; }
    button { margin-right: .5rem; margin-top: .75rem; padding: .5rem 1rem; cursor: pointer; }
    .hint { color: #444; font-size: .875rem; margin-top: 1rem; }
    pre { background: #f4f4f5; padding: .75rem; overflow: auto; font-size: .75rem; }
  </style>
</head>
<body>
  <h1>Thanh toán thử (mock gateway)</h1>
  <p>Số tiền: <strong>${safeAmount}</strong></p>
  <p>Phiên: <code>${htmlEscape(sessionId)}</code></p>
  <form method="post" action="/mock/payment-gateway/checkout/${sessionId}/complete">
    <input type="hidden" name="outcome" value="success"/>
    <button type="submit">Thanh toán thành công</button>
  </form>
  <form method="post" action="/mock/payment-gateway/checkout/${sessionId}/complete">
    <input type="hidden" name="outcome" value="failure"/>
    <button type="submit">Thanh toán thất bại</button>
  </form>
  ${returnHint}
  <p class="hint">Sau khi bấm, mock gateway gửi webhook <code>POST /payments/webhooks/mock-gateway</code> tới API (như cổng thật).</p>
</body>
</html>`;
  }

  @Post('checkout/:sessionId/complete')
  async completeCheckout(
    @Param('sessionId') sessionId: string,
    @Body('outcome') outcome: string | undefined,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      res
        .type('html')
        .send(
          `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"/></head><body><p>Phiên không hợp lệ.</p></body></html>`,
        );
      return;
    }

    const returnTarget =
      typeof session.returnUrl === 'string' ? session.returnUrl.trim() : '';

    const secret = process.env.MOCK_PAYMENT_WEBHOOK_SECRET?.trim();
    const publicBase =
      process.env.PUBLIC_APP_URL?.trim() ||
      `http://localhost:${process.env.PORT ?? 3000}`;

    if (!secret) {
      throw new InternalServerErrorException(
        'MOCK_PAYMENT_WEBHOOK_SECRET is required for the mock payment gateway webhook.',
      );
    }

    const webhookUrl = `${publicBase.replace(/\/$/, '')}/payments/webhooks/mock-gateway`;

    let payload: MockWebhookPayload;
    if (outcome === 'failure') {
      payload = {
        event: 'payment.failed',
        paymentId: session.paymentId,
        failureReason: 'Người dùng hủy / từ chối (mock gateway).',
      };
    } else if (outcome === 'success') {
      payload = {
        event: 'payment.succeeded',
        paymentId: session.paymentId,
        providerTxnId: `mock_txn_${randomUUID().replace(/-/g, '').slice(0, 24)}`,
      };
    } else {
      throw new BadRequestException({
        code: 'invalid_outcome',
        message: 'Thiếu hoặc sai outcome (success | failure).',
      });
    }

    const signature = signMockWebhook(secret, payload);
    const bodyStr = canonicalWebhookPayload(payload);

    try {
      const webhookRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [MOCK_SIGNATURE_HEADER]: signature,
        },
        body: bodyStr,
      });

      const text = await webhookRes.text().catch(() => '');
      if (!webhookRes.ok) {
        this.logger.warn(
          `Webhook POST ${webhookUrl} → ${webhookRes.status} body=${text.slice(0, 500)}`,
        );
        res.type('html').send(
          `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"/></head><body>
          <p>Webhook trả lỗi HTTP <strong>${webhookRes.status}</strong>.</p>
          <pre>${htmlEscape(text.slice(0, 2000))}</pre>
          <p><a href="/mock/payment-gateway/checkout/${htmlEscape(sessionId)}">Quay lại</a></p>
        </body></html>`,
        );
        return;
      }
    } catch (err) {
      this.logger.error(`Webhook POST failed: ${String(err)}`);
      res.type('html').send(
        `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"/></head><body>
        <p>Không gọi được webhook: ${htmlEscape(String(err))}</p>
        <p>Kiểm tra PUBLIC_APP_URL / PORT và đường dẫn API.</p>
      </body></html>`,
      );
      return;
    }

    this.sessions.delete(sessionId);

    const paymentStatusQuery = outcome === 'failure' ? 'failed' : 'succeeded';

    if (returnTarget) {
      const sep = returnTarget.includes('?') ? '&' : '?';
      const dest = `${returnTarget}${sep}paymentStatus=${encodeURIComponent(paymentStatusQuery)}`;
      res.redirect(302, dest);
      return;
    }

    const label =
      payload.event === 'payment.succeeded'
        ? 'Thành công — webhook đã gửi.'
        : 'Đã gửi webhook thất bại — kiểm tra trạng thái payment trong API.';
    res.type('html')
      .send(`<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"/></head><body>
      <p>${htmlEscape(label)}</p>
      <pre>${htmlEscape(bodyStr)}</pre>
    </body></html>`);
  }

  /** JSON helper for scripts / manual testing (same webhook path as form flow). */
  @Post('simulate-webhook')
  async simulateWebhook(@Body() raw: unknown): Promise<{ ok: boolean }> {
    const parsed = parseMockWebhookPayload(raw);
    if (!parsed) {
      throw new BadRequestException({
        code: 'invalid_payload',
        message: 'Payload webhook không hợp lệ.',
      });
    }

    const secret = process.env.MOCK_PAYMENT_WEBHOOK_SECRET?.trim();
    const publicBase =
      process.env.PUBLIC_APP_URL?.trim() ||
      `http://localhost:${process.env.PORT ?? 3000}`;

    if (!secret) {
      throw new InternalServerErrorException(
        'MOCK_PAYMENT_WEBHOOK_SECRET is required.',
      );
    }

    const webhookUrl = `${publicBase.replace(/\/$/, '')}/payments/webhooks/mock-gateway`;
    const signature = signMockWebhook(secret, parsed);
    const bodyStr = canonicalWebhookPayload(parsed);

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [MOCK_SIGNATURE_HEADER]: signature,
      },
      body: bodyStr,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new BadRequestException({
        code: 'webhook_upstream_error',
        message: `Webhook HTTP ${res.status}: ${text.slice(0, 300)}`,
      });
    }

    return { ok: true };
  }
}
