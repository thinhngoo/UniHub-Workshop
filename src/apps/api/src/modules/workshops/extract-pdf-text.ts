import { readFile } from 'node:fs/promises';
import pdfParse from 'pdf-parse';

export async function extractPdfPlainText(pdfPath: string): Promise<string> {
  const buf = await readFile(pdfPath);
  const result = await pdfParse(buf);
  return result.text.trim();
}
