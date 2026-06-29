import { lazy, Suspense, ReactNode, useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../shared/stores/auth.store';
import { usePlatformAuthStore } from '../features/platform/stores/platform-auth.store';
import { AppLayout } from '../shared/components/layout/AppLayout';
import { PlatformLayout } from '../features/platform/components/PlatformLayout';
import { ComingSoon } from '../shared/components/ComingSoon';

// ===== Tenant Pages =====
const LoginPage = lazy(() => import('../features/auth/pages/LoginPage'));
const SetupPage = lazy(() => import('../features/setup/SetupPage'));
const DashboardPage = lazy(() => import('../features/dashboard/DashboardPage'));
const UsersPage = lazy(() => import('../features/users/pages/UsersPage'));
const TeachersPage = lazy(() => import('../features/teachers/pages/TeachersPage'));
const StudentsPage = lazy(() => import('../features/students/pages/StudentsPage'));
const StudentProfilePage = lazy(() => import('../features/students/pages/StudentProfilePage'));
const GroupsPage = lazy(() => import('../features/groups/pages/GroupsPage'));
const BarcodesPage = lazy(() => import('../features/barcodes/BarcodesPage'));
const SessionsPage = lazy(() => import('../features/sessions/pages/SessionsPage'));
const MorePage = lazy(() => import('../features/more/MorePage'));
const WhatsAppPage = lazy(() => import('../features/whatsapp/pages/WhatsAppPage'));
const SettingsPage = lazy(() => import('../features/settings/pages/SettingsPage'));
const FinancePage = lazy(() => import('../features/finance/pages/FinancePage'));
const FinanceDuesPage = lazy(() => import('../features/finance/pages/DuesPage'));
const FinancePaymentsPage = lazy(() => import('../features/finance/pages/PaymentsPage'));
const FinanceExpensesPage = lazy(() => import('../features/finance/pages/ExpensesPage'));
const FinanceTreasuriesPage = lazy(() => import('../features/finance/pages/TreasuriesPage'));
const FinanceCollectPage = lazy(() => import('../features/finance/pages/CollectPage'));
const NotFoundPage = lazy(() => import('./not-found'));

// ===== Platform Pages =====
const PlatformLoginPage = lazy(() => import('../features/platform/PlatformLoginPage'));
const PlatformDashboardPage = lazy(() => import('../features/platform/pages/PlatformDashboardPage'));
const TenantsPage = lazy(() => import('../features/platform/pages/TenantsPage'));
const PlansPage = lazy(() => import('../features/platform/pages/PlansPage'));

// ===== Loading =====
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#F7F7F7]">
    <div className="flex flex-col items-center gap-3">
      <img src="/Logo.png" alt="نبغة" className="w-16 h-16 object-contain animate-pulse" />
      <p className="text-gray-400 text-sm">جاري التحميل...</p>
    </div>
  </div>
);

const page = (node: ReactNode) => <Suspense fallback={<LoadingFallback />}>{node}</Suspense>;

// ===== Tenant Guard =====
// يتحقق من الـ tenant auth ويمسح الـ platform session عشان مفيش تعارض
function ProtectedRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const clearPlatformAuth = usePlatformAuthStore((s) => s.clearAuth);

  useEffect(() => {
    // لو دخلنا على tenant route — امسح أي platform session موجود في الـ store
    clearPlatformAuth();
  }, []);

  if (!isAuthenticated) return <Navigate to="/auth/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

// ===== Platform Guard =====
// يتحقق من الـ platform auth ويمسح الـ tenant session عشان مفيش تعارض
function PlatformRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, initAuth } = usePlatformAuthStore();
  const clearTenantAuth = useAuthStore((s) => s.clearAuth);

  useEffect(() => {
    initAuth();
    // لو دخلنا على platform route — امسح أي tenant session موجود في الـ store
    clearTenantAuth();
  }, []);

  if (!isAuthenticated) return <Navigate to="/platform/login" replace />;
  return <PlatformLayout>{children}</PlatformLayout>;
}

const protectedPage = (node: ReactNode) => (
  <ProtectedRoute>{page(node)}</ProtectedRoute>
);

const platformPage = (node: ReactNode) => (
  <PlatformRoute>{page(node)}</PlatformRoute>
);

const router = createBrowserRouter([
  // ===== Public =====
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  { path: '/auth/login', element: page(<LoginPage />) },
  { path: '/setup', element: page(<SetupPage />) },

  // ===== Tenant Protected =====
  { path: '/dashboard', element: protectedPage(<DashboardPage />) },
  { path: '/users', element: protectedPage(<UsersPage />) },
  { path: '/teachers', element: protectedPage(<TeachersPage />) },
  { path: '/students', element: protectedPage(<StudentsPage />) },
  { path: '/students/:id', element: protectedPage(<StudentProfilePage />) },
  { path: '/groups', element: protectedPage(<GroupsPage />) },
  { path: '/sessions', element: protectedPage(<SessionsPage />) },
  { path: '/more', element: protectedPage(<MorePage />) },
  { path: '/attendance', element: protectedPage(<ComingSoon title="الحضور" />) },
  { path: '/finance', element: protectedPage(<FinancePage />) },
  { path: '/finance/dues', element: protectedPage(<FinanceDuesPage />) },
  { path: '/finance/payments', element: protectedPage(<FinancePaymentsPage />) },
  { path: '/finance/expenses', element: protectedPage(<FinanceExpensesPage />) },
  { path: '/finance/treasuries', element: protectedPage(<FinanceTreasuriesPage />) },
  { path: '/finance/collect', element: protectedPage(<FinanceCollectPage />) },
  { path: '/barcodes', element: protectedPage(<BarcodesPage />) },
  { path: '/reports', element: protectedPage(<ComingSoon title="التقارير" />) },
  { path: '/settings', element: protectedPage(<SettingsPage />) },
  { path: '/whatsapp', element: protectedPage(<WhatsAppPage />) },

  // ===== Platform =====
  { path: '/platform/login', element: page(<PlatformLoginPage />) },
  { path: '/platform/dashboard', element: platformPage(<PlatformDashboardPage />) },
  { path: '/platform/tenants', element: platformPage(<TenantsPage />) },
  { path: '/platform/plans', element: platformPage(<PlansPage />) },

  // ===== 404 =====
  { path: '*', element: page(<NotFoundPage />) },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
