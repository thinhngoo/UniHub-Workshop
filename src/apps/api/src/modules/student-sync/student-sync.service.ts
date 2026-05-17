import { Injectable } from '@nestjs/common';
import type { StudentSyncReport } from '@unihub/types';
import { join } from 'node:path';
import { UsersRepository } from '../database/repository/users.repository';
import { parseStudentsCsv } from './parse-students-csv';

const DEFAULT_RELATIVE_CSV = join('_mocks', 'students.csv');

@Injectable()
export class StudentSyncService {
  constructor(private readonly users: UsersRepository) {}

  resolveDefaultCsvPath(): string {
    return join(__dirname, '..', '..', DEFAULT_RELATIVE_CSV);
  }

  async syncFromCsvText(raw: string): Promise<StudentSyncReport> {
    const parsed = parseStudentsCsv(raw);
    const { imported, issues: dbIssues } =
      await this.users.upsertSyncedStudentsReport(parsed.rows);

    const fileIssues = parsed.issues.map((i) => ({
      line: i.line,
      code: i.code,
      message: i.message,
    }));

    const issues = [...fileIssues, ...dbIssues];
    const skippedRows = Math.max(0, parsed.sourceDataRowCount - imported);

    return {
      imported,
      skippedRows,
      duplicateIdsSuperseded: parsed.duplicateIdsSuperseded,
      issues,
    };
  }
}
