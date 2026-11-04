import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router';
import { Toaster } from './components/ui/sonner';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { MobileNavProvider } from './contexts/MobileNavContext';
import { PopupProvider } from './contexts/PopupContext';
import MobileNavSheet from './components/shared/MobileNavSheet';
// Module-level side effect: subscribes to the inventory store and emits Low
// Stock / Out of Stock alerts to the Notifications system on any inventory
// change (Stock In/Out, order deductions, item edits).
import './utils/inventoryAlerts';
// Auto-cancels awaited-payment orders whose payment deadline has passed.
import './utils/paymentExpiry';
// Seeds the single-row settings tables + pricing matrix cells (best-effort).
import '../lib/db/bootstrap';

const LandingPage = lazy(() => import('./components/LandingPage'));
const LoginPage = lazy(() => import('./components/LoginPage'));
const SignUpPage = lazy(() => import('./components/SignUpPage'));
const AuthCallbackPage = lazy(() => import('./components/AuthCallbackPage'));
const ForgotPassword = lazy(() => import('./components/ForgotPassword'));
const ResetPasswordPage = lazy(() => import('./components/ResetPasswordPage'));
const CustomerDashboard = lazy(() => import('./components/customer/CustomerDashboard'));
const CustomerProfile = lazy(() => import('./components/customer/CustomerProfile'));
const NewPrintRequest = lazy(() => import('./components/customer/NewPrintRequest'));
const CustomerOrders = lazy(() => import('./components/customer/CustomerOrders'));
const CustomerPaymentVerification = lazy(() => import('./components/customer/PaymentVerification'));
const DownPaymentMethod = lazy(() => import('./components/customer/DownPaymentMethod'));
const StaffOrdersUnified = lazy(() => import('./components/staff/StaffOrdersUnified'));
const StaffPickupMonitoring = lazy(() => import('./components/staff/StaffPickupMonitoring'));
const StaffUnclaimedOrders = lazy(() => import('./components/staff/StaffUnclaimedOrders'));
const StaffUnclaimedOrderHistory = lazy(() => import('./components/staff/StaffUnclaimedOrderHistory'));
const StaffUnclaimedRestrictions = lazy(() => import('./components/staff/StaffUnclaimedRestrictions'));
const WalkInTransactions = lazy(() => import('./components/staff/WalkInTransactions'));
const StaffDashboard = lazy(() => import('./components/staff/StaffDashboard'));
const StaffProfile = lazy(() => import('./components/staff/StaffProfile'));
const StaffTimesheet = lazy(() => import('./components/staff/StaffTimesheet'));
const StaffPaymentVerificationUnified = lazy(() => import('./components/staff/StaffPaymentVerificationUnified'));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));
const AdminProfile = lazy(() => import('./components/admin/AdminProfile'));
const AdminPaymentVerificationUnified = lazy(() => import('./components/admin/AdminPaymentVerificationUnified'));
const AdminOrdersUnified = lazy(() => import('./components/admin/AdminOrdersUnified'));
const AdminPickupMonitoring = lazy(() => import('./components/admin/AdminPickupMonitoring'));
const AdminUnclaimedOrders = lazy(() => import('./components/admin/AdminUnclaimedOrders'));
const AdminUnclaimedOrderHistory = lazy(() => import('./components/admin/AdminUnclaimedOrderHistory'));
const AdminUnclaimedRestrictions = lazy(() => import('./components/admin/AdminUnclaimedRestrictions'));
const Staff = lazy(() => import('./components/admin/Staff'));
const InventoryManagement = lazy(() => import('./components/admin/InventoryManagement'));
const PaymentMethodsManagement = lazy(() => import('./components/admin/PaymentMethodsManagement'));
const PricingManagement = lazy(() => import('./components/admin/PricingManagement'));
const LandingPageEditor = lazy(() => import('./components/admin/LandingPageEditor'));
const LegalManagement = lazy(() => import('./components/admin/LegalManagement'));
const AuditLogManagement = lazy(() => import('./components/admin/AuditLogManagement'));
const JobBoardManagement = lazy(() => import('./components/admin/JobBoardManagement'));
const AdminWalkInTransactions = lazy(() => import('./components/admin/WalkInTransactions'));
const OrderTracking = lazy(() => import('./components/customer/OrderTracking'));
const JobBoard = lazy(() => import('./components/customer/JobBoard'));
const JobApplyForm = lazy(() => import('./components/customer/JobApplyForm'));
const NotificationsPage = lazy(() => import('./components/shared/NotificationsPage'));
const StaffInventory = lazy(() => import('./components/staff/StaffInventory'));

