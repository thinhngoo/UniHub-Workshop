import { createBrowserRouter } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { RequireAuth } from '@/components/RequireAuth';
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';
import { WorkshopListPage } from '@/pages/WorkshopListPage';
import { WorkshopDetailPage } from '@/pages/WorkshopDetailPage';
import { MyRegistrationsPage } from '@/pages/MyRegistrationsPage';
import { RegistrationPaymentPage } from '@/pages/RegistrationPaymentPage';
import { QrPage } from '@/pages/QrPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { MePage } from '@/pages/MePage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'workshops', element: <WorkshopListPage /> },
      { path: 'workshops/:id', element: <WorkshopDetailPage /> },
      { path: 'login', element: <LoginPage /> },
      {
        path: 'me',
        element: (
          <RequireAuth>
            <MePage />
          </RequireAuth>
        ),
      },
      {
        path: 'me/registrations',
        element: (
          <RequireAuth>
            <MyRegistrationsPage />
          </RequireAuth>
        ),
      },
      {
        path: 'me/notifications',
        element: (
          <RequireAuth>
            <NotificationsPage />
          </RequireAuth>
        ),
      },
      {
        path: 'me/registrations/:id/payment',
        element: (
          <RequireAuth>
            <RegistrationPaymentPage />
          </RequireAuth>
        ),
      },
      {
        path: 'me/registrations/:id/qr',
        element: (
          <RequireAuth>
            <QrPage />
          </RequireAuth>
        ),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
