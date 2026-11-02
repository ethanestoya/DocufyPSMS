import React from 'react';
import UnclaimedOrders from '../shared/UnclaimedOrders';
import { adminMenuItems } from '../../utils/adminMenuItems';

export default function AdminUnclaimedOrders() {
  return <UnclaimedOrders menuItems={adminMenuItems} userRole="admin" />;
}
