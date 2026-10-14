import { createBrowserRouter, RouterProvider, Navigate } from 'react-router';
import { Toaster } from './components/ui/sonner';
import { AuthProvider } from './contexts/AuthContext';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import SignUpPage from './components/SignUpPage';
import AuthCallbackPage from './components/AuthCallbackPage';
import ForgotPassword from './components/ForgotPassword';
import ResetPasswordPage from './components/ResetPasswordPage';
import CustomerDashboard from './components/customer/CustomerDashboard';
import CustomerProfile from './components/customer/CustomerProfile';
import NewPrintRequest from './components/customer/NewPrintRequest';
import CustomerOrders from './components/customer/CustomerOrders';
import CustomerPaymentVerification from './components/customer/PaymentVerification';
import DownPaymentMethod from './components/customer/DownPaymentMethod';
import StaffOrdersUnified from './components/staff/StaffOrdersUnified';
import StaffPickupMonitoring from './components/staff/StaffPickupMonitoring';
import StaffUnclaimedOrders from './components/staff/StaffUnclaimedOrders';
import StaffUnclaimedOrderHistory from './components/staff/StaffUnclaimedOrderHistory';
import StaffUnclaimedRestrictions from './components/staff/StaffUnclaimedRestrictions';
import WalkInTransactions from './components/staff/WalkInTransactions';
import StaffDashboard from './components/staff/StaffDashboard';
import StaffProfile from './components/staff/StaffProfile';
import StaffTimesheet from './components/staff/StaffTimesheet';
import StaffPaymentVerificationUnified from './components/staff/StaffPaymentVerificationUnified';
import AdminDashboard from './components/admin/AdminDashboard';
import AdminProfile from './components/admin/AdminProfile';
import AdminPaymentVerificationUnified from './components/admin/AdminPaymentVerificationUnified';
import AdminOrdersUnified from './components/admin/AdminOrdersUnified';
import AdminPickupMonitoring from './components/admin/AdminPickupMonitoring';
import AdminUnclaimedOrders from './components/admin/AdminUnclaimedOrders';
import AdminUnclaimedOrderHistory from './components/admin/AdminUnclaimedOrderHistory';
import AdminUnclaimedRestrictions from './components/admin/AdminUnclaimedRestrictions';
import Staff from './components/admin/Staff';
import InventoryManagement from './components/admin/InventoryManagement';
import PaymentMethodsManagement from './components/admin/PaymentMethodsManagement';
import PricingManagement from './components/admin/PricingManagement';
import LandingPageEditor from './components/admin/LandingPageEditor';
import LegalManagement from './components/admin/LegalManagement';
import AuditLogManagement from './components/admin/AuditLogManagement';
import JobBoardManagement from './components/admin/JobBoardManagement';
import AdminWalkInTransactions from './components/admin/WalkInTransactions';
import OrderTracking from './components/customer/OrderTracking';
import JobBoard from './components/customer/JobBoard';
import JobApplyForm from './components/customer/JobApplyForm';
import NotificationsPage from './components/shared/NotificationsPage';
import ProtectedRoute from './components/ProtectedRoute';
import StaffInventory from './components/staff/StaffInventory';
import { MobileNavProvider } from './contexts/MobileNavContext';
import MobileNavSheet from './components/shared/MobileNavSheet';
// Module-level side effect: subscribes to the inventory store and emits Low
// Stock / Out of Stock alerts to the Notifications system on any inventory
// change (Stock In/Out, order deductions, item edits).
import './utils/inventoryAlerts';
// Auto-cancels awaited-payment orders whose payment deadline has passed.
import './utils/paymentExpiry';
// Seeds the single-row settings tables + pricing matrix cells (best-effort).
import '../lib/db/bootstrap';

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
    <AuthProvider>
      <MobileNavProvider>
        <RouterProvider router={router} />
        {/* Persistent mobile sidebar — lives outside the router tree so it can
            animate closed while the next page mounts during navigation. */}
        <MobileNavSheet router={router} />
        <Toaster richColors position="top-center" />
      </MobileNavProvider>
    </AuthProvider>
  );
}
