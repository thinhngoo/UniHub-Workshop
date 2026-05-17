function vnd(n: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(n);
}

function pickString(
  payload: Record<string, unknown>,
  key: string,
): string | null {
  const v = payload[key];
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return null;
}

/** Build subject + body for app notification templates (matches enqueue payloads). */
export function buildNotificationEmailContent(input: {
  templateCode: string;
  payload: Record<string, unknown>;
  recipientName: string;
}): { subject: string; html: string; text: string } {
  const { templateCode, payload, recipientName } = input;
  const workshopTitle =
    pickString(payload, 'workshopTitle') ?? 'Workshop của bạn';

  if (templateCode === 'registration_success') {
    const subject = `[UniHub] Đăng ký thành công — ${workshopTitle}`;
    const text = `Xin chào ${recipientName},

Đăng ký workshop "${workshopTitle}" đã được ghi nhận. Bạn có thể xem chi tiết và mã QR (khi đã xác nhận) trên cổng UniHub Workshop.

Trân trọng,
UniHub Workshop`;
    const html = `<p>Xin chào <strong>${escapeHtml(recipientName)}</strong>,</p>
<p>Đăng ký workshop <strong>${escapeHtml(workshopTitle)}</strong> đã được ghi nhận. Bạn có thể xem chi tiết và mã QR (khi đã xác nhận) trên cổng UniHub Workshop.</p>
<p>Trân trọng,<br/>UniHub Workshop</p>`;
    return { subject, html, text };
  }

  if (templateCode === 'payment_success') {
    const amountRaw = payload.amount;
    const amountStr =
      typeof amountRaw === 'number'
        ? vnd(amountRaw)
        : typeof amountRaw === 'string' && amountRaw.trim() !== ''
          ? (() => {
              const n = Number(amountRaw);
              return Number.isFinite(n) ? vnd(n) : amountRaw;
            })()
          : null;
    const subject = `[UniHub] Thanh toán thành công — ${workshopTitle}`;
    const payLine = amountStr ? `Số tiền: ${amountStr}. ` : '';
    const text = `Xin chào ${recipientName},

Thanh toán cho workshop "${workshopTitle}" đã được xác nhận. ${payLine}Đăng ký của bạn đã được kích hoạt.

Trân trọng,
UniHub Workshop`;
    const html = `<p>Xin chào <strong>${escapeHtml(recipientName)}</strong>,</p>
<p>Thanh toán cho workshop <strong>${escapeHtml(workshopTitle)}</strong> đã được xác nhận. ${amountStr ? `Số tiền: <strong>${escapeHtml(amountStr)}</strong>. ` : ''}Đăng ký của bạn đã được kích hoạt.</p>
<p>Trân trọng,<br/>UniHub Workshop</p>`;
    return { subject, html, text };
  }

  const subject = `[UniHub Thông báo] ${templateCode}`;
  const text = `Xin chào ${recipientName},

Bạn có một thông báo (mã nội dung: ${templateCode}).

Trân trọng,
UniHub Workshop`;
  const html = `<p>Xin chào <strong>${escapeHtml(recipientName)}</strong>,</p>
<p>Bạn có một thông báo (mã: <code>${escapeHtml(templateCode)}</code>).</p>
<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(JSON.stringify(payload, null, 2))}</pre>
<p>Trân trọng,<br/>UniHub Workshop</p>`;
  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
