import React from 'react';
import UnifiedPaymentVerification from '../shared/UnifiedPaymentVerification';
import { adminMenuItems } from '../../utils/adminMenuItems';

export default function AdminPaymentVerificationUnified() {
  return <UnifiedPaymentVerification menuItems={adminMenuItems} userRole="admin" />;
}
