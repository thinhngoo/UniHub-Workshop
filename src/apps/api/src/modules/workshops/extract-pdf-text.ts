import pdfParse from 'pdf-parse';

export function bufferLooksLikePdf(buf: Buffer): boolean {
  if (buf.length < 5) return false;
  return buf.subarray(0, 5).toString('latin1') === '%PDF-';
}

export async function extractPdfPlainText(pdfBuffer: Buffer): Promise<string> {
  const result = await pdfParse(pdfBuffer);
  return result.text.trim();
}
