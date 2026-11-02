import React from 'react';
import UnclaimedOrderHistory from '../shared/UnclaimedOrderHistory';
import { adminMenuItems } from '../../utils/adminMenuItems';

export default function AdminUnclaimedOrderHistory() {
  return <UnclaimedOrderHistory menuItems={adminMenuItems} userRole="admin" />;
}
