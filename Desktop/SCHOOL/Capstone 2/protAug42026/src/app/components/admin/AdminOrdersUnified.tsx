import React from 'react';
import UnifiedOrders from '../shared/UnifiedOrders';
import { adminMenuItems } from '../../utils/adminMenuItems';

export default function AdminOrdersUnified() {
  return <UnifiedOrders menuItems={adminMenuItems} userRole="admin" />;
}
