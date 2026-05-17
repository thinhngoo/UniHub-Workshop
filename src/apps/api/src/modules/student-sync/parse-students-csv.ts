import type { UserStatus } from '@unihub/types';
import type { SyncedStudentUser } from '../database/repository/users.repository';

type CsvRow = Record<string, string>;

export interface StudentSyncParseOutcome {
  rows: SyncedStudentUser[];
  sourceDataRowCount: number; // Header excluded
  duplicateIdsSuperseded: number;
  issues: StudentSyncParseIssue[];
}

export interface StudentSyncParseIssue {
  line: number;
  code: string;
  message: string;
}

const REQUIRED_HEADERS = [
  'id',
  'student_code',
  'email',
  'password',
  'full_name',
  'status',
  'created_at',
  'updated_at',
] as const;

function stripBom(content: string): string {
  return content.replace(/^\uFEFF/, '');
}

function splitCsvLine(line: string): string[] {
  return line.split(',').map((cell) => cell.trim());
}

function normalizeHeader(key: string): string {
  return key.replace(/^\uFEFF/, '').trim();
}

function parseNumberedLines(content: string): { line: number; text: string }[] {
  const rawLines = content.split(/\r?\n/);
  const out: { line: number; text: string }[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const text = rawLines[i].trimEnd();
    if (text.length > 0) {
      out.push({ line: i + 1, text });
    }
  }
  return out;
}

function parseCsvRecords(
  content: string,
  issues: StudentSyncParseIssue[],
): { line: number; row: CsvRow }[] | null {
  const lines = parseNumberedLines(content);
  if (lines.length < 2) {
    issues.push({
      line: lines[0]?.line ?? 1,
      code: 'file_empty',
      message:
        lines.length === 0
          ? 'Tệp không có dòng dữ liệu.'
          : 'Tệp chỉ có dòng tiêu đề, thiếu bản ghi.',
    });
    return null;
  }

  const headers = splitCsvLine(lines[0].text).map(normalizeHeader);
  for (const h of REQUIRED_HEADERS) {
    if (!headers.includes(h)) {
      issues.push({
        line: lines[0].line,
        code: 'header_missing',
        message: `Thiếu cột bắt buộc "${h}" trong tiêu đề.`,
      });
      return null;
    }
  }

  return lines.slice(1).map(({ line, text }) => {
    const values = splitCsvLine(text);
    const row: CsvRow = {};
    headers.forEach((key, i) => {
      row[key] = (values[i] ?? '').trim();
    });
    return { line, row };
  });
}

function parseCsvTimestamp(value: string): Date | null {
  let s = value.trim();
  if (!s) return null;
  if (!s.includes('T')) s = s.replace(' ', 'T');
  if (/[+-]\d{2}$/.test(s)) {
    s = s.replace(/([+-]\d{2})$/, '$1:00');
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function parseUserStatus(raw: string): UserStatus | null {
  const v = raw.trim().toLowerCase();
  if (v === 'active' || v === 'disabled') return v;
  return null;
}

function tryParseRow(
  r: CsvRow,
):
  | { ok: true; user: SyncedStudentUser }
  | { ok: false; code: string; message: string } {
  const id = r.id?.trim();
  if (!id) {
    return { ok: false, code: 'missing_id', message: 'Thiếu id.' };
  }
  const email = r.email?.trim();
  if (!email) {
    return {
      ok: false,
      code: 'missing_email',
      message: `Thiếu email (id ${id}).`,
    };
  }
  const password = r.password?.trim();
  if (!password) {
    return {
      ok: false,
      code: 'missing_password',
      message: `Thiếu password (id ${id}).`,
    };
  }
  const fullName = r.full_name?.trim();
  if (!fullName) {
    return {
      ok: false,
      code: 'missing_full_name',
      message: `Thiếu full_name (id ${id}).`,
    };
  }

  const status = parseUserStatus(r.status ?? '');
  if (!status) {
    return {
      ok: false,
      code: 'invalid_status',
      message: `Trạng thái phải là active hoặc disabled (dòng id ${id}).`,
    };
  }

  const createdAt = parseCsvTimestamp(r.created_at ?? '');
  if (!createdAt) {
    return {
      ok: false,
      code: 'invalid_time',
      message: `created_at không hợp lệ: ${r.created_at}`,
    };
  }
  const updatedAt = parseCsvTimestamp(r.updated_at ?? '');
  if (!updatedAt) {
    return {
      ok: false,
      code: 'invalid_time',
      message: `updated_at không hợp lệ: ${r.updated_at}`,
    };
  }

  const studentCode = (r.student_code ?? '').trim();

  return {
    ok: true,
    user: {
      id,
      studentCode: studentCode.length > 0 ? studentCode : null,
      email,
      password,
      fullName,
      role: 'student',
      status,
      createdAt,
      updatedAt,
    },
  };
}

export function parseStudentsCsv(content: string): StudentSyncParseOutcome {
  const issues: StudentSyncParseIssue[] = [];
  const stripped = stripBom(content);
  const records = parseCsvRecords(stripped, issues);
  if (records === null) {
    return {
      rows: [],
      sourceDataRowCount: 0,
      duplicateIdsSuperseded: 0,
      issues,
    };
  }

  const sourceDataRowCount = records.length;

  const parsedOk: { line: number; user: SyncedStudentUser }[] = [];

  for (const { line, row } of records) {
    const result = tryParseRow(row);
    if (!result.ok) {
      issues.push({ line, code: result.code, message: result.message });
      continue;
    }
    parsedOk.push({ line, user: result.user });
  }

  const idToLast = new Map<string, { line: number; user: SyncedStudentUser }>();
  const idSupersededLines: number[] = [];
  for (const item of parsedOk) {
    const prev = idToLast.get(item.user.id);
    if (prev) {
      idSupersededLines.push(prev.line);
    }
    idToLast.set(item.user.id, item);
  }

  for (const line of idSupersededLines) {
    issues.push({
      line,
      code: 'duplicate_id',
      message:
        'Trùng id với dòng sau trong file — giữ bản ghi sau (last wins).',
    });
  }

  const duplicateIdsSuperseded = idSupersededLines.length;

  const afterId = [...idToLast.values()].sort((a, b) => a.line - b.line);

  const seenEmail = new Set<string>();
  const seenCode = new Set<string>();
  const rows: SyncedStudentUser[] = [];

  for (const { line, user } of afterId) {
    const emailKey = user.email.toLowerCase();
    if (seenEmail.has(emailKey)) {
      issues.push({
        line,
        code: 'duplicate_email',
        message: `Email "${user.email}" đã dùng cho bản ghi trước đó trong file — bỏ qua.`,
      });
      continue;
    }
    if (user.studentCode) {
      const codeKey = user.studentCode;
      if (seenCode.has(codeKey)) {
        issues.push({
          line,
          code: 'duplicate_student_code',
          message: `Mã sinh viên "${codeKey}" đã dùng cho bản ghi trước đó trong file — bỏ qua.`,
        });
        continue;
      }
      seenCode.add(codeKey);
    }
    seenEmail.add(emailKey);
    rows.push(user);
  }

  return {
    rows,
    sourceDataRowCount,
    duplicateIdsSuperseded,
    issues,
  };
}
