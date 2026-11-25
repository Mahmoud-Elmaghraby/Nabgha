import { BrandMark } from '@/shared/components/brand/BrandLogo';
import { lazy, Suspense, ReactNode, useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Navigate, useLocation, useParams } from 'react-router-dom';
import { useAuthStore } from '../shared/stores/auth.store';
import { usePlatformAuthStore } from '../features/platform/stores/platform-auth.store';
import { useParentAuthStore } from '../features/parent-portal/stores/parent-auth.store';
import { AppLayout } from '../shared/components/layout/AppLayout';
import { PlatformLayout } from '../features/platform/components/PlatformLayout';
import { ParentPortalLayout } from '../features/parent-portal/components/ParentPortalLayout';
import { ComingSoon } from '../shared/components/ComingSoon';

// ===== Tenant Pages =====
const LoginPage = lazy(() => import('../features/auth/pages/LoginPage'));
const LandingPage = lazy(() => import('../features/landing/LandingPage'));
const SetupPage = lazy(() => import('../features/setup/SetupPage'));
const DashboardPage = lazy(() => import('../features/dashboard/DashboardPage'));
const UsersPage = lazy(() => import('../features/users/pages/UsersPage'));
const TeachersPage = lazy(() => import('../features/teachers/pages/TeachersPage'));
const StudentsPage = lazy(() => import('../features/students/pages/StudentsPage'));
const StudentProfilePage = lazy(() => import('../features/students/pages/StudentProfilePage'));
const GroupsPage = lazy(() => import('../features/groups/pages/GroupsPage'));
const BarcodesPage = lazy(() => import('../features/barcodes/BarcodesPage'));
const SpinnerPage = lazy(() => import('../features/spinner/pages/SpinnerPage'));
const SessionsPage = lazy(() => import('../features/sessions/pages/SessionsPage'));
const ExamsPage = lazy(() => import('../features/exams/pages/ExamsPage'));
const MorePage = lazy(() => import('../features/more/MorePage'));
const InboxPage = lazy(() => import('../features/inbox/pages/InboxPage'));
const WhatsAppPage = lazy(() => import('../features/whatsapp/pages/WhatsAppPage'));
const TelegramPage = lazy(() => import('../features/settings/pages/TelegramPage'));
const SettingsPage = lazy(() => import('../features/settings/pages/SettingsPage'));
const FinancePage = lazy(() => import('../features/finance/pages/FinancePage'));
const FinanceDuesPage = lazy(() => import('../features/finance/pages/DuesPage'));
const FinancePaymentsPage = lazy(() => import('../features/finance/pages/PaymentsPage'));
const FinanceExpensesPage = lazy(() => import('../features/finance/pages/ExpensesPage'));
const FinanceTreasuriesPage = lazy(() => import('../features/finance/pages/TreasuriesPage'));
const FinanceTreasuryDetailPage = lazy(() => import('../features/finance/pages/TreasuryDetailPage'));
const FinanceCollectPage = lazy(() => import('../features/finance/pages/CollectPage'));
const StudentsListReportPage = lazy(() => import('../features/reports/pages/StudentsListReportPage'));
const StudentStatementReportPage = lazy(() => import('../features/reports/pages/StudentStatementReportPage'));
const AbsenceReportPage = lazy(() => import('../features/reports/pages/AbsenceReportPage'));
const StudentAttendanceReportPage = lazy(() => import('../features/reports/pages/StudentAttendanceReportPage'));
const StudentGradesReportPage = lazy(() => import('../features/reports/pages/StudentGradesReportPage'));
const MonthlyReportsPage = lazy(() => import('../features/reports/pages/MonthlyReportsPage'));
const GroupAttendanceReportPage = lazy(() => import('../features/reports/pages/GroupAttendanceReportPage'));
const SessionsListReportPage = lazy(() => import('../features/reports/pages/SessionsListReportPage'));
const OverdueDuesReportPage = lazy(() => import('../features/reports/pages/OverdueDuesReportPage'));
const MonthlyCollectionsReportPage = lazy(() => import('../features/reports/pages/MonthlyCollectionsReportPage'));
const MonthlyDuesStatusReportPage = lazy(() => import('../features/reports/pages/MonthlyDuesStatusReportPage'));
const GroupGradesReportPage = lazy(() => import('../features/reports/pages/GroupGradesReportPage'));
const ExamResultReportPage = lazy(() => import('../features/reports/pages/ExamResultReportPage'));
const HonorBoardReportPage = lazy(() => import('../features/reports/pages/HonorBoardReportPage'));

