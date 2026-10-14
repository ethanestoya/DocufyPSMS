import React from 'react';
import UnclaimedOrderHistory from '../shared/UnclaimedOrderHistory';
import { staffMenuItems } from './StaffOrdersUnified';

export default function StaffUnclaimedOrderHistory() {
  return <UnclaimedOrderHistory menuItems={staffMenuItems} userRole="staff" />;
}