// Simple error boundary component
function ErrorBoundary() {
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>Something went wrong</h1>
      <p>Please try refreshing the page or contact support.</p>
      <button onClick={() => window.location.href = '/login'}>Go to Login</button>
    </div>
  );
}

function PageLoading() {
  return (
    <main
      role="status"
      aria-live="polite"
      className="flex min-h-screen items-center justify-center bg-[#f6f7f9] px-4 text-sm font-medium text-slate-600"
    >
      Loading page…
    </main>
  );
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/login',
    element: <LoginPage />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/signup',
    element: <SignUpPage />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/auth/callback',
    element: <AuthCallbackPage />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/forgot-password',
    element: <ForgotPassword />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/reset-password',
    element: <ResetPasswordPage />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/customer',
    errorElement: <ErrorBoundary />,
    children: [
      {
        path: '',
        element: <Navigate to="/customer/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <ProtectedRoute role="customer"><CustomerDashboard /></ProtectedRoute>,
      },
      {
        path: 'profile',
        element: <ProtectedRoute role="customer"><CustomerProfile /></ProtectedRoute>,
      },
      {
        path: 'new-request',
        element: <ProtectedRoute role="customer"><NewPrintRequest /></ProtectedRoute>,
      },
      {
        path: 'orders',
        element: <ProtectedRoute role="customer"><CustomerOrders /></ProtectedRoute>,
      },
      {
        path: 'track/:orderId',
        element: <ProtectedRoute role="customer"><OrderTracking /></ProtectedRoute>,
      },
      {
        path: 'job-board',
        element: <ProtectedRoute role="customer"><JobBoard /></ProtectedRoute>,
      },
      {
        path: 'job-board/apply/:jobId',
        element: <ProtectedRoute role="customer"><JobApplyForm /></ProtectedRoute>,
      },
      {
        path: 'job-apply/:jobId',
        element: <ProtectedRoute role="customer"><JobApplyForm /></ProtectedRoute>,
      },
      {
        path: 'payment/:orderId',
        element: <ProtectedRoute role="customer"><CustomerPaymentVerification /></ProtectedRoute>,
      },
      {
        path: 'payment-method/:orderId',
        element: <ProtectedRoute role="customer"><DownPaymentMethod /></ProtectedRoute>,
      },
      {
        path: 'notifications',
        element: <ProtectedRoute role="customer"><NotificationsPage /></ProtectedRoute>,
      },
    ],
  },
  {
    path: '/staff',
    errorElement: <ErrorBoundary />,
    children: [
      {
        path: '',
        element: <Navigate to="/staff/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <ProtectedRoute role="staff"><StaffDashboard /></ProtectedRoute>,
      },
      {
        path: 'profile',
        element: <ProtectedRoute role="staff"><StaffProfile /></ProtectedRoute>,
      },
      {
        path: 'timesheet',
        element: <ProtectedRoute role="staff"><StaffTimesheet /></ProtectedRoute>,
      },
      {
        path: 'queue',
        element: <ProtectedRoute role="staff"><StaffOrdersUnified /></ProtectedRoute>,
      },
      {
        path: 'queue/pickup',
        element: <ProtectedRoute role="staff"><StaffPickupMonitoring /></ProtectedRoute>,
      },
      {
        path: 'queue/unclaimed',
        element: <ProtectedRoute role="staff"><StaffUnclaimedOrders /></ProtectedRoute>,
      },
      {
        path: 'queue/unclaimed/history',
        element: <ProtectedRoute role="staff"><StaffUnclaimedOrderHistory /></ProtectedRoute>,
      },
      {
        path: 'queue/unclaimed/restrictions',
        element: <ProtectedRoute role="staff"><StaffUnclaimedRestrictions /></ProtectedRoute>,
      },
      {
        path: 'orders',
        element: <Navigate to="/staff/queue" replace />,
      },
      {
        path: 'walk-in',
        element: <ProtectedRoute role="staff"><WalkInTransactions /></ProtectedRoute>,
      },
      {
        path: 'payment-verification',
        element: <ProtectedRoute role="staff"><StaffPaymentVerificationUnified /></ProtectedRoute>,
      },
      {
        path: 'inventory',
        element: <ProtectedRoute role="staff"><StaffInventory /></ProtectedRoute>,
      },
      {
        path: 'notifications',
        element: <ProtectedRoute role="staff"><NotificationsPage /></ProtectedRoute>,
      },
    ],
  },
  {
    path: '/admin',
    errorElement: <ErrorBoundary />,
    children: [
      {
        path: '',
        element: <Navigate to="/admin/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>,
      },
      {
        path: 'profile',
        element: <ProtectedRoute role="admin"><AdminProfile /></ProtectedRoute>,
      },
      {
        path: 'walk-in',
        element: <ProtectedRoute role="admin"><AdminWalkInTransactions /></ProtectedRoute>,
      },
      {
        path: 'payment-verification',
        element: <ProtectedRoute role="admin"><AdminPaymentVerificationUnified /></ProtectedRoute>,
      },
      {
        path: 'payment-methods',
        element: <ProtectedRoute role="admin"><PaymentMethodsManagement /></ProtectedRoute>,
      },
      {
        path: 'pricing',
        element: <ProtectedRoute role="admin"><PricingManagement /></ProtectedRoute>,
      },
      {
        path: 'landing',
        element: <ProtectedRoute role="admin"><LandingPageEditor /></ProtectedRoute>,
      },
      {
        path: 'legal',
        element: <ProtectedRoute role="admin"><LegalManagement /></ProtectedRoute>,
      },
      {
        path: 'audit-trail',
        element: <ProtectedRoute role="admin"><AuditLogManagement /></ProtectedRoute>,
      },
      {
        path: 'orders',
        element: <ProtectedRoute role="admin"><AdminOrdersUnified /></ProtectedRoute>,
      },
      {
        path: 'orders/pickup',
        element: <ProtectedRoute role="admin"><AdminPickupMonitoring /></ProtectedRoute>,
      },
      {
        path: 'orders/unclaimed',
        element: <ProtectedRoute role="admin"><AdminUnclaimedOrders /></ProtectedRoute>,
      },
      {
        path: 'orders/unclaimed/history',
        element: <ProtectedRoute role="admin"><AdminUnclaimedOrderHistory /></ProtectedRoute>,
      },
      {
        path: 'orders/unclaimed/restrictions',
        element: <ProtectedRoute role="admin"><AdminUnclaimedRestrictions /></ProtectedRoute>,
      },
      {
        path: 'inventory',
        element: <ProtectedRoute role="admin"><InventoryManagement /></ProtectedRoute>,
      },
      {
        path: 'staff',
        element: <ProtectedRoute role="admin"><Staff /></ProtectedRoute>,
      },
      {
        // Attendance is no longer a page of its own; the old route is kept
        // alive for bookmarks but says where it went instead of silently
        // swapping the screen (F28).
        path: 'attendance',
        element: <Navigate to="/admin/staff" replace />,
      },
      {
        path: 'jobs',
        element: <ProtectedRoute role="admin"><JobBoardManagement /></ProtectedRoute>,
      },
      {
        path: 'job-board',
        element: <ProtectedRoute role="admin"><JobBoardManagement /></ProtectedRoute>,
      },
      {
        path: 'notifications',
        element: <ProtectedRoute role="admin"><NotificationsPage /></ProtectedRoute>,
      },
    ],
  },
]);

export default function App() {
  return (
    <PopupProvider>
      <AuthProvider>
        <MobileNavProvider>
          <Suspense fallback={<PageLoading />}>
            <RouterProvider router={router} />
          </Suspense>
          <MobileNavSheet router={router} />
          <Toaster richColors position="top-center" />
        </MobileNavProvider>
      </AuthProvider>
    </PopupProvider>
  );
}
