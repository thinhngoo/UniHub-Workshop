import type { StudentSyncIssue, StudentSyncReport } from '@unihub/types';
import { ApiError } from '@unihub/api-client';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { FileUp } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

async function runStudentSyncWithQueue(file: File): Promise<StudentSyncReport> {
  const { jobId } = await api.admin.syncStudents(file);
  const deadline = Date.now() + 300_000;
  while (Date.now() < deadline) {
    const status = await api.admin.syncStudentsJobStatus(jobId);
    if (status.state === 'completed') {
      if (!status.report) {
        throw new Error('Hoàn tất nhưng thiếu báo cáo từ máy chủ.');
      }
      return status.report;
    }
    if (status.state === 'failed') {
      throw new Error(status.failedReason ?? 'Đồng bộ thất bại.');
    }
    await new Promise((r) => setTimeout(r, 450));
  }
  throw new Error('Hết thời gian chờ (5 phút).');
}

export function StudentSyncPage() {
  const { user } = useAuth();
  const [csvFile, setCsvFile] = useState<File | null>(null);

  const mutation = useMutation({
    mutationFn: (file: File) => runStudentSyncWithQueue(file),
  });

  if (user?.role !== 'admin') {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Chỉ tài khoản quản trị viên mới có quyền đồng bộ danh sách sinh viên từ CSV.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Đồng bộ sinh viên</h1>
        <p className="text-sm text-slate-500">
          Tải lên tệp CSV từ máy của bạn để cập nhật tài khoản sinh viên vào cơ sở dữ liệu.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-900">Đồng bộ từ CSV</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-500">
                <li>Dòng trùng id trong file CSV: giữ bản ghi xuất hiện sau cùng.</li>
                <li>
                  Dòng trùng email hoặc mã sinh viên trong file CSV: giữ bản ghi xuất hiện đầu tiên.
                </li>
                <li>
                  Trước khi ghi dữ liệu vào hệ thống, kiểm tra trùng lặp với dữ liệu đã tồn tại trên
                  máy chủ.
                </li>
              </ul>
            </div>
            <div className="flex flex-col items-stretch gap-5 sm:items-start">
              <label className="flex cursor-pointer flex-col gap-1 text-sm text-slate-700">
                <span className="font-medium text-slate-900">Tệp CSV</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="max-w-[240px] cursor-pointer text-xs file:mr-2 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-50"
                  onChange={(e) => {
                    mutation.reset();
                    setCsvFile(e.target.files?.[0] ?? null);
                  }}
                />
              </label>
              <Button
                className="cursor-pointer gap-2"
                onClick={() => csvFile && mutation.mutate(csvFile)}
                disabled={mutation.isPending || !csvFile}
                size="lg"
              >
                <FileUp className="size-4" />
                {mutation.isPending ? 'Đang xử lý…' : 'Đồng bộ'}
              </Button>
            </div>
          </div>

          {mutation.isError && (
            <p className="text-sm text-red-600">
              {mutation.error instanceof ApiError
                ? mutation.error.message
                : mutation.error instanceof Error
                  ? mutation.error.message
                  : 'Không thể đồng bộ. Kiểm tra tệp CSV hoặc nhật ký máy chủ rồi thử lại.'}
            </p>
          )}

          {mutation.isSuccess && (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-4 text-slate-700">
                <p>
                  <span className="font-medium text-emerald-800">Đã ghi:</span>{' '}
                  {mutation.data.imported.toLocaleString('vi-VN')}
                </p>
                <p>
                  <span className="font-medium text-slate-800">Dòng bỏ qua (ước lượng):</span>{' '}
                  {mutation.data.skippedRows.toLocaleString('vi-VN')}
                </p>
                {mutation.data.duplicateIdsSuperseded > 0 && (
                  <p>
                    <span className="font-medium text-slate-800">Dòng trùng:</span>{' '}
                    {mutation.data.duplicateIdsSuperseded.toLocaleString('vi-VN')}
                  </p>
                )}
              </div>

              {mutation.data.issues.length > 0 && (
                <div className="space-y-2">
                  <p className="font-medium text-slate-900">
                    Chi tiết ({mutation.data.issues.length})
                  </p>
                  <ScrollArea className="max-h-56 rounded-md border border-slate-200">
                    <ul className="divide-y divide-slate-100 p-2 text-xs">
                      {mutation.data.issues.map((issue: StudentSyncIssue, idx: number) => (
                        <li key={`${issue.code}-${idx}`} className="py-2 text-slate-700">
                          {issue.line != null && (
                            <span className="mr-2 font-mono text-slate-500">D.{issue.line}</span>
                          )}
                          <span className="font-mono text-slate-600">{issue.code}</span>
                          <span className="mx-1.5 text-slate-300">·</span>
                          {issue.message}
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