import { ReportsLayout } from '../features/reports/components/ReportsLayout';
import { StudentsReportsLayout } from '../features/reports/components/StudentsReportsLayout';
import { FinanceReportsLayout } from '../features/reports/components/FinanceReportsLayout';
import { SessionsReportsLayout } from '../features/reports/components/SessionsReportsLayout';
import { ExamsReportsLayout } from '../features/reports/components/ExamsReportsLayout';
const NotFoundPage = lazy(() => import('./not-found'));

// ===== Platform Pages =====
const PlatformLoginPage = lazy(() => import('../features/platform/PlatformLoginPage'));
const PlatformDashboardPage = lazy(() => import('../features/platform/pages/PlatformDashboardPage'));
const TenantsPage = lazy(() => import('../features/platform/pages/TenantsPage'));
const PlansPage = lazy(() => import('../features/platform/pages/PlansPage'));

// ===== Parent Portal Pages =====
// بوابة أولياء الأمور — نظام مصادقة منفصل تمامًا (OTP واتساب) عن الموظفين،
// ومحجوبة بالكامل في وضع Desktop عن طريق ParentPortalAvailabilityGuard في الباك إند.
const ParentLoginPage = lazy(() => import('../features/parent-portal/pages/ParentLoginPage'));
const ParentDashboardPage = lazy(() => import('../features/parent-portal/pages/ParentDashboardPage'));
const ParentStudentDetailPage = lazy(() => import('../features/parent-portal/pages/ParentStudentDetailPage'));

// ===== Loading =====
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#F7F7F7]">
    <div className="flex flex-col items-center gap-3">
      <BrandMark size="xl" className="animate-pulse" />
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

// ===== Parent Portal Guard =====
// بيتحقق من الـ slug في الرابط نفسه (كل رابط بوابة أهالي محدد بمركز واحد)
// عشان لو ولي أمر مسجل دخول لمركز وحاول يفتح رابط مركز تاني، نرجّعه لصفحة الدخول بتاعت المركز الصح.
function ParentRoute({ children }: { children: ReactNode }) {
  const { slug: urlSlug = '' } = useParams<{ slug: string }>();
  const { isAuthenticated, slug: authSlug, initAuth } = useParentAuthStore();

  useEffect(() => {
    initAuth();
  }, []);

  if (!isAuthenticated || authSlug !== urlSlug) {
    return <Navigate to={`/parent/${urlSlug}/login`} replace />;
  }
  return <ParentPortalLayout>{children}</ParentPortalLayout>;
}

const parentPage = (node: ReactNode) => (
  <ParentRoute>{page(node)}</ParentRoute>
);

