import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <h1 className="text-3xl font-bold text-slate-900">404</h1>
      <p className="mt-2 text-sm text-slate-600">Trang bạn tìm không tồn tại.</p>
      <Link
        to="/"
        className="mt-6 inline-flex rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        Về trang chủ
      </Link>
    </div>
  );
}
