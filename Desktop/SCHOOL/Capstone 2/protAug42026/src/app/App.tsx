import { createBrowserRouter, RouterProvider, Navigate } from 'react-router';
import { AuthProvider } from './contexts/AuthContext';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import SignUpPage from './components/SignUpPage';
import CustomerDashboard from './components/customer/CustomerDashboard';
import CustomerProfile from './components/customer/CustomerProfile';
import NewPrintRequest from './components/customer/NewPrintRequest';
import CustomerOrders from './components/customer/CustomerOrders';
import CustomerPaymentVerification from './components/customer/PaymentVerification';
import StaffQueueBoard from './components/staff/StaffQueueBoard';
import StaffOrdersUnified from './components/staff/StaffOrdersUnified';
import WalkInTransactions from './components/staff/WalkInTransactions';
import StaffDashboard from './components/staff/StaffDashboard';
import StaffPaymentVerificationUnified from './components/staff/StaffPaymentVerificationUnified';
import InventoryManagement from './components/staff/InventoryManagement';
import AdminDashboard from './components/admin/AdminDashboard';
import AdminPaymentVerificationUnified from './components/admin/AdminPaymentVerificationUnified';
import SecurityCenter from './components/admin/SecurityCenter';
import AuditLogs from './components/admin/AuditLogs';
import BackupManagement from './components/admin/BackupManagement';
import AdminOrders from './components/admin/AdminOrders';
import AdminOrdersUnified from './components/admin/AdminOrdersUnified';
import Inventory from './components/admin/Inventory';
import Staff from './components/admin/Staff';
import JobBoardManagement from './components/admin/JobBoardManagement';
import AdminWalkInTransactions from './components/admin/WalkInTransactions';
import Reports from './components/admin/Reports';
import ContentManagement from './components/admin/ContentManagement';
import OrderTracking from './components/customer/OrderTracking';
import JobBoard from './components/customer/JobBoard';
import JobApplyForm from './components/customer/JobApplyForm';
import ProtectedRoute from './components/ProtectedRoute';

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
        path: 'queue',
        element: <ProtectedRoute role="staff"><StaffOrdersUnified /></ProtectedRoute>,
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
        element: <ProtectedRoute role="staff"><InventoryManagement /></ProtectedRoute>,
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
        path: 'walk-in',
        element: <ProtectedRoute role="admin"><AdminWalkInTransactions /></ProtectedRoute>,
      },
      {
        path: 'payment-verification',
        element: <ProtectedRoute role="admin"><AdminPaymentVerificationUnified /></ProtectedRoute>,
      },
      {
        path: 'orders',
        element: <ProtectedRoute role="admin"><AdminOrdersUnified /></ProtectedRoute>,
      },
      {
        path: 'inventory',
        element: <ProtectedRoute role="admin"><Inventory /></ProtectedRoute>,
      },
      {
        path: 'staff',
        element: <ProtectedRoute role="admin"><Staff /></ProtectedRoute>,
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
        path: 'reports',
        element: <ProtectedRoute role="admin"><Reports /></ProtectedRoute>,
      },
      {
        path: 'content',
        element: <ProtectedRoute role="admin"><ContentManagement /></ProtectedRoute>,
      },
      {
        path: 'security-center',
        element: <ProtectedRoute role="admin"><SecurityCenter /></ProtectedRoute>,
      },
      {
        path: 'audit-logs',
        element: <ProtectedRoute role="admin"><AuditLogs /></ProtectedRoute>,
      },
      {
        path: 'backup-management',
        element: <ProtectedRoute role="admin"><BackupManagement /></ProtectedRoute>,
      },
    ],
  },
]);

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