// ===== الصفحة الرئيسية "/" =====
// - مستخدم مسجّل دخوله ← الداشبورد.
// - جهاز محلي (localhost / شبكة المركز الداخلية: نسخة Desktop أو LAN) ← شاشة الدخول مباشرة زي الأول.
// - زائر على دومين عام (النسخة الأونلاين) ← صفحة الهبوط التسويقية.
function isPrivateHost(host: string): boolean {
  return (
    host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local') ||
    /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

function RootGate() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  if (isPrivateHost(window.location.hostname)) return <Navigate to="/auth/login" replace />;
  return page(<LandingPage />);
}

const router = createBrowserRouter([
  // ===== Public =====
  { path: '/', element: <RootGate /> },
  { path: '/landing', element: page(<LandingPage />) },
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
  { path: '/exams', element: protectedPage(<ExamsPage />) },
  { path: '/more', element: protectedPage(<MorePage />) },
  { path: '/inbox', element: protectedPage(<InboxPage />) },
  { path: '/inbox/:phone', element: protectedPage(<InboxPage />) },
  { path: '/attendance', element: protectedPage(<ComingSoon title="الحضور" />) },
  { path: '/finance', element: protectedPage(<FinancePage />) },
  { path: '/finance/dues', element: protectedPage(<FinanceDuesPage />) },
  { path: '/finance/payments', element: protectedPage(<FinancePaymentsPage />) },
  { path: '/finance/expenses', element: protectedPage(<FinanceExpensesPage />) },
  { path: '/finance/treasuries', element: protectedPage(<FinanceTreasuriesPage />) },
  { path: '/finance/treasuries/:id', element: protectedPage(<FinanceTreasuryDetailPage />) },
  { path: '/finance/collect', element: protectedPage(<FinanceCollectPage />) },
  { path: '/barcodes', element: protectedPage(<BarcodesPage />) },
  { path: '/spinner', element: protectedPage(<SpinnerPage />) },
  {
    path: '/reports',
    element: protectedPage(<ReportsLayout />),
    children: [
      { index: true, element: <Navigate to="/reports/students/list" replace /> },
      {
        path: 'students',
        element: <StudentsReportsLayout />,
        children: [
          { index: true, element: <Navigate to="/reports/students/list" replace /> },
          { path: 'list', element: page(<StudentsListReportPage />) },
          { path: 'statement', element: page(<StudentStatementReportPage />) },
          { path: 'absence', element: page(<AbsenceReportPage />) },
          { path: 'attendance', element: page(<StudentAttendanceReportPage />) },
          { path: 'grades', element: page(<StudentGradesReportPage />) },
          { path: 'monthly', element: page(<MonthlyReportsPage />) },
        ],
      },
      {
        path: 'finance',
        element: <FinanceReportsLayout />,
        children: [
          { index: true, element: <Navigate to="/reports/finance/collections" replace /> },
          { path: 'collections', element: page(<MonthlyCollectionsReportPage />) },
          { path: 'overdue', element: page(<OverdueDuesReportPage />) },
          { path: 'monthly-status', element: page(<MonthlyDuesStatusReportPage />) },
        ],
      },
      {
        path: 'exams',
        element: <ExamsReportsLayout />,
        children: [
          { index: true, element: <Navigate to="/reports/exams/group-grades" replace /> },
          { path: 'group-grades', element: page(<GroupGradesReportPage />) },
          { path: 'exam-result', element: page(<ExamResultReportPage />) },
          { path: 'honor-board', element: page(<HonorBoardReportPage />) },
        ],
      },
      {
        path: 'sessions',
        element: <SessionsReportsLayout />,
        children: [
          { index: true, element: <Navigate to="/reports/sessions/list" replace /> },
          { path: 'list', element: page(<SessionsListReportPage />) },
          { path: 'group-attendance', element: page(<GroupAttendanceReportPage />) },
        ],
      },
    ],
  },
  { path: '/settings', element: protectedPage(<SettingsPage />) },
  { path: '/whatsapp', element: protectedPage(<WhatsAppPage />) },
  { path: '/telegram', element: protectedPage(<TelegramPage />) },

  // ===== Platform =====
  { path: '/platform/login', element: page(<PlatformLoginPage />) },
  { path: '/platform/dashboard', element: platformPage(<PlatformDashboardPage />) },
  { path: '/platform/tenants', element: platformPage(<TenantsPage />) },
  { path: '/platform/plans', element: platformPage(<PlansPage />) },

  // ===== Parent Portal =====
  { path: '/parent/:slug/login', element: page(<ParentLoginPage />) },
  { path: '/parent/:slug/dashboard', element: parentPage(<ParentDashboardPage />) },
  { path: '/parent/:slug/students/:studentId', element: parentPage(<ParentStudentDetailPage />) },

  // ===== 404 =====
  { path: '*', element: page(<NotFoundPage />) },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
