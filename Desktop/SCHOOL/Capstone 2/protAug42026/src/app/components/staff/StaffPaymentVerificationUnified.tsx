import React from 'react';
import UnifiedPaymentVerification from '../shared/UnifiedPaymentVerification';
import {
  LayoutDashboard,
  CreditCard,
  Package,
  ShoppingCart,
  Boxes,
} from 'lucide-react';

const staffMenuItems = [
  {
    label: 'Dashboard',
    path: '/staff/dashboard',
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    label: 'Orders',
    path: '/staff/queue',
    icon: <Package className="w-5 h-5" />,
  },
  {
    label: 'Walk-in Transactions',
    path: '/staff/walk-in',
    icon: <ShoppingCart className="w-5 h-5" />,
  },
  {
    label: 'Payment Verification',
    path: '/staff/payment-verification',
    icon: <CreditCard className="w-5 h-5" />,
  },
  {
    label: 'Inventory',
    path: '/staff/inventory',
    icon: <Boxes className="w-5 h-5" />,
  },
];

export default function StaffPaymentVerificationUnified() {
  return <UnifiedPaymentVerification menuItems={staffMenuItems} userRole="staff" />;
}
