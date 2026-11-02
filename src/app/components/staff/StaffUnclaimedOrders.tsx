import React from 'react';
import UnclaimedOrders from '../shared/UnclaimedOrders';
import { staffMenuItems } from './StaffOrdersUnified';

export default function StaffUnclaimedOrders() {
  return <UnclaimedOrders menuItems={staffMenuItems} userRole="staff" />;
}
