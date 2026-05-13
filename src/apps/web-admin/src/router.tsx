import { createBrowserRouter } from 'react-router-dom';
import { AdminLayout } from '@/components/AdminLayout';
import { RequireAdmin } from '@/components/RequireAdmin';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { WorkshopsPage } from '@/pages/WorkshopsPage';
import { WorkshopFormPage } from '@/pages/WorkshopFormPage';
import { RegistrationsPage } from '@/pages/RegistrationsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAdmin>
        <AdminLayout />
      </RequireAdmin>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'workshops', element: <WorkshopsPage /> },
      { path: 'workshops/new', element: <WorkshopFormPage mode="create" /> },
      { path: 'workshops/:id/edit', element: <WorkshopFormPage mode="edit" /> },
      { path: 'registrations', element: <RegistrationsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
